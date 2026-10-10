"""Fixtures verify export boundaries; none are used to train a model."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from backend.predictive_ai.local_preorders import audit, snapshot


class LocalPreorderTests(unittest.TestCase):
    def orders(self):
        return [{'id': 1, 'created_at': '2026-09-01T12:00:00+08:00',
                 'delivery_at': '2026-09-06T15:00:00+08:00', 'status': 'delivered',
                 'payment_status': 'paid', 'user': 'private-customer',
                 'delivery_address': {'street': 'private-address'},
                 'items': [{'id': 10, 'product': 2, 'quantity': 3,
                            'product_name': 'mutable dish', 'unit_price': '12.00'}]}]

    def products(self):
        return [{'id': 2, 'created_at': '2026-08-01T12:00:00+08:00', 'name': 'mutable dish'}]

    def make_snapshot(self, orders=None, products=None, provenance='business_history', **kwargs):
        return snapshot(orders if orders is not None else self.orders(),
                        products if products is not None else self.products(),
                        as_of='2026-10-10T10:00:00+08:00', provenance=provenance, **kwargs)

    def test_minimal_projection_preserves_quantity_and_has_no_customer_or_price(self):
        data = self.make_snapshot()
        encoded = json.dumps(data)
        for forbidden in ['private-customer', 'private-address', 'mutable dish', 'unit_price', 'user']:
            self.assertNotIn(forbidden, encoded)
        report, rows = audit(data)
        self.assertEqual(rows, [{'week_start': '2026-08-31', 'product_id': 2, 'observed_portions': 3}])
        self.assertEqual(report['eligible_orders'], 1)
        self.assertEqual(report['training_status'], 'blocked')  # Availability is still unverified.

    def test_missing_delivery_is_never_replaced_with_created_date(self):
        orders = self.orders()
        orders[0]['delivery_at'] = None
        report, rows = audit(self.make_snapshot(orders))
        self.assertEqual(rows, [])
        self.assertEqual(report['excluded_orders_by_reason'], {'missing_delivery_date': 1})
        self.assertIsNone(report['model_wape_percent'])

    def test_cancellation_pending_and_refund_are_not_fulfilled_demand(self):
        for status, payment in [('cancelled', 'paid'), ('delivered', 'refunded'), ('pending', 'paid')]:
            with self.subTest(status=status, payment=payment):
                orders = self.orders()
                orders[0].update(status=status, payment_status=payment)
                self.assertEqual(audit(self.make_snapshot(orders))[1], [])

    def test_future_and_current_incomplete_weeks_are_excluded(self):
        for delivery, reason in [('2026-10-09T12:00:00+08:00', 'incomplete_delivery_week'),
                                 ('2026-10-12T12:00:00+08:00', 'invalid_or_future_dates'),
                                 ('2026-08-30T12:00:00+08:00', 'invalid_or_future_dates')]:
            with self.subTest(delivery=delivery):
                orders = self.orders()
                orders[0]['delivery_at'] = delivery
                report, rows = audit(self.make_snapshot(orders))
                self.assertEqual(rows, [])
                self.assertEqual(report['excluded_orders_by_reason'], {reason: 1})

    def test_relabelled_demo_cannot_be_promoted_as_real_demand(self):
        report, _ = audit(self.make_snapshot(provenance='fictional_demo', catalogue_relabelled=True))
        self.assertFalse(report['candidate_model_trained'])
        self.assertTrue(any('fictional' in reason for reason in report['blockers']))
        self.assertTrue(any('reassigned' in reason for reason in report['blockers']))

    def test_no_product_history_before_identity_creation_and_no_zero_backfill(self):
        products = self.products()
        products[0]['created_at'] = '2026-10-01T12:00:00+08:00'
        report, rows = audit(self.make_snapshot(products=products))
        self.assertEqual(rows, [])
        self.assertEqual(report['excluded_orders_by_reason'], {'product_created_after_delivery': 1})
        report, rows = audit(self.make_snapshot())
        self.assertEqual(len(rows), 1)
        self.assertEqual(report['eligible_observed_weeks'], 1)

    def test_duplicate_records_bad_quantity_and_naive_timestamps_fail(self):
        bad = self.orders() * 2
        with self.assertRaisesRegex(ValueError, 'Duplicate order'):
            self.make_snapshot(bad)
        for value in [True, 0, -1, 1.5]:
            bad = self.orders()
            bad[0]['items'][0]['quantity'] = value
            with self.assertRaises(ValueError):
                self.make_snapshot(bad)
        bad = self.orders()
        bad[0]['created_at'] = '2026-09-01T12:00:00'
        with self.assertRaisesRegex(ValueError, 'timezone'):
            self.make_snapshot(bad)

    def test_offline_replay_is_deterministic_and_blocked_exit_stops_training(self):
        root = Path(__file__).resolve().parents[3]
        with TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / 'source.json'
            data = self.make_snapshot()
            data['orders'][0]['user'] = 'private-offline-customer'
            source.write_text(json.dumps(data))
            reports = []
            for name in ['first', 'second']:
                output = directory / name
                result = subprocess.run([sys.executable, str(root / 'scripts/audit_local_preorders.py'),
                                         '--snapshot', str(source), '--output-dir', str(output)],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 2, result.stderr)
                reports.append((output / 'readiness.json').read_bytes())
                self.assertEqual((output / 'snapshot.json').stat().st_mode & 0o777, 0o600)
                self.assertNotIn('private-offline-customer', (output / 'snapshot.json').read_text())
            self.assertEqual(reports[0], reports[1])
            result = subprocess.run([sys.executable, str(root / 'scripts/audit_local_preorders.py'),
                                     '--snapshot', str(source), '--output-dir', str(directory / 'first')],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn('preserve previous exports', result.stderr.lower())
