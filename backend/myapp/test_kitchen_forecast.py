from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Order, OrderItem, Product
from .services.kitchen_forecast import forecast_history, kitchen_forecast, monday, predict, vector
from .views.planning import sales_summary


class ChronologicalForecastTests(SimpleTestCase):
    def test_short_and_empty_history(self):
        self.assertIsNone(forecast_history([], [])['next_week_portions'])
        result = forecast_history([10, 20, 30, 40], ['a', 'b', 'c', 'd'])
        self.assertEqual(result['next_week_portions'], 25)
        self.assertEqual(result['status'], 'baseline_only')
        self.assertFalse(result['candidate_model_trained'])

    def test_test_targets_cannot_change_validation_selection(self):
        values = [10 + (i % 5)*4 for i in range(40)]
        weeks = [str(i) for i in range(40)]
        first = forecast_history(values, weeks)
        changed = forecast_history(values[:-8] + [1000]*8, weeks)
        self.assertEqual(first['selected_method'], changed['selected_method'])
        self.assertEqual(first['evaluation']['validation'], changed['evaluation']['validation'])
        self.assertNotEqual(first['evaluation']['test'], changed['evaluation']['test'])
        self.assertEqual(first['evaluation']['train_weeks'], 24)
        self.assertEqual(first['evaluation']['validation_weeks'], 8)
        self.assertEqual(first['evaluation']['test_weeks'], 8)
        self.assertTrue(first['candidate_model_trained'])
        self.assertEqual(vector([10, 20, 30]), [1, 30, 20, 20])
        model = first['model']
        self.assertGreaterEqual(predict(model['kind'], values, model['coefficients']), 0)


class KitchenForecastTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('forecast-owner', is_staff=True)
        self.buyer = User.objects.create_user('forecast-buyer')
        self.product = Product.objects.create(name='Kitchen meal', price=10)
        self.now = timezone.localtime()
        self.today = self.now.date()

    def order(self, *, created, delivery, quantity=3, status='delivered', payment='paid'):
        order = Order.objects.create(user=self.buyer, status=status, payment_status=payment,
                                     delivery_at=delivery, total_amount=Decimal(quantity*10))
        Order.objects.filter(pk=order.pk).update(created_at=created)
        OrderItem.objects.create(order=order, product=self.product, product_name='Meal',
                                 quantity=quantity, unit_price=10, subtotal=quantity*10)
        return order

    def test_delivery_week_and_explicit_preorder_fallback_no_schedule_writes(self):
        created = self.now - timedelta(days=40)
        delivered = self.now - timedelta(days=15)
        old = self.order(created=created, delivery=delivered, quantity=5)
        missing = self.order(created=created, delivery=None, quantity=2)
        self.order(created=created, delivery=delivered, status='cancelled')
        self.order(created=created, delivery=delivered, payment='refunded')
        self.order(created=created, delivery=self.now + timedelta(days=7), status='pending')
        report = kitchen_forecast(today=self.today)
        rows = {r['week_start']: r for r in report['history']}
        self.assertEqual(report['eligible_orders'], 2)
        self.assertEqual(report['estimated_date_orders'], 1)
        self.assertEqual(rows[str(monday(delivered.date()))]['portions'], 5)
        self.assertEqual(rows[str(monday(created.date()))]['portions'], 2)
        missing.refresh_from_db(); old.refresh_from_db()
        self.assertIsNone(missing.delivery_at)
        self.assertEqual(old.delivery_at, delivered)

    def test_sales_use_delivery_dates_and_exclude_unfulfilled_preorders(self):
        self.order(created=self.now-timedelta(days=60), delivery=self.now-timedelta(days=1), quantity=7)
        self.order(created=self.now-timedelta(days=1), delivery=self.now+timedelta(days=5), quantity=10, status='pending')
        self.order(created=self.now-timedelta(days=2), delivery=None, quantity=2)
        data = sales_summary()
        self.assertEqual(data['analytics']['paid_orders'], 2)
        self.assertEqual(Decimal(data['analytics']['net_food_sales']), 90)
        self.assertEqual(data['forecast']['observed_portions_28_days'], 9)

    def test_staff_endpoint_empty_history_and_independence_from_ml_bundle(self):
        url = '/api/admin/predictive/local-forecast/'
        client = APIClient()
        self.assertEqual(client.get(url).status_code, 403)
        client.force_authenticate(self.buyer)
        self.assertEqual(client.get(url).status_code, 403)
        client.force_authenticate(self.owner)
        with patch('predictive_ai.service.bundle', side_effect=AssertionError('Genpact must not load')):
            response = client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'insufficient_history')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(client.get(url+'?center_id=13').status_code, 400)
