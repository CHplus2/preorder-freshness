from datetime import timedelta
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient
from . import test_local_planning as fixtures
from .models import InventoryItem


class LocalScenarioTests(TestCase):
    setUp = fixtures.LocalPlanningTests.setUp
    order = fixtures.LocalPlanningTests.order
    batch = fixtures.LocalPlanningTests.batch
    def purchase(self, **changes):
        values = dict(horizon_days=7, raw_material_id=self.material.pk, quantity='150', unit_cost='0.02',
                      arrival_date=str(self.start.date()), expiry_date=str(self.start.date() + timedelta(days=5)))
        values.update(changes)
        return values

    def test_purchase_covers_shortage_and_does_not_write(self):
        self.order()
        batch = self.batch(50)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.post('/api/admin/predictive/local-scenario/', self.purchase(), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(all(q['sql'].lstrip().upper().startswith('SELECT') for q in queries))
        self.assertEqual(response.data['baseline']['ingredient_risks'][0]['shortfall_quantity'], 150)
        self.assertEqual(response.data['scenario']['ingredient_risks'][0]['shortfall_quantity'], 0)
        self.assertEqual(response.data['scenario']['coverage']['hypothetical_batches'], 1)
        self.assertEqual(InventoryItem.objects.count(), 1)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 50)

    def test_late_arrival_and_early_expiry_do_not_cover_shortage(self):
        self.order(preparation_end_at=self.start + timedelta(days=1), delivery_at=self.start + timedelta(days=1, hours=3))
        for changes in ({'arrival_date': str(self.start.date() + timedelta(days=1))},
                        {'expiry_date': str(self.start.date())}):
            response = self.client.post('/api/admin/predictive/local-scenario/', self.purchase(**changes), format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['scenario']['ingredient_risks'][0]['shortfall_quantity'], 200)

    def test_overbuying_creates_expiry_exposure_and_unknown_cost_stays_null(self):
        self.order()
        response = self.client.post('/api/admin/predictive/local-scenario/', self.purchase(quantity='300', unit_cost=None,
                                   expiry_date=str(self.start.date())), format='json')
        risk = response.data['scenario']['ingredient_risks'][0]
        self.assertEqual(risk['shortfall_quantity'], 0)
        self.assertEqual(risk['expiring_unused_quantity'], 100)
        self.assertIsNone(risk['potential_waste_cost_myr'])

    def test_permissions_csrf_and_invalid_inputs(self):
        url = '/api/admin/predictive/local-scenario/'
        anon = APIClient()
        self.assertEqual(anon.post(url, self.purchase(), format='json').status_code, 403)
        anon.force_authenticate(self.buyer)
        self.assertEqual(anon.post(url, self.purchase(), format='json').status_code, 403)
        csrf = APIClient(enforce_csrf_checks=True)
        csrf.force_login(self.staff)
        self.assertEqual(csrf.post(url, self.purchase(), format='json').status_code, 403)
        self.assertEqual(self.client.get(url).status_code, 405)
        for body in ([1], self.purchase(quantity='NaN'), self.purchase(quantity='-1'),
                     self.purchase(raw_material_id=99999), self.purchase(unknown=1),
                     self.purchase(horizon_days=29), self.purchase(unit_cost='-1'),
                     self.purchase(arrival_date=str(self.today - timedelta(days=1))),
                     self.purchase(expiry_date=str(self.today - timedelta(days=1)))):
            self.assertEqual(self.client.post(url, body, format='json').status_code, 400, body)
