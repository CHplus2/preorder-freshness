from datetime import date, timedelta
from types import SimpleNamespace
from django.test import SimpleTestCase
from .services.freshness import inventory_summary

class FreshnessSummaryTests(SimpleTestCase):
    def lot(self, **changes):
        values = dict(quantity=1, received_date=date(2026, 9, 20),
                      expiry_date=date(2026, 9, 30), expiry_basis='label',
                      manufactured_date=None, guidance_note='', quarantined=False)
        values.update(changes)
        return SimpleNamespace(**values)

    def test_remaining_is_calculated_from_dates(self):
        result = inventory_summary([self.lot()], date(2026, 9, 25))
        self.assertEqual(result['average_remaining_percent'], 50)

    def test_manufactured_uses_manufacturing_start(self):
        lot = self.lot(expiry_basis='manufactured', manufactured_date=date(2026, 9, 10),
                       guidance_note='Supplier refrigerated instructions')
        self.assertEqual(inventory_summary([lot], date(2026, 9, 25))['average_remaining_percent'], 25)

    def test_held_and_expired_are_not_hidden(self):
        result = inventory_summary([self.lot(), self.lot(quarantined=True),
                    self.lot(expiry_date=date(2026, 9, 24))], date(2026, 9, 25))
        self.assertEqual(result['average_remaining_percent'], 16.7)
        self.assertEqual(result['held_batches'], 1)
        self.assertEqual(result['expired_batches'], 1)

    def test_unknown_and_empty_do_not_invent_scores(self):
        result = inventory_summary([self.lot(expiry_basis='storage'),
                    self.lot(quantity=0), self.lot(received_date=date(2026, 9, 26))], date(2026, 9, 25))
        self.assertIsNone(result['average_remaining_percent'])
        self.assertEqual(result['unknown_batches'], 1)
        self.assertEqual(result['recorded_batches'], 1)

    def test_empty_inventory(self):
        self.assertIsNone(inventory_summary([], date(2026, 9, 25))['average_remaining_percent'])
