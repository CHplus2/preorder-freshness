"""Sandbox provider doubles exercise the actual Django payment/order boundaries."""
import copy
import json
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Address, CartItem, Order, OrderItem, PaymentEvent, Product, Storefront
from .services.paypal import PayPalError, SandboxClient


class FakePayPal:
    def __init__(self):
        self.records={};self.creates=[];self.captures=[];self.fail_create=False
        self.lost_capture=False;self.pending=False;self.capture_error=False;self.fail_get=False
    def create(self,intent):
        self.creates.append(copy.deepcopy(intent))
        key=intent['request_id'];order_id='PP'+uuid.UUID(key).hex.upper()
        if order_id not in self.records:
            self.records[order_id]={'id':order_id,'intent':'CAPTURE','status':'CREATED','purchase_units':[{
                'reference_id':key,'custom_id':intent['custom_id'],'amount':{'currency_code':'MYR','value':intent['amount']}}]}
        if self.fail_create:raise PayPalError()
        return {'id':order_id}
    def get(self,order_id):
        if self.fail_get:raise PayPalError()
        return copy.deepcopy(self.records[order_id])
    def capture(self,order_id,request_id):
        self.captures.append((order_id,request_id))
        if self.capture_error:raise PayPalError()
        record=self.records[order_id];record['status']='COMPLETED'
        record['purchase_units'][0]['payments']={'captures':[{'id':'CAP'+order_id[2:],'status':'PENDING' if self.pending else 'COMPLETED','final_capture':True,
            'amount':copy.deepcopy(record['purchase_units'][0]['amount'])}]}
        if self.lost_capture:raise PayPalError()
        return copy.deepcopy(record)


