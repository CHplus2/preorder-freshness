"""Browser authentication boundaries and bounded authentication housekeeping."""
import base64
from datetime import timedelta
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory
from .models import AuthAttempt
from .services.auth_limits import limit


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AuthenticationBoundaryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.buyer = User.objects.create_user('security-buyer', password='Fixture-password!72')
        self.owner = User.objects.create_user('security-owner', password='Owner-password!72', is_staff=True)
        self.client = APIClient(enforce_csrf_checks=True)

    def basic(self, user, password):
        return 'Basic '+base64.b64encode(f'{user.username}:{password}'.encode()).decode()

    def test_basic_credentials_cannot_bypass_login_or_session_csrf(self):
        response = self.client.patch('/api/account/', {'first_name':'Unauthorised change'}, format='json',
            HTTP_AUTHORIZATION=self.basic(self.buyer, 'Fixture-password!72'))
        self.assertEqual(response.status_code, 403)
        self.buyer.refresh_from_db(); self.assertEqual(self.buyer.first_name, '')
        self.assertFalse(AuthAttempt.objects.exists())
        response = self.client.get('/api/admin/orders/', HTTP_AUTHORIZATION=self.basic(self.owner, 'Owner-password!72'))
        self.assertEqual(response.status_code, 403)

    def test_normal_login_logout_and_csrf_continue_to_work(self):
        bootstrap = self.client.get('/api/check-auth/')
        self.assertFalse(bootstrap.data['authenticated'])
        csrf = self.client.cookies['csrftoken'].value
        self.assertEqual(self.client.post('/api/login/', {'username':self.buyer.username,'password':'Fixture-password!72'}, format='json').status_code, 403)
        response = self.client.post('/api/login/', {'username':self.buyer.username,'password':'Fixture-password!72'}, format='json',HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        csrf = self.client.cookies['csrftoken'].value
        self.assertEqual(self.client.patch('/api/account/', {'first_name':'Buyer'}, format='json').status_code, 403)
        self.assertEqual(self.client.patch('/api/account/', {'first_name':'Buyer','is_staff':True}, format='json',HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        self.buyer.refresh_from_db(); self.assertFalse(self.buyer.is_staff)
        self.assertEqual(self.client.post('/api/logout/', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        self.assertEqual(self.client.get('/api/account/').status_code, 403)

    def test_admin_boundaries_reject_anonymous_and_ordinary_customers(self):
        routes = ['/api/admin/orders/', '/api/admin/customers/', '/api/admin/raw-materials/',
            '/api/admin/inventory-items/', '/api/admin/planning/', '/api/admin/analytics/',
            '/api/admin/setup-checklist/', '/api/admin/costs/', '/api/admin/recommendation-metrics/',
            '/api/admin/predictive/forecast/', '/api/admin/predictive/local-plan/',
            '/api/admin/predictive/model-backup/']
        for authenticated in [False, True]:
            if authenticated:self.client.force_login(self.buyer)
            for route in routes:
                with self.subTest(route=route, authenticated=authenticated):
                    response = self.client.get(route)
                    self.assertEqual(response.status_code, 403)
                    self.assertIn('no-store', response.get('Cache-Control', ''))

    def test_identity_and_private_responses_are_never_cacheable(self):
        for authenticated in [False, True]:
            if authenticated:self.client.force_login(self.buyer)
            for route in ['/api/check-auth/', '/api/account/', '/api/orders/', '/api/address/', '/api/wallet/']:
                with self.subTest(route=route, authenticated=authenticated):
                    response = self.client.get(route)
                    self.assertIn('no-store', response.get('Cache-Control', ''))
                    self.assertIn('private', response.get('Cache-Control', ''))
                    self.assertIn('Cookie', response.get('Vary', ''))
        denied = self.client.post('/api/login/', {}, format='json')
        self.assertIn('no-store', denied.get('Cache-Control', ''))

    def test_public_catalogue_stays_public_and_is_not_forced_no_store(self):
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('no-store', response.get('Cache-Control', ''))

    def test_django_admin_login_uses_same_account_limit_and_csrf(self):
        self.assertEqual(self.client.post('/django-admin/login/', {'username':self.owner.username,'password':'wrong'}).status_code, 403)
        self.client.get('/django-admin/login/')
        csrf = self.client.cookies['csrftoken'].value
        factory = APIRequestFactory().post('/api/login/', REMOTE_ADDR='192.0.2.1')
        for _ in range(15):limit(factory, 'login', self.owner.username)
        response = self.client.post('/django-admin/login/', {'username':self.owner.username,'password':'Owner-password!72'}, HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response['Retry-After'], '900')
        self.assertIn('no-store', response['Cache-Control'])
        # A fresh window still permits the real staff login form to work.
        AuthAttempt.objects.all().delete()
        response = self.client.post('/django-admin/login/', {'username':self.owner.username,'password':'Owner-password!72','next':'/django-admin/'}, HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 302)


class DeploymentConfigurationTests(TestCase):
    def test_vercel_never_enables_debug_despite_retained_environment_flag(self):
        import os, subprocess, sys, json
        from django.conf import settings
        env = {**os.environ, 'PYTHON_DOTENV_DISABLED':'1', 'VERCEL':'1', 'DEBUG':'True',
            'DATABASE_URL':'postgresql://fixture:fixture@localhost:5432/fixture', 'DATABASE_SCHEMA':'public',
            'VERCEL_URL':'fixture-preview.vercel.app', 'VERCEL_PROJECT_PRODUCTION_URL':'fixture.vercel.app'}
        for key in ['ALLOWED_HOSTS','CSRF_TRUSTED_ORIGINS','CORS_ALLOWED_ORIGINS']:env.pop(key,None)
        output = subprocess.check_output([sys.executable, '-c',
            'import json; from config import settings as s; print(json.dumps([s.DEBUG,s.SESSION_COOKIE_SECURE,s.CSRF_COOKIE_SECURE,s.ALLOWED_HOSTS,s.CORS_ALLOWED_ORIGINS,s.CSRF_TRUSTED_ORIGINS]))'],
            cwd=settings.BASE_DIR, env=env, text=True)
        self.assertEqual(json.loads(output), [False, True, True,
            ['fixture-preview.vercel.app','fixture.vercel.app'], [],
            ['https://fixture-preview.vercel.app','https://fixture.vercel.app']])


class AuthenticationHousekeepingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.request = APIRequestFactory().post('/api/login/', REMOTE_ADDR='192.0.2.1')

    def test_cleanup_is_amortized_while_database_limits_remain_effective(self):
        old = AuthAttempt.objects.create(key='old-fixture')
        AuthAttempt.objects.filter(pk=old.pk).update(created_at=timezone.now()-timedelta(days=2))
        limit(self.request, 'login', 'fixture-account', maximum=3)
        self.assertFalse(AuthAttempt.objects.filter(pk=old.pk).exists())
        with CaptureQueriesContext(connection) as queries:
            limit(self.request, 'login', 'fixture-account', maximum=3)
        self.assertFalse(any('DELETE' in q['sql'].upper() for q in queries))
        limit(self.request, 'login', 'fixture-account', maximum=3)
        from rest_framework.exceptions import Throttled
        with self.assertRaises(Throttled):limit(self.request, 'login', 'fixture-account', maximum=3)

    def test_old_counts_are_ignored_even_before_cleanup_runs_again(self):
        limit(self.request, 'login', 'fixture-account', maximum=1)
        AuthAttempt.objects.update(created_at=timezone.now()-timedelta(minutes=16))
        limit(self.request, 'login', 'fixture-account', maximum=1)
        self.assertEqual(AuthAttempt.objects.count(), 4)
