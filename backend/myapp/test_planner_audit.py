"""Planner regressions: notice is real, requests are not reservations, saves retry."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from .models import KitchenBlock, Order, OrderItem, Product, Storefront


class PlannerAuditTests(TestCase):
    def setUp(self):
        self.now = parse_datetime('2026-10-20T15:19:00+08:00')
        clock = patch('django.utils.timezone.now', return_value=self.now)
        clock.start(); self.addCleanup(clock.stop)
        self.owner = User.objects.create_user('planner-audit-owner', is_staff=True)
        self.buyer = User.objects.create_user('planner-audit-buyer')
        self.client = APIClient(); self.client.force_authenticate(self.owner)
        self.store = Storefront.objects.create(pk=1, delivery_buffer_minutes=90)
        self.product = Product.objects.create(name='Audit cookies', price=10, lead_hours=24,
            preparation_tasks=[dict(name='Bake', resource='oven', worker=False,
                minutes=40, max_wait_minutes=0)])
        with patch('django.utils.timezone.now', return_value=parse_datetime('2026-10-19T19:46:00+08:00')):
            self.order = Order.objects.create(user=self.buyer,
                delivery_at=parse_datetime('2026-10-20T16:00:00+08:00'),
                preparation_plan={'needs_review': True, 'tasks': []})
            OrderItem.objects.create(order=self.order, product=self.product,
                product_name=self.product.name, quantity=1, unit_price=10, subtotal=10)
        self.url = f'/api/admin/orders/{self.order.pk}/preparation-plan/'

    def future_delivery(self):
        self.order.delivery_at = parse_datetime('2026-10-21T18:00:00+08:00')
        self.order.save()

    def preview(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_reported_same_day_rejection_is_notice_not_missing_capacity(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('20 Oct 2026, 07:46 PM', str(response.data))
        self.order.refresh_from_db()
        self.assertTrue(self.order.preparation_plan['needs_review'])
        self.assertIsNone(self.order.preparation_at)
        self.assertFalse(self.order.amendments.exists())

    def test_later_delivery_preview_and_retry_reserve_once_without_changing_payment(self):
        self.future_delivery()
        preview = self.preview()
        self.order.refresh_from_db()
        self.assertIsNone(self.order.preparation_at)
        response = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['already_applied'])
        self.order.refresh_from_db()
        self.assertFalse(self.order.preparation_plan.get('needs_review', False))
        self.assertGreaterEqual(self.order.preparation_at, self.order.created_at+timedelta(hours=24))
        self.assertGreaterEqual(self.order.preparation_at, self.now)
        self.assertLessEqual(self.order.preparation_end_at, self.order.delivery_at-timedelta(minutes=90))
        saved_version = self.order.updated_at
        replay = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(replay.status_code, 200, replay.data)
        self.assertTrue(replay.data['already_applied'])
        self.order.refresh_from_db()
        self.assertEqual(self.order.updated_at, saved_version)
        self.assertEqual(self.order.amendments.count(), 1)
        self.assertEqual(self.order.status, 'pending')
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertFalse(self.order.inventory_deducted)

    def test_confirmation_retry_cannot_restore_an_old_plan_after_work_starts(self):
        self.future_delivery()
        preview = self.preview()
        first = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        Order.objects.filter(pk=self.order.pk).update(status='processing')
        replay = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(replay.status_code, 200, replay.data)
        self.assertTrue(replay.data['already_applied'])
        self.assertEqual(replay.data['order']['status'], 'processing')
        self.assertEqual(self.order.amendments.count(), 1)

    def test_confirmation_is_bound_to_the_owner_and_order(self):
        self.future_delivery()
        preview = self.preview()
        second = User.objects.create_user('second-owner', is_staff=True)
        self.client.force_authenticate(second)
        response = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(self.order.amendments.exists())
        self.client.force_authenticate(self.owner)
        other = Order.objects.create(user=self.buyer, delivery_at=self.order.delivery_at)
        response = self.client.post(f'/api/admin/orders/{other.pk}/preparation-plan/',
            {'confirm': preview['confirm']}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(other.amendments.exists())

    def test_changed_kitchen_availability_requires_another_preview(self):
        self.future_delivery()
        preview = self.preview()
        task = preview['preview']['plan']['tasks'][0]
        KitchenBlock.objects.create(start_at=task['start'], end_at=task['end'], reason='New closure')
        response = self.client.post(self.url, {'confirm': preview['confirm']}, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.preparation_at)
        self.assertFalse(self.order.amendments.exists())

    def test_replanning_preserves_accepted_notice_unless_current_settings_are_selected(self):
        self.future_delivery()
        self.product.lead_hours = 72; self.product.save()
        self.preview()  # Accepted notice is still 24 hours.
        response = self.client.post(self.url, {'adopt_current': True}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('22 Oct 2026, 07:46 PM', str(response.data))
        self.assertFalse(self.order.amendments.exists())

    def test_malformed_planning_payloads_return_validation_errors(self):
        self.future_delivery()
        for payload in [[], ['not an object'], {'confirm': []}, {'confirm': ''},
                {'confirm': {'bad': 'token'}}, {'adopt_current': 'not boolean'}]:
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
        manual = self.url.replace('preparation-plan/', 'manual-plan/')
        response = self.client.post(manual, [], format='json')
        self.assertEqual(response.status_code, 400, response.data)
        response = self.client.post(f'/api/orders/{self.order.pk}/reschedule/', [], format='json')
        self.assertEqual(response.status_code, 400, response.data)

    def test_owner_changes_delivery_and_confirms_preparation_in_one_transaction(self):
        target = '2026-10-23T18:04:00+08:00'
        preview = self.client.post(self.url, {'delivery_at': target, 'reason': 'Customer agreed Friday'}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.order.refresh_from_db()
        self.assertNotEqual(self.order.delivery_at, parse_datetime(target))
        self.assertIsNone(self.order.preparation_at)
        saved = self.client.post(self.url, {'confirm': preview.data['confirm']}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivery_at, parse_datetime(target))
        self.assertIsNotNone(self.order.preparation_at)
        self.assertFalse(self.order.preparation_plan.get('needs_review'))
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertFalse(self.order.inventory_deducted)
        history = self.client.get(f'/api/orders/{self.order.pk}/reschedule/').data['history']
        self.assertEqual(history[0]['reason'], 'Customer agreed Friday')
        self.assertEqual(history[0]['by'], 'owner')
        replay = self.client.post(self.url, {'confirm': preview.data['confirm']}, format='json')
        self.assertTrue(replay.data['already_applied'])
        self.assertEqual(self.order.amendments.count(), 1)

    def test_search_skips_impossible_dates_and_excludes_own_reservation(self):
        self.product.daily_capacity = 1
        self.product.save()
        result = self.client.post(self.url, {'find_next': True, 'search_from': '2026-10-20',
            'reason': 'Customer agreed suggested time'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        target = parse_datetime(result.data['preview']['delivery_at'])
        self.assertGreaterEqual(target, self.now+timedelta(hours=24))
        self.order.refresh_from_db()
        self.assertIsNone(self.order.preparation_at)
        self.assertEqual(self.client.post(self.url, {'confirm': result.data['confirm']}, format='json').status_code, 200)
        # Searching from the reserved day must count neither its own capacity nor equipment twice.
        result = self.client.post(self.url, {'find_next': True, 'search_from': target.date().isoformat(),
            'reason': 'Customer agreed suggested time'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(parse_datetime(result.data['preview']['delivery_at']).date(), target.date())

    def test_search_is_bounded_and_never_saves_a_review_only_request(self):
        KitchenBlock.objects.create(start_at=self.now, end_at=self.now+timedelta(days=8), reason='Closed all week')
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(self.url, {'find_next': True, 'reason': 'Customer agreed'}, format='json')
        self.assertLess(len(queries), 70)  # Read availability once per day, not once per hour.
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['preview'])
        self.assertNotIn('confirm', response.data)
        self.assertEqual(response.data['search']['through_date'], '2026-10-26')
        self.order.refresh_from_db()
        self.assertIsNone(self.order.preparation_at)
        self.assertFalse(self.order.amendments.exists())

    def test_new_delivery_respects_fresh_notice_and_requires_an_arrangement(self):
        early = self.client.post(self.url, {'delivery_at': '2026-10-21T16:00:00+08:00', 'reason': 'Agreed'}, format='json')
        self.assertEqual(early.status_code, 400)
        missing_reason = self.client.post(self.url, {'delivery_at': '2026-10-23T18:00:00+08:00'}, format='json')
        self.assertEqual(missing_reason.status_code, 400)
        self.assertFalse(self.order.amendments.exists())

    def test_changed_order_and_changed_kitchen_cannot_save_new_delivery(self):
        body = {'delivery_at': '2026-10-23T18:00:00+08:00', 'reason': 'Agreed'}
        preview = self.client.post(self.url, body, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        task = preview.data['preview']['plan']['tasks'][0]
        KitchenBlock.objects.create(start_at=task['start'], end_at=task['end'], reason='New booking')
        result = self.client.post(self.url, {'confirm': preview.data['confirm']}, format='json')
        self.assertIn(result.status_code, (400, 409), result.data)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.preparation_at)
        self.assertFalse(self.order.amendments.exists())
        version = self.order.updated_at.isoformat()
        self.order.save()
        result = self.client.post(self.url, dict(body, order_version=version), format='json')
        self.assertEqual(result.status_code, 409)

    def test_undated_order_can_preview_and_confirm_without_separate_request(self):
        self.order.delivery_at = None
        self.order.save()
        preview = self.client.post(self.url, {'delivery_at': '2026-10-23T18:00:00+08:00', 'reason': 'Agreed first date'}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        saved = self.client.post(self.url, {'confirm': preview.data['confirm']}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.preparation_at)
        self.assertIsNotNone(self.order.delivery_at)

    def test_customer_cannot_use_owner_delivery_and_plan_endpoint(self):
        self.client.force_authenticate(self.buyer)
        response = self.client.post(self.url, {'find_next': True}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.order.amendments.exists())
