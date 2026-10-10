"""Staff/CSRF and real-artifact API integration checks, isolated from production."""
from tempfile import TemporaryDirectory
from django.test import TestCase,override_settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from unittest import skipUnless
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

BASE='/api/admin/predictive/'


class PredictiveTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff=User.objects.create_user(username='predictive-staff',password='test-password',is_staff=True)
        cls.customer=User.objects.create_user(username='predictive-customer',password='test-password')

    def test_permissions(self):
        for user in (None,self.customer):
            client=APIClient()
            if user: client.force_authenticate(user)
            for route in ('metrics/','centers/','forecast/?center_id=13','inventory-risk/?center_id=13'):
                self.assertEqual(client.get(BASE+route).status_code,403)
            self.assertEqual(client.post(BASE+'what-if/',{'center_id':13},format='json').status_code,403)

    def test_session_post_requires_csrf(self):
        client=APIClient(enforce_csrf_checks=True)
        client.force_login(self.staff)
        self.assertEqual(client.post(BASE+'what-if/',{'center_id':13},format='json').status_code,403)

    def test_missing_sources_and_model(self):
        client=APIClient(); client.force_authenticate(self.staff)
        with TemporaryDirectory() as empty:
            with override_settings(PREDICTIVE_DATA_DIR=empty, PREDICTIVE_ARTIFACT_DIR=empty):
                response=client.get(BASE+'forecast/?center_id=13')
                self.assertEqual(response.status_code,503)
                self.assertEqual(response.data['code'],'source_data_unavailable')
            # A clean checkout has neither ignored CSVs nor the model. Isolate
            # the missing-model case from the earlier missing-source check.
            with TemporaryDirectory() as sources:
                fixtures={
                    'train.csv':'id,week,center_id,meal_id,checkout_price,base_price,emailer_for_promotion,homepage_featured,num_orders\n1,1,13,1,10,10,0,0,2\n',
                    'meal_info.csv':'meal_id,category,cuisine\n1,Bread,Demo\n',
                    'fulfilment_center_info.csv':'center_id,city_code,region_code,center_type,op_area\n13,1,1,TYPE_A,1\n',
                }
                for name,csv in fixtures.items():
                    (Path(sources)/name).write_text(csv)
                with override_settings(PREDICTIVE_DATA_DIR=sources, PREDICTIVE_ARTIFACT_DIR=empty):
                    response=client.get(BASE+'metrics/')
                    self.assertEqual(response.status_code,503)
                    self.assertEqual(response.data['code'],'model_unavailable')

    @skipUnless((Path(__file__).resolve().parents[1]/'predictive_ai/artifacts/demand_model.cbm').is_file(), 'Requires provisioned real model bundle')
    def test_real_model_endpoints_and_no_database_writes(self):
        client=APIClient(); client.force_authenticate(self.staff)
        response=client.get(BASE+'metrics/')
        self.assertEqual(response.status_code,200,response.data)
        self.assertAlmostEqual(response.data['metrics']['model_wape_percent'],28.23)
        response=client.get(BASE+'centers/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.data['centers']),77)
        for path,post in [('forecast/?center_id=13',False),('inventory-risk/?center_id=13',False),('what-if/',True)]:
            with self.assertNumQueries(0):
                response=client.post(BASE+path,{'center_id':13,'promotion_scenario':True},format='json') if post else client.get(BASE+path)
            self.assertEqual(response.status_code,200,response.data)
            self.assertEqual(response.data['sources']['operational'],'SIMULATED')
            self.assertEqual(response.data['week'],146)
            self.assertEqual(len(response.data['meal_forecasts']),51)
            self.assertTrue(response.data['ingredient_risks'])
            self.assertTrue(response.data['batch_allocations'])
            self.assertEqual(response.data['promotion_scenario'],post)
            self.assertTrue(response.data['warnings'])
        response=client.get(BASE+'forecast/?center_id=10')
        self.assertEqual(response.status_code,503)
        self.assertEqual(response.data['code'],'operational_data_unavailable')

    @patch('predictive_ai.service.bundle')
    def test_invalid_parameters(self,bundle):
        bundle.return_value=(SimpleNamespace(center_id=[13],week=SimpleNamespace(max=lambda:145)),None,{},None)
        client=APIClient(); client.force_authenticate(self.staff)
        for query in ('','?center_id=99999','?center_id=13&week=147','?center_id=true','?center_id=13.5','?center_id=13&center_id=13','?center_id=13&unexpected=1'):
            self.assertEqual(client.get(BASE+'forecast/'+query).status_code,400)
        for body in ([13],{'center_id':True},{'center_id':13,'promotion_scenario':'true'},{'center_id':13,'unexpected':1}):
            self.assertEqual(client.post(BASE+'what-if/',body,format='json').status_code,400)
