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
from .services.kitchen_decisions import menu_forecast, decision_support, project_batches, horizon_score, score
from .services.local_planning import local_plan


class BaselineEvaluationTests(SimpleTestCase):
    def test_planning_horizon_replay_cannot_observe_sales_inside_its_window(self):
        values = [1]*56 + [10]*14
        replay = horizon_score(values, 56, 14, 'mean_7')
        self.assertEqual(replay['windows'], 1)
        self.assertEqual(replay['mae'], 9)
        self.assertEqual(replay['window_total_mae'], 126)
        self.assertEqual(replay['wape_percent'], 90)
        self.assertLess(score(values, 56, 70, 'mean_7')['mae'], replay['mae'])

    def test_long_horizon_is_not_validated_by_short_one_day_scores(self):
        result = menu_forecast([2]*70, list(range(70)), 28)
        self.assertEqual(result['evaluation']['test']['mean_28']['mae'], 0)
        self.assertEqual(result['evaluation']['planning_horizon_test']['test']['mean_28']['windows'], 0)
        self.assertIsNone(result['evaluation']['planning_horizon_test']['test']['mean_28']['mae'])
        self.assertEqual(result['confidence'], 'limited')

    def test_expiring_waste_is_separate_from_later_dated_remaining_stock(self):
        def batch(pk,quantity,expiry):
            return {'batch_id':pk,'raw_material_id':1,'unit':'g','quantity':quantity,
                'allocated_quantity':0,'remaining_quantity':quantity,'eligible':True,
                'received_date':'2026-10-17','expiry_date':expiry,'unit_cost':.006}
        plan={'window':{'end_date':'2026-10-23'},'batches':[batch(1,1800,'2026-10-19'),batch(2,3600,'2026-10-31')]}
        trace={}
        waste,short,cost=project_batches(plan,{('2026-10-18',1):1603.109,('2026-10-21',1):3267.877},trace=trace)
        self.assertAlmostEqual(waste[1],196.891)
        self.assertEqual(short[1],0)
        self.assertAlmostEqual(cost[1],196.891*.006)
        self.assertAlmostEqual(trace['batches'][1]['projected_remaining'],332.123)
        self.assertAlmostEqual(sum(b['projected_remaining'] for b in trace['batches']),529.014)
        self.assertAlmostEqual(sum(a['quantity'] for a in trace['allocations']),4870.986)
        self.assertEqual(plan['batches'][0]['remaining_quantity'],1800)

    def test_weekly_stock_can_exceed_demand_but_expire_before_it_is_needed(self):
        plan={'window':{'end_date':'2026-10-23'},'batches':[{'batch_id':1,'raw_material_id':1,
            'unit':'g','quantity':100,'allocated_quantity':0,'remaining_quantity':100,'eligible':True,
            'received_date':'2026-10-17','expiry_date':'2026-10-18','unit_cost':1}]}
        trace={}
        waste,short,_=project_batches(plan,{('2026-10-20',1):50},trace=trace)
        self.assertEqual(waste[1],100);self.assertEqual(short[1],50)
        self.assertEqual(trace['batches'][0]['forecast_consumed'],0)

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

    def test_missing_task_plans_do_not_block_delivery_based_sales_forecasts(self):
        self.history(days=70)
        self.batch(1500, expiry_days=5)
        unfinished = Order.objects.create(user=self.buyer, status='pending', payment_status='unpaid')
        self.assertFalse(Order.objects.filter(status='delivered').exclude(preparation_plan={}).exists())
        with patch('predictive_ai.service.bundle', side_effect=AssertionError('Kitchen forecast must not load Genpact')):
            response = self.client.get('/api/admin/predictive/local-decisions/?horizon_days=7')
        self.assertEqual(response.status_code, 200, response.data)
        support = response.data['decision_support']
        menu = support['menus'][0]
        self.assertEqual(menu['product_id'], self.menu.pk)
        self.assertEqual(menu['total_recorded_portions'], 140)
        self.assertGreater(menu['forecast_portions'], 0)
        self.assertEqual(menu['history'][0]['date'], str(timezone.localdate()-timedelta(days=70)))
        self.assertIsNotNone(menu['evaluation'])
        self.assertGreater(support['ingredient_risks'][0]['forecast_requirement'], 0)
        self.assertIn(unfinished.pk, [o['order_id'] for o in response.data['excluded_orders']])
        unfinished.refresh_from_db()
        self.assertEqual(unfinished.payment_status, 'unpaid')
        self.assertEqual(unfinished.preparation_plan, {})

    def test_confirmed_bookings_are_not_added_to_forecast_twice(self):
        self.history()
        self.order(portions=2)
        self.batch(1000)
        d=decision_support(local_plan())
        m=d['menus'][0]
        self.assertEqual(m['future_committed_portions'],2)
        self.assertLess(m['additional_forecast_portions'],m['forecast_portions'])
        self.assertEqual(d['ingredient_risks'][0]['forecast_requirement'],m['additional_forecast_portions']*100)

    def test_menu_adjustments_explain_lead_time_without_inventing_bookings(self):
        self.history()
        support=decision_support(local_plan())
        menu=support['menus'][0]
        self.assertEqual(menu['forecast_portions'],14)
        self.assertEqual(menu['additional_forecast_portions'],12)
        self.assertEqual(menu['demand_adjustments']['lead_time_excluded'],2)
        self.assertEqual(menu['demand_adjustments']['recorded_orders_offset'],0)
        self.assertEqual(menu['future_committed_portions'],0)

    def test_stock_and_menu_ledgers_balance_with_capacity_and_recorded_orders(self):
        self.history();self.order(portions=2);self.batch(1500,expiry_days=2);self.batch(1000,expiry_days=14)
        self.menu.daily_capacity=1;self.menu.save()
        support=decision_support(local_plan())
        menu=support['menus'][0];risk=support['ingredient_risks'][0];flow=risk['stock_flow']
        self.assertAlmostEqual(menu['forecast_portions'],menu['additional_forecast_portions']+sum(menu['demand_adjustments'].values()),places=2)
        self.assertGreater(menu['demand_adjustments']['capacity_excluded'],0)
        self.assertGreater(menu['demand_adjustments']['recorded_orders_offset'],0)
        self.assertAlmostEqual(flow['opening_quantity']-flow['confirmed_allocated']-flow['forecast_consumed'],flow['projected_total_remaining'],places=2)
        self.assertAlmostEqual(flow['projected_expiring_unused']+flow['projected_carried_stock'],flow['projected_total_remaining'],places=2)
        self.assertAlmostEqual(flow['forecast_consumed']+risk['forecast_shortfall'],risk['forecast_requirement'],places=2)
        expiry = flow['expiry_focus']
        self.assertAlmostEqual(expiry['opening_quantity']-expiry['confirmed_allocated']-expiry['forecast_consumed'],risk['forecast_expiring_unused'],places=2)
        self.assertAlmostEqual(sum(d['forecast_requirement'] for d in flow['demand_by_day']),risk['forecast_requirement'],places=2)
        for day in flow['demand_by_day']:
            self.assertAlmostEqual(sum(m['additional_portions']*m['quantity_per_portion'] for m in day['menus']),day['forecast_requirement'])
        self.assertAlmostEqual(sum(d['forecast_consumed'] for d in flow['demand_by_day']),flow['forecast_consumed'],places=2)

    def test_generated_history_never_creates_a_verified_forecast_waste_signal(self):
        self.history()
        Order.objects.filter(status='delivered').update(payment_instructions={'freshcast_synthetic_history': {'version': '1'}})
        self.batch(100000)
        support = decision_support(local_plan())
        risk = support['ingredient_risks'][0]
        self.assertGreater(risk['waste_sensitivity_low'], 0)
        self.assertEqual(risk['signal'], 'review')
        self.assertEqual(risk['confidence'], 'limited')
        self.assertEqual(support['alert_count'], 0)

    def test_fictional_stock_is_a_scenario_even_with_evaluated_history(self):
        self.history()
        batch = self.batch(100000)
        batch.batch_code = f'DEMO-FC-INV-{self.material.pk}-NEAR'
        batch.save()
        support = decision_support(local_plan())
        self.assertEqual(support['ingredient_risks'][0]['signal'], 'review')
        self.assertTrue(any('fictional demo batches' in r for r in support['ingredient_risks'][0]['review_reasons']))

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
        self.assertTrue(any('limited or unavailable' in reason for reason in d['ingredient_risks'][0]['review_reasons']))
        self.assertTrue(any('excluded from stock planning' in reason for reason in d['ingredient_risks'][0]['review_reasons']))
        self.assertNotIn('No active recipe maps', d['ingredient_risks'][0]['alert_reason'])

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
