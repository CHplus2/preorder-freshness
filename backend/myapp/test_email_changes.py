"""One-use authenticated mailbox changes; all SMTP is mocked."""
import re
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch
from django.contrib.auth.models import User
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from .models import AuthAttempt, Order, Storefront
from .services import email_changes

PASSWORD='Fixture-email-change-2026!'
SETUP=dict(ACCOUNT_EMAIL_CONFIRMATION_REQUIRED=True,EMAIL_HOST='smtp.example.test',EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',PUBLIC_APP_URL='https://kitchen.example')

@override_settings(**SETUP)
class EmailChangeTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('email-owner',email='old@example.test',password=PASSWORD)
        self.other=User.objects.create_user('other-owner',email='other@example.test',password=PASSWORD)
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.send=patch('myapp.services.email_changes.send_mail',return_value=1).start();self.addCleanup(patch.stopall)
        Storefront.objects.create(pk=1)

    def request(self,target='new@example.test',password=PASSWORD):
        return self.client.post('/api/account/email-change/',dict(email=target,current_password=password),format='json')

    def token(self):
        return re.search(r'/confirm-email#token=([^\s]+)',self.send.call_args.args[1]).group(1)

    def use(self,token,action='confirm',client=None):
        return (client or self.client).post('/api/account/email-change/confirm/',dict(token=token,action=action),format='json')

    def test_request_keeps_email_and_consent_until_explicit_confirmation(self):
        order=Order.objects.create(user=self.user,fulfilment_snapshot={'customer_reminder':{'enabled':True,'email':self.user.email}})
        response=self.request('NEW@example.test');self.assertEqual(response.status_code,202,response.data)
        self.assertTrue(response.data['email_change_pending']);self.assertTrue(response.data['confirmation_sent'])
        self.assertNotIn('token',response.data);self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')
        token=self.token();inspected=self.use(token,'inspect');self.assertEqual(inspected.status_code,200,inspected.data)
        self.assertEqual(inspected.data['proposed_email'],'new@example.test');self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')
        confirmed=self.use(token);self.assertEqual(confirmed.status_code,200,confirmed.data);self.assertFalse(confirmed.data['already_applied'])
        self.assertFalse(confirmed.data['email_change_pending']);self.user.refresh_from_db();self.assertEqual(self.user.email,'new@example.test')
        self.assertEqual(self.user.username,'email-owner');self.assertTrue(self.user.check_password(PASSWORD))
        order.refresh_from_db();self.assertEqual(order.fulfilment_snapshot['customer_reminder']['email'],'old@example.test')
        self.assertEqual(self.use(token).status_code,200);self.assertTrue(self.use(token).data['already_applied']);self.assertEqual(self.send.call_count,1)
        keys=' '.join(AuthAttempt.objects.values_list('key',flat=True));self.assertNotIn('example.test',keys);self.assertNotIn(token,keys)

    def test_required_mode_cannot_be_bypassed_with_old_patch_endpoint(self):
        result=self.client.patch('/api/account/order-email/',dict(email='new@example.test',current_password=PASSWORD),format='json')
        self.assertEqual(result.status_code,400);self.send.assert_not_called();self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    @override_settings(ACCOUNT_EMAIL_CONFIRMATION_REQUIRED=False)
    def test_deferred_rollout_preserves_existing_direct_edits_and_never_sends(self):
        self.assertEqual(self.request().status_code,503);self.send.assert_not_called()
        result=self.client.patch('/api/account/order-email/',dict(email='new@example.test',current_password=PASSWORD),format='json')
        self.assertEqual(result.status_code,200);self.assertFalse(result.data['email_change_confirmation_required'])
        self.assertEqual(self.use('no-valid-token').status_code,503)

    def test_invalid_request_password_and_claim_collision_do_not_send(self):
        for target,password in [('new@example.test','wrong'),('other@example.test',PASSWORD),('',PASSWORD),('bad-email',PASSWORD)]:
            self.assertEqual(self.request(target,password).status_code,400)
        self.send.assert_not_called()

    def test_newest_request_replaces_old_and_cancel_invalidates_all_links(self):
        self.request();old=self.token();self.request('next@example.test');new=self.token()
        self.assertEqual(self.use(old).status_code,400)
        cancelled=self.client.post('/api/account/email-change/cancel/',{},format='json');self.assertEqual(cancelled.status_code,200)
        self.assertFalse(cancelled.data['email_change_pending']);self.assertEqual(self.use(new).status_code,400)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    def test_expired_tampered_or_incomplete_tokens_never_change_email(self):
        self.request();token=self.token()
        for value in ['bad',token+'x','',None]:self.assertEqual(self.use(value).status_code,400)
        with patch('django.core.signing.time.time',return_value=time.time()+1801):self.assertEqual(self.use(token).status_code,400)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    def test_wrong_account_and_anonymous_session_cannot_inspect_recipient(self):
        self.request();token=self.token()
        other=APIClient();other.force_authenticate(self.other)
        result=self.use(token,'inspect',other);self.assertEqual(result.status_code,400);self.assertNotIn('new@example.test',str(result.data))
        anonymous=APIClient();self.assertIn(self.use(token,'confirm',anonymous).status_code,[401,403])
        self.assertEqual(anonymous.post('/api/account/email-change/',{},format='json').status_code,403)

    def test_password_or_current_email_changes_invalidate_old_proof(self):
        self.request();token=self.token();self.user.set_password('Changed-Fixture-Pass-2026!');self.user.save()
        self.assertEqual(self.use(token).status_code,400)
        self.request(password='Changed-Fixture-Pass-2026!');token=self.token();self.user.email='manual@example.test';self.user.save()
        self.assertEqual(self.use(token).status_code,400)

    def test_final_confirmation_rechecks_collision_after_request(self):
        self.request();token=self.token();User.objects.create_user('claimed-later',email='new@example.test')
        self.assertEqual(self.use(token).status_code,400);self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    def test_removal_is_password_protected_and_invalidates_pending_link(self):
        self.request();token=self.token()
        result=self.client.patch('/api/account/order-email/',dict(email='',current_password=PASSWORD),format='json')
        self.assertEqual(result.status_code,200);self.assertFalse(result.data['email_change_pending']);self.assertEqual(self.use(token).status_code,400)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'')

    def test_missing_mail_or_unsafe_origin_prevents_send_without_changes(self):
        for settings in [dict(EMAIL_HOST=''),dict(PUBLIC_APP_URL='https://user:private@kitchen.example'),dict(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend'),dict(PUBLIC_APP_URL='http://public.example')]:
            with override_settings(**settings):self.assertEqual(self.request().status_code,503)
        self.send.assert_not_called();self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    def test_mail_failure_expires_challenge_and_does_not_leak_private_error(self):
        self.send.side_effect=RuntimeError('private-password-token-address-fixture')
        with self.assertLogs('myapp.services.email_changes',level='WARNING') as logs:result=self.request()
        self.assertEqual(result.status_code,503);self.assertNotIn('private-password-token-address-fixture',str(result.data)+' '.join(logs.output))
        self.assertFalse(self.client.get('/api/account/order-email/').data['email_change_pending']);self.assertEqual(self.use(self.token()).status_code,400)

    def test_links_use_trusted_origin_and_get_never_confirms(self):
        self.request();message=self.send.call_args.args[1];self.assertIn('https://kitchen.example/confirm-email#token=',message)
        self.assertEqual(self.client.get('/api/account/email-change/confirm/').status_code,405)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.test')

    def test_request_rate_limit_includes_wrong_password_attempts(self):
        for _ in range(5):self.assertEqual(self.request(password='incorrect').status_code,400)
        self.assertEqual(self.request().status_code,429);self.send.assert_not_called()

    def test_csrf_and_malformed_bodies_are_rejected(self):
        csrf=APIClient(enforce_csrf_checks=True);csrf.force_login(self.user)
        for url in ['/api/account/email-change/','/api/account/email-change/confirm/','/api/account/email-change/cancel/']:
            self.assertEqual(csrf.post(url,{},format='json').status_code,403)
        for body in [[],{},dict(token='x',action='auto'),dict(token='x'*4097)]:
            self.assertEqual(self.client.post('/api/account/email-change/confirm/',body,format='json').status_code,400)


@skipUnless(connection.vendor=='postgresql','PostgreSQL row locking required')
@override_settings(**SETUP)
class EmailConfirmationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user=User.objects.create_user('confirmation-concurrent',email='old@example.test',password=PASSWORD)
        Storefront.objects.create(pk=1)

    def test_same_link_confirms_once_across_workers(self):
        with patch('myapp.services.email_changes.send_mail',return_value=1) as send:
            client=APIClient();client.force_authenticate(self.user)
            response=client.post('/api/account/email-change/',dict(email='new@example.test',current_password=PASSWORD),format='json');self.assertEqual(response.status_code,202)
        token=re.search(r'#token=([^\s]+)',send.call_args.args[1]).group(1);gate=Barrier(2)
        def confirm(_):
            close_old_connections();gate.wait()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=self.user.pk))
                result=client.post('/api/account/email-change/confirm/',dict(token=token,action='confirm'),format='json')
                return result.status_code,result.data.get('already_applied')
            finally:close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(confirm,range(2)))
        self.assertEqual(sorted(results),[(200,False),(200,True)])
        self.user.refresh_from_db();self.assertEqual(self.user.email,'new@example.test')

    def test_two_confirmations_cannot_claim_the_same_new_address(self):
        other=User.objects.create_user('second-confirmation',email='other@example.test',password=PASSWORD)
        tokens=[]
        for user in [self.user,other]:
            with patch('myapp.services.email_changes.send_mail',return_value=1) as send:
                client=APIClient();client.force_authenticate(user)
                result=client.post('/api/account/email-change/',dict(email='same-new@example.test',current_password=PASSWORD),format='json');self.assertEqual(result.status_code,202)
            tokens.append(re.search(r'#token=([^\s]+)',send.call_args.args[1]).group(1))
        gate=Barrier(2);ids=[self.user.pk,other.pk]
        def confirm(index):
            close_old_connections();gate.wait()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=ids[index]))
                return client.post('/api/account/email-change/confirm/',dict(token=tokens[index],action='confirm'),format='json').status_code
            finally:close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(confirm,range(2)))
        self.assertEqual(sorted(results),[200,400]);self.assertEqual(User.objects.filter(email='same-new@example.test').count(),1)
