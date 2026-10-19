"""Payment recovery exercises real endpoints; no external payment is requested."""
import copy
import json
import uuid
from datetime import timedelta
from unittest.mock import Mock, patch, MagicMock
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, PaymentEvent
from .services.paypal import PayPalError, SandboxClient, API, notification_headers
from .test_paypal import FakePayPal

HEADERS = {
    'HTTP_PAYPAL_AUTH_ALGO':'SHA256withRSA',
    'HTTP_PAYPAL_CERT_URL':'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-fixture',
    'HTTP_PAYPAL_TRANSMISSION_ID':'transmission-fixture',
    'HTTP_PAYPAL_TRANSMISSION_SIG':'Zml4dHVyZQ==',
    'HTTP_PAYPAL_TRANSMISSION_TIME':'2026-10-19T10:00:00Z',
}
WEBHOOK = '/api/payments/paypal/webhook/'


@override_settings(PAYPAL_SANDBOX_ENABLED=True, PAYPAL_SANDBOX_CLIENT_ID='fixture-public',
                   PAYPAL_SANDBOX_CLIENT_SECRET='fixture-secret', PAYPAL_SANDBOX_WEBHOOK_ID='WH-fixture')
class PayPalRecoveryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.buyer = User.objects.create_user('recovery-buyer')
        self.owner = User.objects.create_user('recovery-owner', is_staff=True)
        delivery = timezone.now() + timedelta(days=4)
        self.order = Order.objects.create(user=self.buyer, total_amount=40, shipping_fee=5, payment_method='paypal',
            delivery_at=delivery, preparation_at=delivery-timedelta(hours=2), preparation_end_at=delivery-timedelta(minutes=90))
        key = str(uuid.uuid4())
        intent = dict(version=1, request_id=key, capture_request_id=str(uuid.uuid4()), custom_id=f'dapur-kita:{self.order.pk}:{key}',
            amount='45.00', currency='MYR', created_at=timezone.now().isoformat(), state='created')
        self.provider = FakePayPal()
        self.provider.verify_notification = Mock(return_value=True)
        self.provider_id = self.provider.create(intent)['id']
        intent['paypal_order_id'] = self.provider_id
        self.order.payment_instructions = {'paypal_sandbox':intent}
        self.order.save()
        self.capture_id = 'CAP'+self.provider_id[2:]
        self.client = APIClient()
        self.owner_url = f'/api/admin/orders/{self.order.pk}/paypal/check/'
        self.ledger_url = f'/api/admin/orders/{self.order.pk}/payments/'
        self.factory = patch('myapp.views.paypal_notifications.SandboxClient', return_value=self.provider).start()
        patch('myapp.views.paypal.SandboxClient', return_value=self.provider).start()
        self.addCleanup(patch.stopall)

    def event(self, **changes):
        return dict(id='WH-EVENT-fixture', event_type='PAYMENT.CAPTURE.COMPLETED',
            resource={'id':self.capture_id, 'supplementary_data':{'related_ids':{'order_id':self.provider_id}}}, **changes)

    def notify(self, event=None, headers=None):
        return self.client.post(WEBHOOK, event or self.event(), format='json', **(HEADERS if headers is None else headers))

    def remote_capture(self):
        self.provider.capture(self.provider_id, 'remote-fixture-only')

    def assert_unpaid(self):
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertFalse(PaymentEvent.objects.exists())

    def test_verified_completion_recovers_closed_browser_without_charge_or_stock_change(self):
        self.remote_capture()
        response = self.notify()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['outcome'], 'reconciled')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'paid')
        self.assertEqual(self.order.status, 'pending')
        self.assertFalse(self.order.inventory_deducted)
        receipt = PaymentEvent.objects.get()
        self.assertEqual(str(receipt.amount), '45.00')
        self.assertEqual(receipt.reference, self.capture_id)
        self.assertIsNone(receipt.actor_id)
        intent = self.order.payment_instructions['paypal_sandbox']
        self.assertEqual(intent['last_checked_via'], 'notification')
        self.assertEqual(intent['last_notification']['id'], 'WH-EVENT-fixture')
        self.assertEqual(len(self.provider.creates), 1)
        self.assertEqual(len(self.provider.captures), 1)

    def test_duplicate_and_reordered_notifications_cannot_duplicate_receipt(self):
        self.remote_capture()
        for event_id in ['WH-EVENT-fixture', 'WH-EVENT-fixture', 'WH-EVENT-second']:
            event = self.event(); event['id'] = event_id
            self.assertEqual(self.notify(event).status_code, 200)
        self.assertEqual(PaymentEvent.objects.count(), 1)
        # A late unsupported event never downgrades a verified receipt.
        event = self.event(); event['event_type'] = 'PAYMENT.CAPTURE.PENDING'
        self.assertEqual(self.notify(event).data['outcome'], 'unsupported_event')
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_status, 'paid')
        self.assertEqual(len(self.provider.captures), 1)

    def test_signature_failure_or_missing_headers_never_reads_order_or_pays(self):
        self.remote_capture()
        self.provider.get = Mock(wraps=self.provider.get)
        self.assertEqual(self.notify(headers={}).status_code, 400)
        self.provider.verify_notification.assert_not_called()
        self.provider.verify_notification.return_value = False
        self.assertEqual(self.notify().status_code, 403)
        self.provider.get.assert_not_called(); self.assert_unpaid()

    def test_missing_configuration_and_provider_outage_request_retry(self):
        with override_settings(PAYPAL_SANDBOX_WEBHOOK_ID=''):
            self.assertEqual(self.notify().status_code, 503)
        self.factory.assert_not_called()
        self.provider.verify_notification.side_effect = PayPalError()
        self.assertEqual(self.notify().status_code, 503)
        self.assert_unpaid()

    def test_provider_order_outage_and_capture_not_yet_visible_request_retry(self):
        self.provider.fail_get = True
        self.assertEqual(self.notify().status_code, 503)
        self.provider.fail_get = False
        self.assertEqual(self.notify().status_code, 503)
        self.assert_unpaid()
        self.remote_capture()
        self.assertEqual(self.notify().status_code, 200)
        self.assertEqual(PaymentEvent.objects.count(), 1)

    def test_pending_capture_remains_unpaid_until_provider_confirms_completion(self):
        self.provider.pending = True; self.remote_capture()
        self.assertEqual(self.notify().status_code, 503)
        self.assert_unpaid()
        self.assertEqual(self.order.payment_instructions['paypal_sandbox']['state'], 'pending')
        self.provider.records[self.provider_id]['purchase_units'][0]['payments']['captures'][0]['status'] = 'COMPLETED'
        self.assertEqual(self.notify().status_code, 200)
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_status, 'paid')

    def test_wrong_capture_id_does_not_reconcile_another_capture(self):
        self.remote_capture()
        event = self.event(); event['resource']['id'] = 'ANOTHERCAPTURE'
        self.assertEqual(self.notify(event).status_code, 503)
        self.assert_unpaid()

    def test_amount_currency_reference_and_partial_capture_require_review(self):
        self.remote_capture()
        original = copy.deepcopy(self.provider.records[self.provider_id])
        for field in ['amount', 'currency', 'custom', 'reference', 'partial']:
            with self.subTest(field=field):
                record = copy.deepcopy(original); unit = record['purchase_units'][0]
                if field == 'amount': unit['amount']['value'] = '0.01'
                if field == 'currency': unit['amount']['currency_code'] = 'USD'
                if field == 'custom': unit['custom_id'] = 'another-order'
                if field == 'reference': unit['reference_id'] = 'another-intent'
                if field == 'partial': unit['payments']['captures'][0]['final_capture'] = False
                self.provider.records[self.provider_id] = record
                response = self.notify()
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['outcome'], 'review_required')
                self.assert_unpaid()

    def test_changed_local_total_is_never_overwritten_by_notification(self):
        self.remote_capture(); Order.objects.filter(pk=self.order.pk).update(total_amount=99)
        self.assertEqual(self.notify().data['outcome'], 'review_required')
        self.assert_unpaid()

    def test_unknown_or_ambiguous_order_binding_does_not_pay(self):
        event = self.event(); event['resource']['supplementary_data']['related_ids']['order_id'] = 'UNMATCHED'
        self.assertEqual(self.notify(event).data['outcome'], 'unmatched_order')
        Order.objects.create(user=self.buyer, total_amount=40, payment_method='paypal', payment_instructions=self.order.payment_instructions)
        self.remote_capture()
        self.assertEqual(self.notify().data['outcome'], 'unmatched_order')
        self.assert_unpaid()

    def test_refund_record_preserved_and_cancelled_remote_payment_recorded_separately(self):
        self.remote_capture()
        Order.objects.filter(pk=self.order.pk).update(payment_status='refunded')
        self.assertEqual(self.notify().data['outcome'], 'refund_record_preserved')
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_status, 'refunded')
        self.assertFalse(PaymentEvent.objects.exists())
        Order.objects.filter(pk=self.order.pk).update(payment_status='unpaid', status='cancelled')
        self.assertEqual(self.notify().status_code, 200)
        self.order.refresh_from_db(); self.assertEqual(self.order.status, 'cancelled')
        self.assertEqual(self.order.payment_status, 'paid')

    def test_cookie_or_csrf_absence_does_not_replace_provider_authentication(self):
        self.remote_capture()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.buyer)
        self.assertEqual(self.notify(headers={}).status_code, 400)
        self.assertEqual(self.notify().status_code, 200)
        self.provider.verify_notification.assert_called_once()

    def test_malformed_body_and_untrusted_certificate_rejected_before_provider(self):
        for event in [[], {'id':[]}, {'id':'WH-EVENT', 'event_type':[]}]:
            self.assertEqual(self.client.post(WEBHOOK, event, format='json', **HEADERS).status_code, 400)
        headers = dict(HEADERS, HTTP_PAYPAL_CERT_URL='https://evil.example/cert')
        self.assertEqual(self.notify(headers=headers).status_code, 400)
        self.assertEqual(self.client.post(WEBHOOK, {'id':'WH-EVENT','event_type':'x','padding':'a'*128000}, format='json', **HEADERS).status_code, 413)
        self.factory.assert_not_called()

    def test_owner_can_check_without_customer_account_or_new_charge(self):
        self.remote_capture(); self.client.force_authenticate(self.owner)
        response = self.client.post(self.owner_url, {'action':'capture','amount':'0.01'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['payment_status'], 'paid')
        receipt = PaymentEvent.objects.get(); self.assertEqual(receipt.actor_id, self.owner.pk)
        self.assertEqual(self.client.post(self.owner_url).status_code, 200)
        self.assertEqual(PaymentEvent.objects.count(), 1)
        self.assertEqual(len(self.provider.creates), 1); self.assertEqual(len(self.provider.captures), 1)
        data = self.client.get(self.ledger_url).data
        self.assertEqual(data['paypal_recovery']['checked_via'], 'owner')
        self.assertIsNotNone(data['paypal_recovery']['checked_at'])

    def test_owner_pending_or_approved_check_does_not_capture(self):
        self.client.force_authenticate(self.owner)
        self.provider.records[self.provider_id]['status'] = 'APPROVED'
        response = self.client.post(self.owner_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['state'], 'approved')
        self.assertFalse(self.provider.captures); self.assert_unpaid()

    def test_owner_permissions_csrf_and_non_paypal_order_boundary(self):
        self.assertIn(self.client.post(self.owner_url).status_code, [401,403])
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.post(self.owner_url).status_code, 403)
        csrf = APIClient(enforce_csrf_checks=True); csrf.force_login(self.owner)
        self.assertEqual(csrf.post(self.owner_url).status_code, 403)
        self.client.force_authenticate(self.owner)
        Order.objects.filter(pk=self.order.pk).update(payment_method='cod')
        self.assertEqual(self.client.post(self.owner_url).status_code, 404)
        self.assertEqual(self.client.get(self.owner_url).status_code, 405)

    def test_owner_unconfigured_not_started_or_refunded_never_calls_provider(self):
        self.client.force_authenticate(self.owner)
        with override_settings(PAYPAL_SANDBOX_ENABLED=False):
            self.assertEqual(self.client.post(self.owner_url).status_code, 503)
        Order.objects.filter(pk=self.order.pk).update(payment_status='refunded')
        self.assertEqual(self.client.post(self.owner_url).status_code, 409)
        Order.objects.filter(pk=self.order.pk).update(payment_status='unpaid', payment_instructions={})
        self.assertEqual(self.client.post(self.owner_url).status_code, 409)
        self.assertFalse(self.provider.captures); self.assert_unpaid()

    def test_owner_provider_failure_is_safe_to_retry(self):
        self.client.force_authenticate(self.owner); self.provider.fail_get = True
        self.assertEqual(self.client.post(self.owner_url).status_code, 503)
        self.assert_unpaid()
        self.provider.fail_get = False; self.remote_capture()
        self.assertEqual(self.client.post(self.owner_url).data['payment_status'], 'paid')

    def test_unique_receipt_returned_after_a_race_is_checked_again(self):
        self.remote_capture(); self.client.force_authenticate(self.owner)
        other = Order.objects.create(user=self.buyer, total_amount=45)
        foreign = PaymentEvent.objects.create(order=other, request_id=uuid.uuid4(), kind='receipt', outcome='completed',
            amount=45, source='paypal_sandbox', method='paypal', reference=self.capture_id)
        with patch('myapp.views.paypal.PaymentEvent.objects.get_or_create', return_value=(foreign, False)):
            self.assertEqual(self.client.post(self.owner_url).status_code, 409)
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertEqual(PaymentEvent.objects.count(), 1)


