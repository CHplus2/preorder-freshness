from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from smtplib import SMTPAuthenticationError, SMTPConnectError, SMTPDataError, SMTPRecipientsRefused, SMTPSenderRefused
from unittest.mock import patch
from django.contrib.auth.models import User
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AuthAttempt, OrderReminder
from .services.email_diagnostics import configuration

MAIL=dict(EMAIL_HOST='smtp.example.test',EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
          DEFAULT_FROM_EMAIL='Fixture kitchen <sender@example.test>',OWNER_NOTIFICATION_EMAIL='owner@example.test')


@override_settings(**MAIL)
class EmailDiagnosticsTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('mail-owner',password='Fixture-Mail-2026!',is_staff=True)
        self.customer=User.objects.create_user('mail-customer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.url='/api/admin/email-delivery-check/'

    def test_staff_only_and_post_only(self):
        with patch('myapp.services.email_diagnostics.send_mail') as send:
            for user in [None,self.customer]:
                self.client.force_authenticate(user)
                self.assertEqual(self.client.post(self.url,{},format='json').status_code,403)
            self.client.force_authenticate(self.owner)
            self.assertEqual(self.client.get(self.url).status_code,405)
        send.assert_not_called();self.assertFalse(AuthAttempt.objects.exists())

    def test_session_post_requires_csrf(self):
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.owner)
        with patch('myapp.services.email_diagnostics.send_mail') as send:
            self.assertEqual(client.post(self.url,{},format='json').status_code,403)
        send.assert_not_called()

    def test_status_reveals_only_valid_owner_routing_to_staff_and_sends_nothing(self):
        with override_settings(EMAIL_HOST_PASSWORD='private-fixture-password',EMAIL_HOST_USER='private-fixture-smtp-login'):
            with patch('myapp.services.email_diagnostics.send_mail') as send:
                result=self.client.get('/api/admin/reminder-status/')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.data['email_delivery'],dict(transport_ready=True,sender_address='sender@example.test',owner_recipient='owner@example.test',test_available=True))
        self.assertNotIn('private-fixture',str(result.data));self.assertIn('no-store',result['Cache-Control'])
        send.assert_not_called();self.assertFalse(AuthAttempt.objects.exists())
        self.client.force_authenticate(self.customer)
        result=self.client.get('/api/admin/reminder-status/');self.assertEqual(result.status_code,403)
        self.assertNotIn('owner@example.test',str(result.data))

    def test_local_default_missing_recipient_and_bad_addresses_cannot_send(self):
        cases=[dict(DEFAULT_FROM_EMAIL='kitchen@localhost'),dict(OWNER_NOTIFICATION_EMAIL=''),
            dict(DEFAULT_FROM_EMAIL='invalid'),dict(OWNER_NOTIFICATION_EMAIL='a@example.test,b@example.test'),
            dict(DEFAULT_FROM_EMAIL='sender@example.test\r\nBcc: leak@example.test'),dict(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')]
        with patch('myapp.services.email_diagnostics.send_mail') as send:
            for values in cases:
                with self.subTest(values=values),override_settings(**values):
                    self.assertFalse(configuration()['test_available'])
                    self.assertEqual(self.client.post(self.url,{},format='json').status_code,503)
        send.assert_not_called();self.assertFalse(AuthAttempt.objects.exists())

    @patch('myapp.services.email_diagnostics.send_mail',return_value=1)
    def test_exactly_one_owner_message_is_referenced_without_worker_or_order_receipts(self,send):
        result=self.client.post(self.url,{},format='json');self.assertEqual(result.status_code,202,result.data)
        self.assertEqual(result.data['outcome'],'accepted');self.assertEqual(result.data['recipient'],'owner@example.test')
        self.assertRegex(result.data['reference'],r'^FCMAIL-[0-9a-f]{12}$')
        self.assertIn(result.data['reference'],send.call_args.args[0]);self.assertIn(result.data['reference'],send.call_args.args[1])
        self.assertEqual(send.call_args.args[3],['owner@example.test']);self.assertEqual(send.call_count,1)
        self.assertFalse(OrderReminder.objects.exists());self.assertFalse(AuthAttempt.objects.filter(key__startswith='reminder-worker:').exists())
        self.assertIn('no-store',result['Cache-Control'])

    @patch('myapp.services.email_diagnostics.send_mail',return_value=1)
    def test_throttle_includes_failed_or_unknown_attempts_and_expires(self,send):
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,202)
        result=self.client.post(self.url,{},format='json');self.assertEqual(result.status_code,429)
        self.assertGreater(int(result['Retry-After']),0);self.assertEqual(send.call_count,1)
        AuthAttempt.objects.filter(key__startswith='owner-mail-check:').update(created_at=timezone.now()-timedelta(minutes=6))
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,202);self.assertEqual(send.call_count,2)

    def test_client_cannot_choose_a_recipient_subject_or_message(self):
        with patch('myapp.services.email_diagnostics.send_mail') as send:
            for payload in [dict(recipient='other@example.test'),dict(subject='arbitrary'),dict(message='arbitrary')]:
                self.assertEqual(self.client.post(self.url,payload,format='json').status_code,400)
        send.assert_not_called();self.assertFalse(AuthAttempt.objects.exists())

    def test_smtp_failure_reasons_are_fixed_and_never_leak_private_responses(self):
        cases=[(SMTPAuthenticationError(535,b'private-fixture'),'authentication'),
            (SMTPSenderRefused(550,b'private-fixture','sender@example.test'),'sender_rejected'),
            (SMTPRecipientsRefused({'owner@example.test':(550,b'private-fixture')}),'recipient_rejected'),
            (SMTPDataError(550,b'private-fixture'),'message_rejected'),(SMTPConnectError(421,b'private-fixture'),'connection')]
        for error,reason in cases:
            with self.subTest(reason=reason):
                AuthAttempt.objects.all().delete()
                with patch('myapp.services.email_diagnostics.send_mail',side_effect=error):result=self.client.post(self.url,{},format='json')
                self.assertEqual(result.status_code,503);self.assertEqual(result.data['outcome'],'not_accepted');self.assertEqual(result.data['reason'],reason)
                self.assertNotIn('private-fixture',str(result.data))

    def test_timeout_is_unconfirmed_and_zero_count_is_not_accepted(self):
        for behavior,outcome,reason in [(TimeoutError('private-fixture'),'unconfirmed','unknown'),(0,'not_accepted','no_acceptance'),(2,'unconfirmed','unknown')]:
            AuthAttempt.objects.all().delete()
            kwargs={'side_effect':behavior} if isinstance(behavior,Exception) else {'return_value':behavior}
            with patch('myapp.services.email_diagnostics.send_mail',**kwargs):result=self.client.post(self.url,{},format='json')
            self.assertEqual(result.status_code,503);self.assertEqual((result.data['outcome'],result.data['reason']),(outcome,reason));self.assertNotIn('private-fixture',str(result.data))

    @patch('myapp.services.email_diagnostics.send_mail',side_effect=TimeoutError('private-fixture'))
    def test_unknown_send_cannot_be_immediately_retried(self,send):
        self.assertEqual(self.client.post(self.url,{},format='json').data['outcome'],'unconfirmed')
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,429)
        self.assertEqual(send.call_count,1)


@override_settings(**MAIL)
class EmailDiagnosticConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update')
    def test_overlapping_staff_clicks_claim_once_without_holding_user_lock_during_smtp(self):
        owner=User.objects.create_user('concurrent-mail-owner',is_staff=True)
        entered,release=Event(),Event()
        def send(*args,**kwargs):
            entered.set()
            if not release.wait(5):raise RuntimeError('Fixture synchronization timeout')
            return 1
        def request():
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(owner)
                return client.post('/api/admin/email-delivery-check/',{},format='json')
            finally:close_old_connections()
        with patch('myapp.services.email_diagnostics.send_mail',side_effect=send) as mail,ThreadPoolExecutor(max_workers=1) as pool:
            first=pool.submit(request)
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(request().status_code,429)
            finally:release.set()
            self.assertEqual(first.result(timeout=5).status_code,202)
        self.assertEqual(mail.call_count,1)
