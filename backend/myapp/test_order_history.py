"""Bounded customer history with private counts and stable ID pagination."""
from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from .models import Order


class OrderHistoryTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('history-buyer')
        self.other = User.objects.create_user('history-other')
        self.client = APIClient(); self.client.force_authenticate(self.buyer)
        self.current = []; self.history = []
        for index in range(30):
            status = 'pending' if index % 2 else 'delivered'
            order = Order.objects.create(user=self.buyer, status=status)
            (self.current if status == 'pending' else self.history).append(order.pk)
            Order.objects.create(user=self.other, status='pending')

    def test_default_is_bounded_and_counts_never_include_other_customers(self):
        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['counts'], dict(all=30, current=15, history=15))
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['view'], 'all')
        self.assertEqual(response.data['next_before'], response.data['results'][-1]['id'])
        self.assertTrue(all(row['user']['id'] == self.buyer.pk for row in response.data['results']))
        self.assertIn('no-store', response['Cache-Control'])

    def test_view_filters_counts_and_auto_selection(self):
        for view, expected in [('current', self.current), ('history', self.history)]:
            response = self.client.get('/api/orders/', dict(view=view))
            self.assertEqual([row['id'] for row in response.data['results']], sorted(expected, reverse=True)[:10])
            self.assertEqual(response.data['count'], 15)
        self.assertEqual(self.client.get('/api/orders/', dict(view='auto')).data['view'], 'current')
        Order.objects.filter(pk__in=self.current).update(status='cancelled')
        self.assertEqual(self.client.get('/api/orders/', dict(view='auto')).data['view'], 'history')
        self.assertEqual(self.client.get('/api/orders/', dict(view='current')).data['results'], [])

    def test_cursor_survives_new_order_without_duplicates_or_missing_older_rows(self):
        first = self.client.get('/api/orders/', dict(view='current')).data
        Order.objects.create(user=self.buyer, status='pending')
        second = self.client.get('/api/orders/', dict(view='current', before=first['next_before'])).data
        ids = [row['id'] for row in first['results']+second['results']]
        self.assertEqual(ids, sorted(self.current, reverse=True))
        self.assertEqual(len(set(ids)), len(ids)); self.assertIsNone(second['next_before'])
        self.assertEqual(second['counts']['current'], 16)

    def test_unknown_status_stays_visible_and_empty_account_has_valid_metadata(self):
        unknown = Order.objects.create(user=self.buyer, status='future-stage')
        response = self.client.get('/api/orders/', dict(view='current')).data
        self.assertEqual(response['results'][0]['id'], unknown.pk)
        empty = User.objects.create_user('empty-history')
        self.client.force_authenticate(empty)
        response = self.client.get('/api/orders/', dict(view='auto')).data
        self.assertEqual(response['counts'], dict(all=0, current=0, history=0))
        self.assertEqual(response['results'], []); self.assertIsNone(response['next_before'])
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/orders/').status_code, [401, 403])

    def test_malformed_duplicate_and_unknown_filters_are_rejected(self):
        for query in ['view=wrong', 'before=0', 'before=-1', 'before=1.5', 'before=1e6',
                'before=999999999999999999999999999999', 'before=%EF%BC%91',
                'view=current&view=history', 'before=1&before=2', 'user=1']:
            self.assertEqual(self.client.get('/api/orders/?'+query).status_code, 400, query)

    def test_response_and_query_count_are_bounded_with_large_history(self):
        with CaptureQueriesContext(connection) as initial:
            first = self.client.get('/api/orders/', dict(view='history'))
        Order.objects.bulk_create([Order(user=self.buyer, status='delivered') for _ in range(1000)])
        with CaptureQueriesContext(connection) as large:
            response = self.client.get('/api/orders/', dict(view='history'))
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], 1015)
        self.assertLess(len(response.content), len(first.content)+500)
        self.assertEqual(len(initial), len(large)); self.assertLessEqual(len(large), 3)
        self.assertTrue(all(query['sql'].lstrip().upper().startswith('SELECT') for query in large))
