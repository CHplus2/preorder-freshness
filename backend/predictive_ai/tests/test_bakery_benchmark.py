"""Benchmark target/leakage checks; fixtures are not forecasting evidence."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import pandas as pd

from backend.predictive_ai.benchmark_bakery import PRODUCTS, FEATURES, daily_history, features, scores


class BakeryBenchmarkTests(unittest.TestCase):
    def source(self, **extra):
        rows = [dict(date='2022-01-01', time='09:00', ticket_number=i + 1,
                     article=name, Quantity=10, unit_price='1,00 €') for i, name in enumerate(PRODUCTS)]
        rows += [dict(rows[0], Quantity=-2), dict(rows[0], date='2022-01-03', Quantity=5)]
        for row in rows:
            row.update(extra)
        return pd.DataFrame(rows)

    def test_signed_adjustments_are_kept_and_missing_days_are_recorded_zero(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'sales.csv'
            self.source().to_csv(path, index=False)
            frame, audit = daily_history(path)
        series = frame[frame.article == PRODUCTS[0]].recorded_units.tolist()
        self.assertEqual(series, [8, 0, 5])
        self.assertEqual(audit['source_negative_quantity_rows'], 1)
        self.assertEqual(audit['calendar_days_without_records'], 1)

    def test_nonfinite_or_negative_daily_totals_are_rejected(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'sales.csv'
            for quantity in (float('inf'), -10):
                self.source(Quantity=quantity).to_csv(path, index=False)
                with self.assertRaises(ValueError):
                    daily_history(path)

    def test_current_or_future_quantities_cannot_change_current_predictors(self):
        days = pd.date_range('2022-01-01', periods=40, freq='D')
        raw = pd.DataFrame({'article': 'CROISSANT', 'date': days, 'recorded_units': range(40)})
        before = features(raw)
        raw.loc[30:, 'recorded_units'] = 99999
        after = features(raw)
        pd.testing.assert_frame_equal(before.loc[:30, FEATURES], after.loc[:30, FEATURES])
        self.assertEqual(before.loc[30, 'lag7'], 23)
        self.assertEqual(before.loc[30, 'weekday_mean4'], (23 + 16 + 9 + 2) / 4)
        self.assertEqual(before.loc[30, 'rolling7'], sum(range(23, 30)) / 7)
        self.assertNotIn('recorded_units', FEATURES)
        self.assertNotIn('unit_price', FEATURES)

    def test_lags_never_cross_product_boundaries(self):
        days = pd.date_range('2022-01-01', periods=10, freq='D')
        raw = pd.concat([pd.DataFrame({'article': item, 'date': days, 'recorded_units': value})
                         for item, value in [('BAGUETTE', 100), ('CROISSANT', 2)]], ignore_index=True)
        frame = features(raw)
        self.assertEqual(frame[frame.article == 'CROISSANT'].iloc[-1].lag7, 2)
        self.assertEqual(frame[frame.article == 'BAGUETTE'].iloc[-1].lag7, 100)

    def test_wape_definition(self):
        self.assertAlmostEqual(scores(pd.Series([10, 20]), [8, 22])['wape_percent'], 100 * 4 / 30)
        self.assertIsNone(scores(pd.Series([0, 0]), [1, 2])['wape_percent'])
