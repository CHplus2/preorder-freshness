"""Isolated feature and metric checks; synthetic fixtures never train a model."""
import unittest
import pandas as pd
from backend.predictive_ai.forecast_core import FEATURES, historical_features, future_rows, read_data
from backend.predictive_ai.train_model import wape
from tempfile import TemporaryDirectory


class ForecastTests(unittest.TestCase):
    def history(self):
        return pd.DataFrame([dict(center_id=1, meal_id=2, week=w, num_orders=n,
            category='fixture', cuisine='fixture', center_type='fixture', op_area=10,
            checkout_price=20, base_price=25, emailer_for_promotion=0,
            homepage_featured=0) for w, n in [(1,10),(2,20),(4,30),(5,40)]])

    def test_current_and_future_targets_do_not_leak(self):
        data=self.history()
        before=historical_features(data)
        data.loc[data.week>=4,'num_orders']=99999
        after=historical_features(data)
        pd.testing.assert_frame_equal(before.loc[:2,FEATURES],after.loc[:2,FEATURES])
        self.assertNotIn('num_orders',FEATURES)

    def test_lags_use_observations_not_imputed_missing_weeks(self):
        rows=historical_features(self.history())
        self.assertEqual(rows.iloc[2].lag1,20)
        self.assertEqual(rows.iloc[2].weeks_since_last,2)
        self.assertEqual(rows.iloc[2].rolling4,15)

    def test_future_shape_and_past_only_history(self):
        rows=future_rows(self.history(),5,center_id=1)
        self.assertEqual(len(rows),1)
        self.assertTrue(set(FEATURES)<=set(rows.columns))
        self.assertEqual(rows.iloc[0].lag1,30)
        self.assertEqual(rows.iloc[0].week,5)
        self.assertEqual(rows.iloc[0].emailer_for_promotion,0)

    def test_unknown_center_has_explicit_error(self):
        with self.assertRaisesRegex(ValueError,'No historical rows'):
            future_rows(self.history(),6,center_id=999)

    def test_wape_matches_hand_calculation(self):
        self.assertAlmostEqual(wape([10,20],[8,22]),100*4/30)

    def test_missing_source_fails_instead_of_generating_forecasts(self):
        with TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                read_data(directory)


if __name__=='__main__':
    unittest.main()