@override_settings(PAYPAL_SANDBOX_ENABLED=True,PAYPAL_SANDBOX_CLIENT_ID='sandbox-public-id',PAYPAL_SANDBOX_CLIENT_SECRET='sandbox-test-secret')
class PayPalTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.buyer=User.objects.create_user('paypal-buyer',password='fixture-password')
        self.other=User.objects.create_user('other-buyer');self.owner=User.objects.create_user('paypal-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.store=Storefront.objects.create(pk=1,bulk_minimum=10,bulk_discount_percent=10)
        self.delivery=(timezone.localtime()+timedelta(days=4)).replace(hour=18,minute=0,second=0,microsecond=0)
        self.product=Product.objects.create(name='Sandbox meal',price=10,lead_hours=0,preparation_tasks=[dict(name='Cook',minutes=30,worker=True,resource='stove',max_wait_minutes=0,additional_batch_minutes=0,overnight=False)])
        self.address=Address.objects.create(user=self.buyer,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0123456789')
        self.order=self.new_order()
        self.provider=FakePayPal();self.factory=patch('myapp.views.paypal.SandboxClient',return_value=self.provider).start();self.addCleanup(patch.stopall)
        self.url=f'/api/orders/{self.order.pk}/paypal/'
    def new_order(self):
        order=Order.objects.create(user=self.buyer,total_amount='90.07',shipping_fee=5,payment_method='paypal',delivery_at=self.delivery,
            preparation_at=self.delivery-timedelta(hours=2),preparation_end_at=self.delivery-timedelta(minutes=90),preparation_plan={'tasks':[{'name':'Cook','menu':self.product.name,'resource':'stove','worker':True,'start':(self.delivery-timedelta(hours=2)).isoformat(),'end':(self.delivery-timedelta(minutes=90)).isoformat()}]})
        OrderItem.objects.create(order=order,product=self.product,product_name=self.product.name,quantity=1,unit_price=10,subtotal=10)
        return order
    def post(self,action,**extra):
        return self.client.post(self.url,dict(action=action,**extra),format='json')
    def create(self):
        result=self.post('create');self.assertEqual(result.status_code,200,result.data);return result.data['paypal_order_id']
    def approve(self):
        provider_id=self.create();self.provider.records[provider_id]['status']='APPROVED';return provider_id
    def capture(self,provider_id):
        return self.post('capture',paypal_order_id=provider_id)
    def test_config_exposes_only_public_id_and_is_not_cached(self):
        r=self.client.get('/api/payments/paypal/config/');self.assertEqual(r.status_code,200)
        self.assertTrue(r.data['enabled']);self.assertTrue(r.data['sandbox']);self.assertEqual(r.data['currency'],'MYR')
        self.assertNotIn(settings.PAYPAL_SANDBOX_CLIENT_SECRET,json.dumps(r.data));self.assertEqual(r['Cache-Control'],'no-store')
        with override_settings(PAYPAL_SANDBOX_ENABLED=False):
            r=self.client.get('/api/payments/paypal/config/');self.assertFalse(r.data['enabled']);self.assertEqual(r.data['client_id'],'')
    def test_missing_credentials_fail_closed_without_provider_or_paid_record(self):
        with override_settings(PAYPAL_SANDBOX_CLIENT_SECRET=''):
            self.assertEqual(self.post('create').status_code,503)
        self.factory.assert_not_called();self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid')
    def test_requires_authentication_and_own_order_even_for_staff(self):
        for user in [self.other,self.owner]:
            self.client.force_authenticate(user);self.assertEqual(self.client.get(self.url).status_code,404);self.assertEqual(self.post('create').status_code,404)
        self.client.force_authenticate(None);self.assertIn(self.post('create').status_code,[401,403]);self.factory.assert_not_called()
    def test_session_mutation_requires_csrf(self):
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.buyer)
        self.assertEqual(client.post(self.url,{'action':'create'},format='json').status_code,403);self.factory.assert_not_called()
    def test_create_uses_recorded_total_and_reuses_provider_request(self):
        r=self.post('create',amount='0.01',currency='USD',capture_id='FORGED');self.assertEqual(r.status_code,200,r.data)
        provider_id=r.data['paypal_order_id'];self.assertEqual(self.provider.creates[0]['amount'],'95.07')
        self.product.price=999;self.product.save()
        self.assertEqual(self.create(),provider_id);self.assertEqual(len(self.provider.creates),1)
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
    def test_create_timeout_reuses_durable_id_and_does_not_create_second_payment(self):
        self.provider.fail_create=True;self.assertEqual(self.post('create').status_code,502)
        self.order.refresh_from_db();first=copy.deepcopy(self.order.payment_instructions['paypal_sandbox'])
        self.provider.fail_create=False;self.create()
        self.assertEqual(self.provider.creates[0]['request_id'],self.provider.creates[1]['request_id'])
        self.assertEqual(self.provider.creates[1]['capture_request_id'],first['capture_request_id']);self.assertEqual(len(self.provider.records),1)
    def test_capture_verifies_server_response_and_is_idempotent(self):
        provider_id=self.approve();r=self.capture(provider_id);self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data['state'],'completed');self.assertEqual(r.data['payment_status'],'paid')
        self.order.refresh_from_db();self.assertEqual(self.order.status,'pending');self.assertFalse(self.order.inventory_deducted)
        event=PaymentEvent.objects.get();self.assertEqual(event.amount,Decimal('95.07'));self.assertEqual(event.source,'paypal_sandbox');self.assertEqual(event.method,'paypal')
        self.assertEqual(self.capture(provider_id).status_code,200);self.assertEqual(len(self.provider.captures),1);self.assertEqual(PaymentEvent.objects.count(),1)
    def test_capture_rejects_forged_reference_without_contacting_provider(self):
        self.approve();calls=self.factory.call_count
        self.assertEqual(self.capture('FORGED').status_code,409);self.assertEqual(self.factory.call_count,calls)
        self.assertEqual(self.post('capture').status_code,409);self.assertFalse(self.provider.captures)
    def test_no_capture_without_payer_approval(self):
        provider_id=self.create();self.assertEqual(self.capture(provider_id).status_code,409);self.assertFalse(self.provider.captures)
    def test_lost_capture_response_is_reconciled_without_second_capture(self):
        provider_id=self.approve();self.provider.lost_capture=True
        r=self.capture(provider_id);self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['payment_status'],'paid')
        self.capture(provider_id);self.assertEqual(len(self.provider.captures),1);self.assertEqual(PaymentEvent.objects.count(),1)
    def test_provider_pending_is_unpaid_until_refresh_confirms_completed(self):
        provider_id=self.approve();self.provider.pending=True;r=self.capture(provider_id)
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['state'],'pending');self.assertFalse(r.data['can_pay']);self.assertEqual(r.data['payment_status'],'unpaid')
        self.assertFalse(PaymentEvent.objects.exists());self.assertEqual(len(self.provider.captures),1)
        self.provider.records[provider_id]['purchase_units'][0]['payments']['captures'][0]['status']='COMPLETED'
        r=self.post('refresh');self.assertEqual(r.data['payment_status'],'paid');self.assertEqual(len(self.provider.captures),1)
    def test_capture_failure_remains_unpaid_and_retries_same_key(self):
        provider_id=self.approve();self.provider.capture_error=True
        self.assertEqual(self.capture(provider_id).status_code,502);self.assertEqual(self.client.get(self.url).data['payment_status'],'unpaid')
        self.provider.capture_error=False;self.assertEqual(self.capture(provider_id).data['payment_status'],'paid')
        self.assertEqual(self.provider.captures[0],self.provider.captures[1]);self.assertEqual(PaymentEvent.objects.count(),1)
    def test_refresh_recovers_payment_after_remote_success_and_local_response_loss(self):
        provider_id=self.approve();self.provider.capture(provider_id,'fixture-call');r=self.post('refresh')
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['payment_status'],'paid');self.assertEqual(len(self.provider.captures),1)
    def test_amount_currency_binding_and_partial_capture_never_mark_paid(self):
        provider_id=self.approve();self.provider.capture(provider_id,'fixture-call')
        original=copy.deepcopy(self.provider.records[provider_id])
        for update in ['amount','currency','custom','reference','capture_amount','capture_currency','final','extra_capture','provider_id']:
            with self.subTest(update=update):
                record=copy.deepcopy(original);unit=record['purchase_units'][0];capture=unit['payments']['captures'][0]
                if update=='amount':unit['amount']['value']='0.01'
                if update=='currency':unit['amount']['currency_code']='USD'
                if update=='custom':unit['custom_id']='different local order'
                if update=='reference':unit['reference_id']='different intent'
                if update=='capture_amount':capture['amount']['value']='0.01'
                if update=='capture_currency':capture['amount']['currency_code']='USD'
                if update=='final':capture['final_capture']=False
                if update=='extra_capture':unit['payments']['captures'].append(copy.deepcopy(capture))
                if update=='provider_id':record['id']='DIFFERENT'
                self.provider.records[provider_id]=record
                self.assertEqual(self.post('refresh').status_code,409)
                self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
    def test_cancelled_or_unconfirmed_order_cannot_create_or_capture(self):
        provider_id=self.approve()
        for fields in [dict(status='cancelled'),dict(preparation_plan={'needs_review':True}),dict(preparation_at=None),dict(delivery_at=timezone.now()-timedelta(days=1))]:
            with self.subTest(fields=fields):
                old={k:getattr(self.order,k) for k in fields};Order.objects.filter(pk=self.order.pk).update(**fields)
                self.assertEqual(self.capture(provider_id).status_code,409);Order.objects.filter(pk=self.order.pk).update(**old)
        self.assertFalse(self.provider.captures)
    def test_refresh_records_remote_success_after_cancellation_without_new_capture(self):
        provider_id=self.approve();self.provider.capture(provider_id,'remote-fixture-call')
        Order.objects.filter(pk=self.order.pk).update(status='cancelled')
        r=self.post('refresh');self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data['order_status'],'cancelled');self.assertEqual(r.data['payment_status'],'paid')
        self.assertEqual(len(self.provider.captures),1);self.assertEqual(PaymentEvent.objects.count(),1)
    def test_recorded_total_change_blocks_capture(self):
        provider_id=self.approve();Order.objects.filter(pk=self.order.pk).update(total_amount=99)
        self.assertEqual(self.capture(provider_id).status_code,409);self.assertFalse(self.provider.captures)
    def test_old_ambiguous_intent_never_restarts_provider_post(self):
        self.provider.fail_create=True;self.post('create');self.order.refresh_from_db()
        intent=self.order.payment_instructions['paypal_sandbox'];intent['created_at']=(timezone.now()-timedelta(hours=6)).isoformat()
        self.order.payment_instructions['paypal_sandbox']=intent;self.order.save()
        self.provider.fail_create=False;self.assertEqual(self.post('create').status_code,409);self.assertEqual(len(self.provider.creates),1)
    def test_same_capture_cannot_pay_two_local_orders(self):
        first=self.approve();self.capture(first);self.order=self.new_order();self.url=f'/api/orders/{self.order.pk}/paypal/'
        second=self.approve();self.provider.capture(second,'fixture-call')
        self.provider.records[second]['purchase_units'][0]['payments']['captures'][0]['id']='CAP'+first[2:]
        self.assertEqual(self.post('refresh').status_code,409);self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertEqual(PaymentEvent.objects.count(),1)
    def test_owner_cannot_manually_mark_paypal_paid(self):
        self.client.force_authenticate(self.owner)
        r=self.client.post(f'/api/admin/orders/{self.order.pk}/payments/',dict(request_id=str(uuid.uuid4()),kind='receipt',outcome='completed',reference='Browser claim'),format='json')
        self.assertEqual(r.status_code,400);self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid')
    def test_checkout_creates_unpaid_order_with_server_discount_and_can_resume(self):
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=10)
        request_id=str(uuid.uuid4());body=dict(address_id=self.address.pk,payment='paypal',delivery_at=self.delivery.isoformat(),request_id=request_id)
        r=self.client.post('/api/orders/place/',body,format='json');self.assertEqual(r.status_code,201,r.data)
        created=Order.objects.get(pk=r.data['order_id']);self.assertEqual(created.payment_method,'paypal');self.assertEqual(created.payment_status,'unpaid');self.assertEqual(created.total_amount,Decimal('90.00'))
        self.assertTrue(created.preparation_plan['tasks']);self.assertFalse(CartItem.objects.exists())
        self.assertEqual(self.client.post('/api/orders/place/',body,format='json').data['order_id'],created.pk)
        self.url=f'/api/orders/{created.pk}/paypal/';self.create();self.assertEqual(self.provider.creates[0]['amount'],'90.00')
    def test_review_request_defers_payment_and_never_contacts_paypal(self):
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        with patch('myapp.services.scheduling.schedule_order',return_value=dict(needs_review=True,start=None,end=None,tasks=[],minutes=0,hands_on_minutes=0,delivery_buffer_minutes=90,reason='Owner review')):
            r=self.client.post('/api/orders/place/',dict(address_id=self.address.pk,payment='paypal',delivery_at=self.delivery.isoformat()),format='json')
        self.assertEqual(r.status_code,201,r.data);order=Order.objects.get(pk=r.data['order_id']);self.assertEqual(order.payment_method,'deferred');self.assertEqual(order.payment_status,'unpaid');self.factory.assert_not_called()
    def test_disabled_checkout_preserves_basket(self):
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        with override_settings(PAYPAL_SANDBOX_ENABLED=False):
            r=self.client.post('/api/orders/place/',dict(address_id=self.address.pk,payment='paypal',delivery_at=self.delivery.isoformat()),format='json')
        self.assertEqual(r.status_code,400);self.assertTrue(CartItem.objects.exists());self.assertEqual(Order.objects.count(),1)