@override_settings(PAYPAL_SANDBOX_ENABLED=True, PAYPAL_SANDBOX_CLIENT_ID='fixture-id',
                   PAYPAL_SANDBOX_CLIENT_SECRET='fixture-secret', PAYPAL_SANDBOX_WEBHOOK_ID='WH-configured')
class NotificationTransportTests(TestCase):
    def test_verification_uses_fixed_sandbox_host_and_configured_webhook_id(self):
        replies = [{'access_token':'fixture-token'}, {'verification_status':'SUCCESS'}]
        opener = MagicMock()
        opener.open.side_effect = [MagicMock(__enter__=lambda self,r=r:MagicMock(read=lambda n:json.dumps(r).encode()), __exit__=lambda *args:None) for r in replies]
        headers = {key.removeprefix('HTTP_').replace('_','-'):value for key,value in HEADERS.items()}
        with patch('myapp.services.paypal.build_opener', return_value=opener):
            self.assertTrue(SandboxClient().verify_notification({'id':'WH-event'}, headers))
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, API+'/v1/notifications/verify-webhook-signature')
        payload = json.loads(request.data)
        self.assertEqual(payload['webhook_id'], 'WH-configured')
        self.assertEqual(payload['webhook_event'], {'id':'WH-event'})
        self.assertEqual(payload['transmission_sig'], 'Zml4dHVyZQ==')
        self.assertTrue(all(call.kwargs['timeout']==8 for call in opener.open.call_args_list))

    def test_only_explicit_verification_success_is_accepted(self):
        with patch('myapp.services.paypal.SandboxClient.__init__', return_value=None):
            client = SandboxClient(); client.request = Mock()
            headers = {key.removeprefix('HTTP_').replace('_','-'):value for key,value in HEADERS.items()}
            for result in [{}, {'verification_status':'FAILURE'}, {'verification_status':True}]:
                client.request.return_value = result
                self.assertFalse(client.verify_notification({}, headers))

    def test_headers_reject_url_tricks_and_invalid_transmission_metadata(self):
        headers = {key.removeprefix('HTTP_').replace('_','-'):value for key,value in HEADERS.items()}
        self.assertIsNotNone(notification_headers(headers))
        for value in ['https://evil.example/cert', 'http://api.paypal.com/v1/notifications/certs/CERT-a',
            'https://api.paypal.com.evil.example/v1/notifications/certs/CERT-a',
            'https://user@api.paypal.com/v1/notifications/certs/CERT-a',
            'https://api.paypal.com:123/v1/notifications/certs/CERT-a',
            'https://api.paypal.com/v1/notifications/certs/CERT-a?url=evil']:
            self.assertIsNone(notification_headers({**headers,'PAYPAL-CERT-URL':value}))
        for key,value in [('PAYPAL-TRANSMISSION-TIME','not-a-time'), ('PAYPAL-TRANSMISSION-TIME','2026-10-19T10:00:00'),
                          ('PAYPAL-AUTH-ALGO','none'), ('PAYPAL-TRANSMISSION-SIG','x'*4097)]:
            self.assertIsNone(notification_headers({**headers,key:value}))
