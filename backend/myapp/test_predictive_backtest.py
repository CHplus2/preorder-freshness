"""Held-out replay contract, access control and target-leakage regression checks."""
from pathlib import Path
from unittest import skipUnless
from unittest.mock import patch

import numpy as np
import pandas as pd
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from predictive_ai.backtest import backtest

BASE = '/api/admin/predictive/backtest/'


class LagModel:
    def predict(self, rows, thread_count=2):
        return np.log1p(rows.lag1.to_numpy() + 1)


def fixture():
    return pd.DataFrame([
        dict(center_id=13, meal_id=1, week=week, num_orders=quantity,
             category='Bread', cuisine='Demo', center_type='A', checkout_price=10,
             base_price=10, emailer_for_promotion=0, homepage_featured=0, op_area=1)
        for week, quantity in [(134, 5), (135, 8), (136, 10), (137, 12)]
    ])


METRICS = {'train_max_week': 135, 'validation_start_week': 136, 'validation_end_week': 137}


class PredictiveBacktestTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(username='replay-staff', password='test-password', is_staff=True)
        cls.customer = User.objects.create_user(username='replay-customer', password='test-password')

    def client_for_staff(self):
        client = APIClient()
        client.force_authenticate(self.staff)
        return client

    def test_permission_and_method(self):
        for user in (None, self.customer):
            client = APIClient()
            if user:
                client.force_authenticate(user)
            self.assertEqual(client.get(BASE + '?center_id=13&week=136').status_code, 403)
        self.assertEqual(self.client_for_staff().post(BASE, {}, format='json').status_code, 405)

    @patch('predictive_ai.service.bundle')
    def test_hand_calculated_scores_and_contract_without_writes(self, bundle):
        bundle.return_value = fixture(), LagModel(), METRICS, None
        with self.assertNumQueries(0):
            response = self.client_for_staff().get(BASE + '?center_id=13&week=136')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertAlmostEqual(response.data['scores']['catboost']['wape_percent'], 10)
        self.assertEqual(response.data['scores']['previous_observation']['wape_percent'], 20)
        self.assertEqual(response.data['meal_comparisons'][0]['actual_orders'], 10)
        self.assertEqual(response.data['training_max_week'], 135)

    @patch('predictive_ai.service.bundle')
    def test_target_and_future_quantities_do_not_change_prediction(self, bundle):
        history = fixture()
        bundle.return_value = history, LagModel(), METRICS, None
        first = backtest({'center_id': 13, 'week': 136})['meal_comparisons'][0]['predicted_orders']
        history.loc[history.week >= 136, 'num_orders'] = 999999
        second = backtest({'center_id': 13, 'week': 136})['meal_comparisons'][0]['predicted_orders']
        self.assertEqual(first, second)

    @patch('predictive_ai.service.bundle')
    def test_invalid_and_repeated_parameters(self, bundle):
        bundle.return_value = fixture(), LagModel(), METRICS, None
        client = self.client_for_staff()
        for query in ('', '?center_id=13', '?center_id=13&week=135', '?center_id=13&week=146',
                      '?center_id=999&week=136', '?center_id=13.5&week=136',
                      '?center_id=13&week=136&week=136', '?center_id=13&week=136&unknown=1'):
            self.assertEqual(client.get(BASE + query).status_code, 400, query)
        bundle.return_value = fixture(), LagModel(), {**METRICS, 'train_max_week': 136}, None
        self.assertEqual(client.get(BASE + '?center_id=13&week=136').status_code, 503)

    @patch('predictive_ai.service.bundle')
    def test_zero_actual_and_absent_observations(self, bundle):
        history = fixture()
        history.loc[history.week == 136, 'num_orders'] = 0
        bundle.return_value = history, LagModel(), METRICS, None
        result = backtest({'center_id': 13, 'week': 136})
        self.assertIsNone(result['scores']['catboost']['wape_percent'])
        self.assertAlmostEqual(result['scores']['catboost']['mae_orders_per_meal'], 9)
        bundle.return_value = history[history.week != 136], LagModel(), METRICS, None
        self.assertEqual(self.client_for_staff().get(BASE + '?center_id=13&week=136').status_code, 422)

    @skipUnless((Path(__file__).resolve().parents[1] / 'predictive_ai/artifacts/demand_model.cbm').is_file(),
                'Requires the evaluated model bundle')
    def test_real_model_and_missing_artifact(self):
        client = self.client_for_staff()
        with self.assertNumQueries(0):
            result = client.get(BASE + '?center_id=13&week=136')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(result.data['meal_comparisons'])
        self.assertTrue(np.isfinite(result.data['scores']['catboost']['wape_percent']))
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as empty, override_settings(PREDICTIVE_ARTIFACT_DIR=empty):
            response = client.get(BASE + '?center_id=13&week=136')
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.data['code'], 'model_unavailable')
