"""Deterministic synthetic fixtures validate algorithms; not business accuracy claims."""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from django.db import connection
from django.test import TestCase, SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from . import test_local_planning as fixtures
from .models import Order, OrderItem, WasteRecord, InventoryItem
from .services.kitchen_decisions import menu_forecast, decision_support, project_batches
from .services.local_planning import local_plan


class BaselineEvaluationTests(SimpleTestCase):
    def test_test_period_cannot_change_selected_method(self):
        today=timezone.localdate()
        dates=[today-timedelta(days=70-i) for i in range(70)]
        values=[4 if day.weekday()<5 else 0 for day in dates]
        original=menu_forecast(values,dates,7)
        modified=menu_forecast(values[:-14]+[200]*14,dates,7)
        self.assertEqual(original['method'], modified['method'])
        self.assertEqual(original['evaluation']['validation'],modified['evaluation']['validation'])
        self.assertNotEqual(original['evaluation']['test'],modified['evaluation']['test'])
        self.assertEqual(original['method'],'same_weekday')
        self.assertEqual(original['evaluation']['test']['same_weekday']['mae'],0)

    def test_sparse_zero_and_unfamiliar_data_are_not_confident(self):
        for values in ([],[0]*70,[0]*69+[10000],[2,0,3]):
            result=menu_forecast(values,list(range(len(values))),7)
            self.assertNotEqual(result['confidence'],'evaluated')
            self.assertTrue(all(v>=0 for v in result['daily_predictions']))

    def test_fefo_never_uses_expired_or_not_received_lots_or_duplicates_stock(self):
        plan={'window':{'end_date':'2026-10-20'},'batches':[
            {'batch_id':1,'raw_material_id':1,'eligible':True,'received_date':'2026-10-16','expiry_date':'2026-10-17','remaining_quantity':5,'unit_cost':2},
            {'batch_id':2,'raw_material_id':1,'eligible':False,'received_date':'2026-10-15','expiry_date':'2026-10-20','remaining_quantity':100,'unit_cost':None},
            {'batch_id':3,'raw_material_id':1,'eligible':True,'received_date':'2026-10-19','expiry_date':'2026-10-20','remaining_quantity':4,'unit_cost':None}]}
        waste,short,cost=project_batches(plan,{('2026-10-16',1):3,('2026-10-18',1):5})
        self.assertEqual(short[1],5)
        self.assertEqual(waste[1],6)
        self.assertIsNone(cost[1])


