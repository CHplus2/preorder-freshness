"""Access, input and request-cost boundaries; no real model or AI provider used."""
from datetime import timedelta
from unittest.mock import patch
from urllib.error import URLError
from urllib.request import Request

from django.contrib.auth.models import User
from django.test import TestCase, SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Order, OrderItem, Product
from .services.kitchen_decisions import demand_snapshot, decision_support
from .services.local_planning import local_plan

BASE='/api/admin/predictive/'


class PredictiveAccessAndCostTests(TestCase):
    def setUp(self):
        self.staff=User.objects.create_user('predictive-boundary-owner',is_staff=True)
        self.buyer=User.objects.create_user('predictive-boundary-customer')
        self.client=APIClient();self.client.force_authenticate(self.staff)

    @patch('predictive_ai.service.bundle',side_effect=AssertionError('Invalid input must not load model'))
    def test_invalid_genpact_parameters_fail_before_model_loading(self,bundle):
        for query in ['','?center_id=0','?center_id=-1','?center_id=13&week=0',
                      '?center_id='+('9'*5000),'?center_id=13&week='+('9'*5000),
                      '?center_id=13&unexpected=1','?center_id=13&center_id=13']:
            with self.subTest(query=query[:60]):
                self.assertEqual(self.client.get(BASE+'forecast/'+query).status_code,400)
        for body in [[13],{'center_id':True},{'center_id':13,'promotion_scenario':'true'},
                     {'center_id':{}},{'center_id':13,'week':'9'*5000}]:
            self.assertEqual(self.client.post(BASE+'what-if/',body,format='json').status_code,400)
        for route in ['metrics/?unexpected=1','centers/?unexpected=1',
                      'backtest/?center_id=13','backtest/?center_id=13&week=0',
                      'backtest/?center_id='+('9'*5000)+'&week=136']:
            self.assertEqual(self.client.get(BASE+route).status_code,400,route[:70])
        bundle.assert_not_called()

    @patch('predictive_ai.service.bundle',side_effect=AssertionError('No unauthorized model load'))
    @patch('myapp.views.local_planning.local_plan',side_effect=AssertionError('No unauthorized local planning'))
    @patch('myapp.views.kitchen_reviews.local_plan',side_effect=AssertionError('No unauthorized signed review'))
    def test_all_prediction_families_deny_customer_and_anonymous_access(self,*mocks):
        gets=['metrics/','centers/','forecast/?center_id=13','inventory-risk/?center_id=13',
              'backtest/?center_id=13&week=136','local-plan/','local-decisions/','local-forecast/']
        posts=['what-if/','local-scenario/','local-decision-scenario/','local-reviews/','local-review-outcomes/']
        for actor in [None,self.buyer]:
            self.client.force_authenticate(actor)
            for route in gets:self.assertEqual(self.client.get(BASE+route).status_code,403,route)
            for route in posts:self.assertEqual(self.client.post(BASE+route,{},format='json').status_code,403,route)
        for mock in mocks:mock.assert_not_called()

    def test_daily_decisions_only_load_their_history_and_booking_window(self):
        today=timezone.localdate()
        product=Product.objects.create(name='Windowed menu',price=10)
        def order(offset,*,fallback=False):
            stamp=timezone.localtime().replace(hour=12,minute=0,second=0,microsecond=0)+timedelta(days=offset)
            row=Order.objects.create(user=self.buyer,status='delivered',payment_status='paid',delivery_at=None if fallback else stamp)
            Order.objects.filter(pk=row.pk).update(created_at=stamp-timedelta(days=1) if not fallback else stamp)
            OrderItem.objects.create(order=row,product=product,product_name=product.name,quantity=2,unit_price=10,subtotal=20)
            return row.pk
        expected={order(-112),order(-1),order(-2,fallback=True),order(27)}
        order(-113);order(-113,fallback=True);order(28)
        snapshot=demand_snapshot(today=today,horizon_days=28)
        self.assertEqual({o.pk for o in snapshot[1]},expected)
        plan=local_plan(28)
        all_orders=list(Order.objects.prefetch_related('items'))
        self.assertEqual(decision_support(plan,today=today,snapshot=snapshot),
            decision_support(plan,today=today,snapshot=(snapshot[0],all_orders,snapshot[2])))

    @patch('django.contrib.auth.models.User.objects.select_for_update',side_effect=AssertionError('Malformed input must not lock customer'))
    def test_non_object_shopping_confirmation_rejected_before_locks(self,lock):
        self.client.force_authenticate(self.buyer)
        for body in [[],[{'product_id':1}], 'not-an-object', None]:
            with self.subTest(body=body):
                response=(self.client.generic('POST','/api/help/cart/','null',content_type='application/json')
                    if body is None else self.client.post('/api/help/cart/',body,format='json'))
                self.assertEqual(response.status_code,400)
        lock.assert_not_called()


class ProviderTransportTests(SimpleTestCase):
    def test_ai_redirects_are_rejected_without_forwarding_authorization(self):
        from .services.ai_provider import NoProviderRedirects
        request=Request('https://api.groq.com/openai/v1/chat/completions',headers={'Authorization':'Bearer fixture-only'})
        for target in ['https://elsewhere.example/collect','http://api.groq.com/collect','https://api.groq.com/another']:
            with self.assertRaises(URLError):
                NoProviderRedirects().redirect_request(request,None,307,'redirect',{},target)

    @override_settings(GROQ_API_KEY='fixture-only',GROQ_CHAT_MODEL='fixture-model')
    def test_blocked_redirect_uses_the_existing_guided_fallback(self):
        from .services.kitchen_help import ai_topic
        from .services.shopping_assistant import ai_extract
        with patch('myapp.services.ai_provider.build_opener') as opener:
            opener.return_value.open.side_effect=URLError('Redirect blocked')
            self.assertIsNone(ai_topic('unfamiliar question'))
            self.assertIsNone(ai_extract('unfamiliar request'))
