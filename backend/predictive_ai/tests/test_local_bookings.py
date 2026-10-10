"""Chronology and target checks; test fixtures never train candidate artifacts."""
import unittest

import pandas as pd

from backend.predictive_ai.local_preorders import snapshot
from backend.predictive_ai.train_local_bookings import FEATURES, booking_history, features, scores, split


class LocalBookingTests(unittest.TestCase):
    def data(self):
        orders = [{'id': 1, 'created_at': '2026-09-06T23:59:00+08:00', 'delivery_at': None,
                   'status': 'cancelled', 'payment_status': 'refunded',
                   'items': [{'id': 1, 'product': 1, 'quantity': 3}]},
                  {'id': 2, 'created_at': '2026-09-14T12:00:00+08:00', 'delivery_at': None,
                   'status': 'pending', 'payment_status': 'unpaid',
                   'items': [{'id': 2, 'product': 1, 'quantity': 5}]},
                  {'id': 3, 'created_at': '2026-10-05T00:00:00+08:00', 'delivery_at': None,
                   'status': 'pending', 'payment_status': 'unpaid',
                   'items': [{'id': 3, 'product': 1, 'quantity': 99}]}]
        return snapshot(orders, [{'id': 1, 'created_at': '2026-10-01T12:00:00+08:00'}],
                        as_of='2026-10-10T20:00:00+08:00', provenance='fictional_demo', catalogue_relabelled=True)

    def test_zero_recorded_week_assumption_must_be_explicit(self):
        with self.assertRaisesRegex(ValueError, 'Explicitly acknowledge'):
            booking_history(self.data())

    def test_booking_target_includes_gross_intent_and_excludes_incomplete_week(self):
        history, counts = booking_history(self.data(), assume_recorded_zero_weeks=True)
        self.assertEqual(history.week_start.iloc[0].date().isoformat(), '2026-08-31')
        self.assertEqual(history.week_start.iloc[-1].date().isoformat(), '2026-09-28')
        self.assertEqual(history.recorded_portions.tolist(), [3, 0, 5, 0, 0])
        self.assertEqual(counts['excluded_current_or_future_week_orders'], 1)
        self.assertEqual(counts['included_orders'], 2)

    def test_final_status_and_menu_relabel_do_not_change_aggregate_target(self):
        data = self.data()
        before, _ = booking_history(data, assume_recorded_zero_weeks=True)
        data['orders'][0].update(status='delivered', payment_status='paid')
        data['products'][0]['created_at'] = '2020-01-01T12:00:00+08:00'
        after, _ = booking_history(data, assume_recorded_zero_weeks=True)
        pd.testing.assert_frame_equal(before, after)

    def test_current_and_future_targets_do_not_leak_into_predictors(self):
        history = pd.DataFrame({'week_start': pd.date_range('2026-01-05', periods=16, freq='W-MON'),
                                'recorded_portions': list(range(16))})
        before = features(history)
        changed = history.copy()
        changed.loc[12:, 'recorded_portions'] = 99999
        after = features(changed)
        pd.testing.assert_frame_equal(before.loc[:12, FEATURES], after.loc[:12, FEATURES])
        self.assertEqual(before.iloc[12].rolling4, sum(range(8, 12)) / 4)
        self.assertNotIn('recorded_portions', FEATURES)
        train, valid = split(before)
        self.assertLess(train.week_start.max(), valid.week_start.min())
        self.assertEqual(len(valid), 4)

    def test_empty_or_insufficient_completed_history_cannot_train(self):
        data = self.data()
        data['orders'] = data['orders'][2:]
        with self.assertRaisesRegex(ValueError, 'No completed'):
            booking_history(data, assume_recorded_zero_weeks=True)
        with self.assertRaisesRegex(ValueError, 'eight earlier'):
            split(pd.DataFrame({'week_start': []}), 4)

    def test_wape_is_undefined_for_zero_actual_holdout(self):
        self.assertIsNone(scores([0, 0], [1, 2])['wape_percent'])
        self.assertAlmostEqual(scores([10, 20], [8, 22])['wape_percent'], 100 * 4 / 30)
