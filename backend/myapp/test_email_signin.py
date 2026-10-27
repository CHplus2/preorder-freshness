"""Email-first account boundaries; no real emails or production records."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch
from django.contrib.auth.models import User
from django.db import connection, close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from .models import AuthAttempt, Storefront

PASSWORD='Fixture-signin-password!2026'

class EmailSigninTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.user=User.objects.create_user('older-buyer',email='Buyer@example.test',password=PASSWORD)

    def post(self,url,body):
        return self.client.post(url,body,format='json')

    def test_email_first_signup_normalises_and_uses_stable_internal_reference(self):
        response=self.post('/api/signup/',dict(email='  NEW@example.test  ',first_name='Aina',password=PASSWORD,confirmPassword=PASSWORD,is_staff=True,is_superuser=True))
        self.assertEqual(response.status_code,201,response.data)
        user=User.objects.get(email='new@example.test');self.assertTrue(user.username.startswith('customer-'));self.assertEqual(user.first_name,'Aina')
        self.assertFalse(user.is_staff);self.assertFalse(user.is_superuser);self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(self.client.get('/api/check-auth/').data['user_id'],user.pk)
        self.client.logout()
        self.assertEqual(self.post('/api/login/',dict(identifier='NEW@example.test',password=PASSWORD)).status_code,200)

    def test_signup_requires_identity_and_rejects_weak_password_or_mismatch(self):
        for body in [dict(password=PASSWORD,confirmPassword=PASSWORD),dict(email='new@example.test',password='123',confirmPassword='123'),dict(email='new@example.test',password=PASSWORD,confirmPassword='different')]:
            self.assertEqual(self.post('/api/signup/',body).status_code,400)
        self.assertEqual(User.objects.count(),1)

    def test_case_insensitive_duplicate_or_username_email_collision_is_rejected(self):
        body=dict(email='BUYER@example.test',password=PASSWORD,confirmPassword=PASSWORD)
        self.assertEqual(self.post('/api/signup/',body).status_code,400)
        User.objects.create_user('occupied@example.test',password=PASSWORD)
        body['email']='OCCUPIED@example.test';self.assertEqual(self.post('/api/signup/',body).status_code,400)
        self.user.is_active=False;self.user.save()
        body['email']='buyer@example.test';self.assertEqual(self.post('/api/signup/',body).status_code,400)
        self.assertEqual(User.objects.count(),2)

    def test_legacy_username_signup_and_existing_username_login_still_work(self):
        response=self.post('/api/signup/',dict(username='older-new',password=PASSWORD,confirmPassword=PASSWORD))
        self.assertEqual(response.status_code,201,response.data)
        for body in [dict(username='older-buyer',password=PASSWORD),dict(identifier='older-buyer',password=PASSWORD),dict(identifier='BUYER@example.test',password=PASSWORD)]:
            self.client.logout();self.assertEqual(self.post('/api/login/',body).status_code,200)

    def test_legacy_username_signup_preserves_django_unicode_normalisation(self):
        body=dict(username='ℌome-buyer',password=PASSWORD,confirmPassword=PASSWORD)
        response=self.post('/api/signup/',body)
        self.assertEqual(response.status_code,201,response.data)
        self.assertTrue(User.objects.filter(username='Home-buyer').exists())
        self.assertEqual(self.post('/api/signup/',dict(body,username='Home-buyer')).status_code,400)

    def test_ambiguous_email_never_selects_first_account_and_exact_username_remains_available(self):
        other=User.objects.create_user('second-buyer',email='buyer@example.test',password=PASSWORD)
        failed=self.post('/api/login/',dict(identifier='buyer@example.test',password=PASSWORD))
        self.assertEqual(failed.status_code,401);self.assertFalse(self.client.get('/api/check-auth/').data['authenticated'])
        self.assertEqual(self.post('/api/login/',dict(identifier=other.username,password=PASSWORD)).status_code,200)
        self.client.logout()
        # A legacy username that resembles someone else's email is not guessed.
        User.objects.create_user('Buyer@example.test',password=PASSWORD)
        self.assertEqual(self.post('/api/login/',dict(identifier='Buyer@example.test',password=PASSWORD)).status_code,401)
        self.assertEqual(self.post('/api/login/',dict(username='Buyer@example.test',password=PASSWORD)).status_code,200)

    def test_inactive_unknown_and_wrong_password_have_identical_failure(self):
        expected=self.post('/api/login/',dict(identifier='absent@example.test',password=PASSWORD))
        wrong=self.post('/api/login/',dict(identifier=self.user.email,password='incorrect'))
        self.user.is_active=False;self.user.save()
        inactive=self.post('/api/login/',dict(identifier=self.user.email,password=PASSWORD))
        self.assertEqual(expected.status_code,401);self.assertEqual(expected.data,wrong.data);self.assertEqual(expected.data,inactive.data)

    def test_email_and_username_share_account_throttle(self):
        for i in range(15):
            identifier=self.user.username if i%2 else self.user.email.upper()
            self.assertEqual(self.post('/api/login/',dict(identifier=identifier,password='incorrect')).status_code,401)
        self.assertEqual(self.post('/api/login/',dict(username=self.user.username,password=PASSWORD)).status_code,429)
        self.assertFalse(AuthAttempt.objects.filter(key__contains='buyer').exists())

    @patch('myapp.services.recovery_email.send_recovery_email')
    def test_email_only_recovery_is_generic_and_shared_email_needs_username(self,send):
        known=self.post('/api/auth/recovery/',dict(email='BUYER@example.test'))
        send.assert_called_once();self.assertEqual(send.call_args.args[0].pk,self.user.pk);send.reset_mock()
        unknown=self.post('/api/auth/recovery/',dict(email='absent@example.test'))
        self.assertEqual(known.data,unknown.data);send.assert_not_called()
        User.objects.create_user('duplicate',email='buyer@example.test',password=PASSWORD)
        shared=self.post('/api/auth/recovery/',dict(email='buyer@example.test'))
        self.assertEqual(shared.data,known.data);send.assert_not_called()
        chosen=self.post('/api/auth/recovery/',dict(email='buyer@example.test',username='older-buyer'))
        self.assertEqual(chosen.data,known.data);send.assert_called_once()

    @patch('myapp.services.recovery_email.send_recovery_email')
    def test_recovery_aliases_share_limit_and_exclude_inactive_or_unusable_accounts(self,send):
        for i in range(5):
            body=dict(email=self.user.email)
            if i%2:body['username']=self.user.username
            self.assertEqual(self.post('/api/auth/recovery/',body).status_code,200)
        self.assertEqual(self.post('/api/auth/recovery/',dict(email=self.user.email)).status_code,429)
        self.assertEqual(send.call_count,5)
        AuthAttempt.objects.all().delete();send.reset_mock();self.user.set_unusable_password();self.user.save()
        self.assertEqual(self.post('/api/auth/recovery/',dict(email=self.user.email)).status_code,200);send.assert_not_called()

    def test_identity_bodies_and_csrf_are_checked(self):
        for body in [[],{},dict(identifier=self.user.email,username=self.user.username,password=PASSWORD),dict(identifier='a'*255,password=PASSWORD)]:
            self.assertEqual(self.post('/api/login/',body).status_code,400)
        client=APIClient(enforce_csrf_checks=True)
        for url,body in [('/api/signup/',dict(email='new@example.test',password=PASSWORD,confirmPassword=PASSWORD)),('/api/login/',dict(identifier=self.user.email,password=PASSWORD)),('/api/auth/recovery/',dict(email=self.user.email))]:
            self.assertEqual(client.post(url,body,format='json').status_code,403)

    def test_email_changes_reject_collision_without_changing_signin_or_order_consent(self):
        other=User.objects.create_user('other',email='other@example.test',password=PASSWORD)
        self.client.force_authenticate(self.user)
        url='/api/account/order-email/'
        response=self.client.patch(url,dict(email=other.email.upper(),current_password=PASSWORD),format='json')
        self.assertEqual(response.status_code,400);self.user.refresh_from_db();self.assertEqual(self.user.email,'Buyer@example.test')
        response=self.client.patch(url,dict(email='changed@example.test',current_password=PASSWORD),format='json')
        self.assertEqual(response.status_code,200);self.user.refresh_from_db();self.assertEqual(self.user.username,'older-buyer')
        self.client.force_authenticate(None)
        self.assertEqual(self.post('/api/login/',dict(identifier='changed@example.test',password=PASSWORD)).status_code,200)
        self.client.logout();self.assertEqual(self.post('/api/login/',dict(identifier='Buyer@example.test',password=PASSWORD)).status_code,401)

    def test_unchanged_legacy_shared_address_is_not_silently_reassigned(self):
        User.objects.create_user('second',email='buyer@example.test')
        self.client.force_authenticate(self.user)
        result=self.client.patch('/api/account/order-email/',dict(email='BUYER@example.test',current_password=PASSWORD),format='json')
        self.assertEqual(result.status_code,200);self.assertEqual(User.objects.count(),2)


@skipUnless(connection.vendor=='postgresql','Row-lock concurrency requires PostgreSQL')
class EmailIdentityConcurrencyTests(TransactionTestCase):
    def setUp(self):
        Storefront.objects.create(pk=1)

    def test_concurrent_signups_cannot_claim_the_same_email(self):
        gate=Barrier(2)
        def signup(index):
            close_old_connections();gate.wait()
            try:
                result=APIClient().post('/api/signup/',dict(email='Same@example.test' if index else 'same@example.test',password=PASSWORD,confirmPassword=PASSWORD),format='json')
                return result.status_code
            finally:close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as workers:
            codes=list(workers.map(signup,range(2)))
        self.assertEqual(sorted(codes),[201,400]);self.assertEqual(User.objects.filter(email__iexact='same@example.test').count(),1)

    def test_two_account_email_changes_cannot_claim_the_same_address(self):
        users=[User.objects.create_user('change-'+str(i),email=f'old{i}@example.test',password=PASSWORD) for i in range(2)]
        gate=Barrier(2)
        def change(index):
            close_old_connections();gate.wait()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=users[index].pk))
                return client.patch('/api/account/order-email/',dict(email='target@example.test',current_password=PASSWORD),format='json').status_code
            finally:close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as workers:
            codes=list(workers.map(change,range(2)))
        self.assertEqual(sorted(codes),[200,400]);self.assertEqual(User.objects.filter(email='target@example.test').count(),1)