@override_settings(PAYPAL_SANDBOX_ENABLED=True,PAYPAL_SANDBOX_CLIENT_ID='fixture-id',PAYPAL_SANDBOX_CLIENT_SECRET='fixture-secret')
class SandboxTransportTests(TestCase):
    def test_transport_uses_only_sandbox_and_preserves_idempotency_keys(self):
        from unittest.mock import MagicMock
        from .services.paypal import API, NoRedirect
        replies=[{'access_token':'fixture-access-token'},{'id':'PPTEST'},{'id':'PPTEST'},{'id':'PPTEST'}]
        opener=MagicMock();opener.open.side_effect=[MagicMock(__enter__=lambda self,r=r:MagicMock(read=lambda n:json.dumps(r).encode()),__exit__=lambda *args:None) for r in replies]
        with patch('myapp.services.paypal.build_opener',return_value=opener) as factory:
            client=SandboxClient();intent=dict(request_id=str(uuid.uuid4()),custom_id='local-binding',amount='95.07')
            client.create(intent);client.get('PPTEST');client.capture('PPTEST','stable-capture-key')
        self.assertIsInstance(factory.call_args.args[0],NoRedirect)
        requests=[call.args[0] for call in opener.open.call_args_list]
        self.assertTrue(all(r.full_url.startswith(API+'/') for r in requests))
        self.assertEqual(requests[1].get_header('Paypal-request-id'),intent['request_id'])
        self.assertEqual(requests[3].get_header('Paypal-request-id'),'stable-capture-key')
        self.assertEqual(json.loads(requests[1].data)['purchase_units'][0]['amount'],{'currency_code':'MYR','value':'95.07'})
        self.assertTrue(all(call.kwargs['timeout']==8 for call in opener.open.call_args_list))
    def test_provider_error_does_not_expose_payer_or_credentials(self):
        import io
        from urllib.error import HTTPError
        from unittest.mock import MagicMock
        opener=MagicMock();opener.open.side_effect=HTTPError('https://api-m.sandbox.paypal.com/v1/oauth2/token',401,'Unauthorized',{},io.BytesIO(b'{"payer":"private-person","secret":"fixture-secret"}'))
        with patch('myapp.services.paypal.build_opener',return_value=opener):
            with self.assertRaises(PayPalError) as error:SandboxClient()
        self.assertNotIn('private-person',str(error.exception));self.assertNotIn('fixture-secret',str(error.exception))
    def test_no_untrusted_provider_path_or_live_host(self):
        from unittest.mock import MagicMock
        with patch('myapp.services.paypal.SandboxClient.__init__',return_value=None):
            client=SandboxClient();client.request=MagicMock()
            for value in ['https://evil.example','../capture','id?x=1','id/other']:
                with self.assertRaises(PayPalError):client.get(value)
            client.request.assert_not_called()