class KitchenDecisionTests(TestCase):
    setUp=fixtures.LocalPlanningTests.setUp
    order=fixtures.LocalPlanningTests.order
    batch=fixtures.LocalPlanningTests.batch

    def history(self,days=70,quantity=2):
        now=timezone.localtime()
        for offset in range(days,0,-1):
            delivered=now-timedelta(days=offset)
            order=Order.objects.create(user=self.buyer,status='delivered',payment_status='paid',delivery_at=delivered,total_amount=quantity*10)
            Order.objects.filter(pk=order.pk).update(created_at=delivered-timedelta(days=2))
            OrderItem.objects.create(order=order,product=self.menu,product_name=self.menu.name,quantity=quantity,unit_price=10,subtotal=quantity*10)

    def test_local_recipes_forecast_and_expiry_are_connected_read_only(self):
        self.history()
        self.batch(1500,expiry_days=5)
        with patch('predictive_ai.service.bundle',side_effect=AssertionError('Never load Genpact')), CaptureQueriesContext(connection) as queries:
            response=self.client.get('/api/admin/predictive/local-decisions/?horizon_days=7')
        self.assertEqual(response.status_code,200,response.data)
        self.assertTrue(all(q['sql'].lstrip().upper().startswith('SELECT') for q in queries))
        d=response.data['decision_support'];r=d['ingredient_risks'][0]
        self.assertGreater(r['forecast_requirement'],0)
        self.assertLess(r['forecast_expiring_unused'],r['expiring_unused_quantity'])
        self.assertEqual(r['menus'][0]['product_id'],self.menu.pk)
        self.assertEqual(d['menus'][0]['confidence'],'evaluated')
        self.assertEqual(d['menus'][0]['evaluation']['test']['mean_28']['mae'],0)
        self.assertEqual(InventoryItem.objects.first().quantity,1500)

    def test_confirmed_bookings_are_not_added_to_forecast_twice(self):
        self.history()
        self.order(portions=2)
        self.batch(1000)
        d=decision_support(local_plan())
        m=d['menus'][0]
        self.assertEqual(m['future_committed_portions'],2)
        self.assertLess(m['additional_forecast_portions'],m['forecast_portions'])
        self.assertEqual(d['ingredient_risks'][0]['forecast_requirement'],m['additional_forecast_portions']*100)

    def test_future_recipe_need_is_visible_even_without_any_batch_or_confirmed_order(self):
        self.history()
        response=self.client.get('/api/admin/predictive/local-decisions/')
        self.assertEqual(response.status_code,200,response.data)
        risk=response.data['decision_support']['ingredient_risks'][0]
        self.assertEqual(risk['raw_material_id'],self.material.pk)
        self.assertEqual(risk['eligible_stock'],0)
        self.assertEqual(risk['shortfall_quantity'],0)
        self.assertGreater(risk['forecast_shortfall'],0)
        self.assertEqual(risk['signal'],'review')
        self.assertEqual(self.client.get('/api/admin/predictive/local-plan/').data['ingredient_risks'],[])

    def test_no_history_or_excluded_orders_produces_review_not_waste_alarm(self):
        self.batch(500)
        self.order(payment_status='unpaid')
        d=decision_support(local_plan())
        self.assertEqual(d['alert_count'],0)
        self.assertEqual(d['ingredient_risks'][0]['signal'],'review')
        self.assertEqual(d['menus'][0]['confidence'],'unavailable')

    def test_renamed_menus_and_missing_recipes_do_not_invent_mappings(self):
        self.history(days=7)
        OrderItem.objects.update(product_name='Previous different dish')
        self.recipe.delete()
        self.batch(500)
        d=decision_support(local_plan())
        self.assertEqual(d['excluded_history']['historical_menu_identity_changed'],7)
        self.assertFalse(d['menus'][0]['recipe_complete'])
        self.assertEqual(d['ingredient_risks'][0]['menus'],[])
        self.assertEqual(d['alert_count'],0)

    def test_imputed_history_dates_cannot_create_a_confident_waste_alarm(self):
        self.history()
        Order.objects.filter(status='delivered').update(delivery_at=None)
        self.batch(1500)
        d=decision_support(local_plan())
        self.assertEqual(d['menus'][0]['estimated_date_items'],70)
        self.assertEqual(d['menus'][0]['confidence'],'limited')
        self.assertEqual(d['alert_count'],0)

    def test_purchase_scenario_includes_projection_and_is_nonpersistent(self):
        self.history(days=7)
        self.batch(50)
        self.order()
        response=self.client.post('/api/admin/predictive/local-decision-scenario/',{
            'raw_material_id':self.material.pk,'horizon_days':7,'quantity':'200','unit_cost':'0.02',
            'arrival_date':str(self.start.date()),'expiry_date':str(self.start.date()+timedelta(days=5))},format='json')
        self.assertEqual(response.status_code,200,response.data)
        before=response.data['baseline']['decision_support']['ingredient_risks'][0]
        after=response.data['scenario']['decision_support']['ingredient_risks'][0]
        self.assertGreater(before['shortfall_quantity'],after['shortfall_quantity'])
        self.assertEqual(InventoryItem.objects.count(),1)

    def test_signed_reviews_and_recorded_waste_outcome_without_db_writes(self):
        self.batch(500)
        body={'request_id':str(uuid4()),'raw_material_id':self.material.pk,'action':'marketing',
            'note':'Check lead time first','action_cost':'5','assumed_avoided_percent':'10'}
        with CaptureQueriesContext(connection) as queries:
            response=self.client.post('/api/admin/predictive/local-reviews/',body,format='json')
        self.assertEqual(response.status_code,201,response.data)
        self.assertTrue(all(q['sql'].lstrip().upper().startswith('SELECT') for q in queries))
        token=response.data['token']
        WasteRecord.objects.create(request_id=uuid4(),inventory_item=InventoryItem.objects.first(),quantity=Decimal('20'),estimated_cost=Decimal('.40'),reason='Test outcome')
        actual=self.client.post('/api/admin/predictive/local-review-outcomes/',{'token':token},format='json')
        self.assertEqual(actual.status_code,200,actual.data)
        self.assertEqual(actual.data['row']['recorded_waste_quantity'],20)
        self.assertEqual(actual.data['row']['known_waste_cost'],.4)
        self.assertIn('No causal',actual.data['definition'])
        self.assertEqual(self.client.post('/api/admin/predictive/local-review-outcomes/',{'token':token+'x'},format='json').status_code,400)

    def test_staff_csrf_and_input_validation(self):
        for user in (None,self.buyer):
            client=APIClient()
            if user:client.force_authenticate(user)
            self.assertEqual(client.get('/api/admin/predictive/local-decisions/').status_code,403)
            self.assertEqual(client.post('/api/admin/predictive/local-reviews/',{},format='json').status_code,403)
        csrf=APIClient(enforce_csrf_checks=True);csrf.force_login(self.staff)
        self.assertEqual(csrf.post('/api/admin/predictive/local-reviews/',{},format='json').status_code,403)
        self.assertEqual(self.client.get('/api/admin/predictive/local-decisions/?horizon_days=40').status_code,400)
        self.assertEqual(self.client.post('/api/admin/predictive/local-review-outcomes/',{'token':'bad'},format='json').status_code,400)
