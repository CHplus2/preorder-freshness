"""Read-only operational reports; no real emails, payments or stock changes."""
import csv
import io
import uuid
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from .models import Order, OrderItem, Product, Storefront, Address, PaymentEvent

MY = ZoneInfo('Asia/Kuala_Lumpur')


class ClientReportTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('report-owner', is_staff=True)
        self.buyer = User.objects.create_user('private-buyer')
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        Storefront.objects.create(pk=1, name='Local kitchen')
        self.product = Product.objects.create(name='Current menu name', price='999.00')
        self.when = datetime(2026, 11, 3, 8, 30, tzinfo=MY)

    def order(self, **changes):
        values = dict(user=self.buyer, ordering_mode='simple', status='pending', payment_status='unpaid',
            total_amount='25.00', discount_amount='5.00', shipping_fee='4.50', delivery_at=self.when,
            fulfilment_snapshot={'customer': {'name': 'Accepted buyer', 'phone': '+60123456789'}},
            delivery_address={'recipient_name': 'Accepted buyer', 'phone': '+60123456789', 'line1': 'Saved street'})
        values.update(changes)
        order = Order.objects.create(**values)
        OrderItem.objects.create(order=order, product=self.product, product_name='Accepted menu',
            unit_price='10.00', quantity=3, subtotal='30.00')
        return order

    def daily(self, **params):
        return self.client.get('/api/admin/reports/daily-orders/', dict(date='2026-11-03', **params))

    def sales(self, **params):
        return self.client.get('/api/admin/reports/period-sales/', dict(start='2026-11-03', end='2026-11-03', **params))

    def test_reports_and_print_are_staff_only_and_read_only(self):
        order = self.order()
        urls = ['/api/admin/reports/daily-orders/?date=2026-11-03',
            '/api/admin/reports/period-sales/?start=2026-11-03&end=2026-11-03',
            '/api/admin/reports/period-sales/export/?start=2026-11-03&end=2026-11-03',
            f'/api/admin/orders/{order.pk}/slip/']
        for actor in [None, self.buyer]:
            self.client.force_authenticate(actor)
            for url in urls:
                with self.subTest(actor=actor, url=url):
                    response = self.client.get(url)
                    self.assertIn(response.status_code, [401, 403])
                    self.assertNotIn(b'Accepted buyer', response.content)
        self.client.force_authenticate(self.staff)
        for url in urls:
            self.assertEqual(self.client.post(url, {}).status_code, 405)

    def test_daily_has_all_active_statuses_but_not_cancelled_or_generated(self):
        self.order()
        self.order(status='delivered', payment_status='paid')
        self.order(status='cancelled')
        generated = self.order(status='delivered', payment_status='paid',
            payment_instructions={'freshcast_synthetic_history': {'version': '1'}})
        data = self.daily().json()
        self.assertEqual(data['count'], 2)
        self.assertEqual(data['received_count'], 1)
        self.assertEqual(data['cancelled_count'], 1)
        self.assertEqual(data['quantity'], 6)
        self.assertEqual(data['order_value'], '59.00')
        self.assertEqual(data['menus'][0]['quantity'], 6)
        self.assertNotIn(generated.pk, [o['id'] for o in data['orders']])

    def test_daily_uses_malaysia_midnight_and_excludes_null_dates(self):
        first = self.order(delivery_at=datetime(2026, 11, 2, 16, tzinfo=ZoneInfo('UTC')))
        last = self.order(delivery_at=datetime(2026, 11, 3, 15, 59, 59, tzinfo=ZoneInfo('UTC')))
        self.order(delivery_at=datetime(2026, 11, 3, 16, tzinfo=ZoneInfo('UTC')))
        self.order(delivery_at=datetime(2026, 11, 2, 15, 59, 59, tzinfo=ZoneInfo('UTC')))
        self.order(delivery_at=None)
        self.assertEqual([o['id'] for o in self.daily().json()['orders']], [first.pk, last.pk])

    def test_daily_receipt_filter_keeps_menu_totals_and_orders_in_the_same_scope(self):
        pending=self.order()
        received=self.order(status='delivered',payment_status='paid')
        self.order(status='cancelled')
        for scope,expected in [('all',[pending.pk,received.pk]),('not_received',[pending.pk]),('received',[received.pk])]:
            data=self.daily(receipt=scope).json()
            self.assertEqual(data['receipt'],scope)
            self.assertEqual(data['day_count'],2)
            self.assertEqual(data['day_received_count'],1)
            self.assertEqual(data['day_not_received_count'],1)
            self.assertEqual(data['count'],len(expected))
            self.assertEqual(data['quantity'],len(expected)*3)
            self.assertEqual(data['menus'][0]['quantity'],len(expected)*3)
            self.assertEqual([row['id'] for row in data['orders']],expected)
        self.assertEqual(self.daily(receipt='paid').status_code,400)

    def test_daily_counts_undated_open_orders_without_using_placement_date(self):
        self.order(delivery_at=None)
        self.order(delivery_at=None,status='delivered')
        self.order(delivery_at=None,status='cancelled')
        self.order(delivery_at=None,payment_instructions={'freshcast_synthetic_history':{'version':'1'}})
        current=self.order()
        data=self.daily().json()
        self.assertEqual(data['undated_open_count'],1)
        self.assertEqual(data['count'],1);self.assertEqual(data['quantity'],3)
        self.assertEqual([row['id'] for row in data['orders']],[current.pk])
        self.assertEqual(Order.objects.filter(delivery_at__isnull=True).count(),4)

    def test_retired_test_methods_without_event_rows_are_not_real_sales(self):
        for method in ('paypal','escrow','wallet','synthetic_demo'):
            self.order(status='delivered',payment_status='paid',payment_method=method)
        self.order(status='delivered',payment_status='paid',payment_method='manual')
        result=self.sales().json();self.assertEqual(result['paid_received_orders'],1)
        self.assertEqual(result['excluded_test_orders'],4);self.assertEqual(result['total_sales'],'29.50')
        self.assertEqual(Order.objects.filter(payment_status='paid').count(),5)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_sales_counts_orders_once_with_multiple_lines_and_discount(self):
        order = self.order(status='delivered', payment_status='paid')
        OrderItem.objects.create(order=order, product=None, product_name='Deleted menu', unit_price='2.50', quantity=2, subtotal='5.00')
        self.order(payment_status='paid')
        self.order(status='delivered')
        self.order(status='delivered', payment_status='refunded')
        self.order(status='cancelled', payment_status='paid')
        data = self.sales().json()
        self.assertEqual(data['paid_received_orders'], 1)
        self.assertEqual(data['net_food_sales'], '25.00')
        self.assertEqual(data['delivery_income'], '4.50')
        self.assertEqual(data['discounts'], '5.00')
        self.assertEqual(data['total_sales'], '29.50')
        self.assertEqual(data['unpaid_received_orders'], 1)
        self.assertEqual(sum(Decimal(row['gross_food']) for row in data['menus']), Decimal('35'))
        self.assertEqual(data['days'][0]['date'], '2026-11-03')

    def test_generated_and_completed_test_payments_do_not_become_sales(self):
        self.order(status='delivered', payment_status='paid',
            payment_instructions={'freshcast_synthetic_history': {'version': '1'}})
        for source in ['paypal_sandbox', 'escrow_sepolia']:
            order = self.order(status='delivered', payment_status='paid')
            PaymentEvent.objects.create(order=order, request_id=uuid.uuid4(), kind='receipt', outcome='completed',
                amount='29.50', method='paypal', reference='test', source=source)
        actual = self.order(status='delivered', payment_status='paid')
        PaymentEvent.objects.create(order=actual, request_id=uuid.uuid4(), kind='receipt', outcome='failed',
            amount='29.50', method='paypal', reference='failed', source='paypal_sandbox')
        data = self.sales().json()
        self.assertEqual(data['paid_received_orders'], 1)
        self.assertEqual(data['excluded_test_orders'], 2)
        self.assertEqual(data['net_food_sales'], '25.00')

    def test_missing_dates_are_reported_without_inventing_delivery_dates(self):
        self.order(status='delivered', payment_status='paid', delivery_at=None)
        data = self.sales().json()
        self.assertEqual(data['unscheduled_orders'], 1)
        self.assertEqual(data['paid_received_orders'], 0)
        self.assertEqual(data['net_food_sales'], '0.00')
        self.assertEqual(data['days'], [])

    def test_wallet_and_fictional_maintenance_receipts_are_not_business_sales(self):
        # Imported wallet orders might predate the payment ledger.
        self.order(status='delivered', payment_status='paid', payment_method='wallet')
        self.order(status='delivered', payment_status='paid', payment_method='synthetic_demo')
        for source in ['demo_wallet', 'fictional_demo', 'synthetic_history']:
            order = self.order(status='delivered', payment_status='paid')
            PaymentEvent.objects.create(order=order, request_id=uuid.uuid4(), kind='receipt',
                outcome='completed', amount='29.50', method='demo', source=source, reference='Fictional fixture')
        self.order(status='delivered', payment_status='paid')
        data = self.sales().json()
        self.assertEqual(data['paid_received_orders'], 1)
        self.assertEqual(data['excluded_test_orders'], 5)
        self.assertEqual(data['total_sales'], '29.50')
        response = self.client.get('/api/admin/reports/period-sales/export/',
            {'start': '2026-11-03', 'end': '2026-11-03'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('Total,25.00,4.50,29.50', response.content.decode())

    def test_unscheduled_demo_credit_orders_do_not_become_missing_business_sales(self):
        self.order(status='delivered', payment_status='paid', delivery_at=None, payment_method='wallet')
        order = self.order(status='delivered', payment_status='paid', delivery_at=None)
        PaymentEvent.objects.create(order=order, request_id=uuid.uuid4(), kind='receipt', outcome='completed',
            amount='29.50', method='demo', source='fictional_demo', reference='Fictional fixture')
        self.assertEqual(self.sales().json()['unscheduled_orders'], 0)

    def test_calendar_edges_fail_validation_instead_of_server_error(self):
        for day in ['9999-12-31', '0001-01-01']:
            self.assertEqual(self.client.get('/api/admin/reports/daily-orders/', {'date': day}).status_code, 400)
            self.assertEqual(self.client.get('/api/admin/reports/period-sales/', {'start': day, 'end': day}).status_code, 400)

    def test_invalid_dates_range_and_page_are_rejected(self):
        for query in [{'date': 'not-date'}, {'date': '2026-02-30'}, {'date': '2026-11-03', 'page': 0},
                      {'date': '2026-11-03', 'page': '2.5'}, {}]:
            self.assertEqual(self.client.get('/api/admin/reports/daily-orders/', query).status_code, 400)
        for query in [{'start': '2026-11-03', 'end': '2026-11-02'}, {'start': '2025-01-01', 'end': '2026-11-03'},
                      {'start': 'x', 'end': '2026-11-03'}, {}]:
            self.assertEqual(self.client.get('/api/admin/reports/period-sales/', query).status_code, 400)

    def test_pagination_does_not_truncate_summary_totals(self):
        for _ in range(51):
            self.order()
        first, second = self.daily().json(), self.daily(page=2).json()
        self.assertEqual(first['count'], 51)
        self.assertEqual(len(first['orders']), 50)
        self.assertTrue(first['has_more'])
        self.assertEqual(len(second['orders']), 1)
        self.assertFalse(second['has_more'])
        self.assertEqual(second['quantity'], 153)
        self.assertEqual(first['menus'], second['menus'])
        self.assertEqual(first['food_total'], '1275.00')
        self.assertTrue(set(o['id'] for o in first['orders']).isdisjoint(o['id'] for o in second['orders']))

    def test_report_queries_do_not_grow_per_order_or_join_proof_bytes(self):
        self.order()
        with CaptureQueriesContext(connection) as one:
            self.assertEqual(self.daily().status_code, 200)
        for _ in range(6):
            self.order()
        with CaptureQueriesContext(connection) as many:
            self.assertEqual(self.daily().status_code, 200)
        self.assertEqual(len(one), len(many))
        self.assertLessEqual(len(many), 10)
        self.assertNotIn('checkoutproof', ' '.join(row['sql'] for row in many).lower())

    def test_slip_uses_accepted_identity_address_and_prices(self):
        order = self.order(fulfilment_snapshot={'customer': {'name': '<script>buyer</script>', 'phone': '+60123456789'},
            'handover': {'mode': 'agreed_place', 'location': 'Porch', 'notes': 'Please call'}, 'arrival_window_minutes': 30})
        data = self.client.get(f'/api/admin/orders/{order.pk}/slip/').json()
        self.assertEqual(data['name'], '<script>buyer</script>')  # React text rendering escapes it.
        self.assertEqual(data['phone'], '+60123456789')
        self.assertEqual(data['address_lines'], ['Saved street'])
        self.assertEqual(data['items'][0]['name'], 'Accepted menu')
        self.assertEqual(data['items'][0]['unit_price'], '10.00')
        self.assertEqual(data['arrival_window']['minutes'], 30)
        self.assertEqual(data['handover_location'], 'Porch')
        self.assertEqual(data['kitchen'], 'Local kitchen')
        self.assertNotIn('payment_instructions', data)
        self.assertNotIn('email', data)

    def test_pickup_slip_has_customer_phone_and_collection_snapshot_not_old_address(self):
        order = self.order(delivery_method='pickup', fulfilment_snapshot={'customer': {'name': 'Collector',
            'phone': '+60123456789'}, 'pickup_location': 'Accepted kitchen location'})
        data = self.client.get(f'/api/admin/orders/{order.pk}/slip/').json()
        self.assertEqual(data['address_lines'], [])
        self.assertEqual(data['pickup_location'], 'Accepted kitchen location')
        self.assertEqual(data['phone'], '+60123456789')

    def test_legacy_address_fallback_and_missing_slips(self):
        address = Address.objects.create(user=self.buyer, recipient_name='Legacy recipient', phone='0123456789',
            line1='Legacy street', city='Kuching', state='Sarawak', postal_code='93000')
        order = self.order(delivery_address={}, fulfilment_snapshot={}, address=address)
        data = self.client.get(f'/api/admin/orders/{order.pk}/slip/').json()
        self.assertEqual(data['name'], 'Legacy recipient')
        self.assertIn('Legacy street', data['address_lines'])
        self.assertEqual(self.client.get('/api/admin/orders/999999/slip/').status_code, 404)
        generated = self.order(payment_instructions={'freshcast_synthetic_history': {'version': '1'}})
        self.assertEqual(self.client.get(f'/api/admin/orders/{generated.pk}/slip/').status_code, 404)

    def test_csv_is_complete_private_and_formula_safe(self):
        order = self.order(status='delivered', payment_status='paid')
        OrderItem.objects.filter(order=order).update(product_name='=HYPERLINK("https://invalid")')
        response = self.client.get('/api/admin/reports/period-sales/export/', {'start': '2026-11-03', 'end': '2026-11-03'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        rows = list(csv.reader(io.StringIO(response.content.decode('utf-8-sig'))))
        self.assertEqual(rows[-1], ['\'=HYPERLINK("https://invalid")', '3', '30.00'])
        self.assertIn(['Total', '25.00', '4.50', '29.50'], rows)
        self.assertNotIn('Accepted buyer', response.content.decode())

    def test_reads_leave_stock_payment_and_order_versions_unchanged(self):
        order = self.order(status='delivered', payment_status='paid')
        before = Order.objects.values().get(pk=order.pk)
        self.daily()
        self.sales()
        response = self.client.get(f'/api/admin/orders/{order.pk}/slip/')
        self.assertIn('private', response['Cache-Control'])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(Order.objects.values().get(pk=order.pk), before)
        self.assertEqual(PaymentEvent.objects.count(), 0)
