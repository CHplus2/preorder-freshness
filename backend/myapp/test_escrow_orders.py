import copy
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order,OrderItem,Product,Storefront,PaymentEvent,Address,CartItem
from .services.escrow import digest,calldata,SepoliaClient,EscrowError

BUYER='0x'+'1'*40
SELLER='0x'+'2'*40
ARBITER='0x'+'3'*40
CONTRACT='0x'+'4'*40
TX='0x'+'5'*64
BLOCK='0x'+'6'*64
CODE='0x60016000'

class FakeChain:
    def __init__(self):self.invoice=None;self.state=1;self.head=103;self.fail=False;self.change=None;self.network='0xaa36a7';self.code=CODE
    def batch(self,calls):
        if self.fail:raise EscrowError()
        i=self.invoice
        receipt=dict(transactionHash=TX,status='0x1',blockNumber='0x64',blockHash=BLOCK,to=CONTRACT,**{'from':BUYER},
            logs=[dict(address=CONTRACT,topics=[digest(b'Changed(bytes32,uint8)'),i['reference']],data='0x1',removed=False)])
        tx=dict(hash=TX,blockNumber='0x64',blockHash=BLOCK,to=CONTRACT,**{'from':BUYER},value=hex(int(i['amount_wei'])),input=calldata(i))
        if self.change:self.change(receipt,tx)
        values=[int(i[k],16) for k in ['buyer','seller','arbiter']]+[int(i['amount_wei']),i['dispatch_by'],i['dispatch_by']+7*86400,self.state]
        result='0x'+''.join(hex(v)[2:].zfill(64) for v in values)
        data={'eth_chainId':self.network,'eth_blockNumber':hex(self.head),'eth_getTransactionReceipt':receipt,
            'eth_getTransactionByHash':tx,'eth_getCode':self.code,'eth_call':result}
        return [dict(hash=BLOCK,number=params[0],timestamp=hex(i['dispatch_by']-300)) if name=='eth_getBlockByNumber' else copy.deepcopy(data[name]) for name,params in calls]

@override_settings(ESCROW_SEPOLIA_ENABLED=True,ESCROW_RPC_URL='https://rpc.example.invalid/',ESCROW_CONTRACT_ADDRESS=CONTRACT,
    ESCROW_SELLER_ADDRESS=SELLER,ESCROW_ARBITER_ADDRESS=ARBITER,ESCROW_WEI_PER_MYR='1000000000000',ESCROW_MIN_CONFIRMATIONS='3')
class EscrowOrderTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.buyer=User.objects.create_user('escrow-buyer');self.other=User.objects.create_user('escrow-other');self.owner=User.objects.create_user('escrow-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.delivery=(timezone.localtime()+timedelta(days=3)).replace(hour=18,minute=0,second=0,microsecond=0)
        self.order=Order.objects.create(user=self.buyer,total_amount='25.00',shipping_fee=5,payment_method='escrow',delivery_at=self.delivery,
            preparation_at=self.delivery-timedelta(hours=2),preparation_end_at=self.delivery-timedelta(minutes=90),preparation_plan={'tasks':[]})
        self.product=Product.objects.create(name='Escrow meal',price=25,lead_hours=0,preparation_tasks=[dict(name='Cook',minutes=30,resource='stove',worker=True,max_wait_minutes=0)])
        OrderItem.objects.create(order=self.order,product=self.product,quantity=1,unit_price=25,subtotal=25,product_name=self.product.name)
        self.url=f'/api/orders/{self.order.pk}/escrow/'
        self.chain=FakeChain();self.addCleanup(patch.stopall)
        patch('myapp.views.escrow.SepoliaClient',return_value=self.chain).start()
        patch('myapp.services.escrow.runtime_hash',return_value=digest(bytes.fromhex(CODE[2:]))).start()
    def create(self):
        r=self.client.post(self.url,{'action':'create','buyer':BUYER},format='json');self.assertEqual(r.status_code,200,r.data)
        self.chain.invoice=r.data['invoice'];return r
    def verify(self):return self.client.post(self.url,{'action':'verify','transaction_hash':TX},format='json')
    def test_checkout_can_record_escrow_without_marking_paid(self):
        Storefront.objects.create(pk=1)
        address=Address.objects.create(user=self.buyer,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0123456789')
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        response=self.client.post('/api/orders/place/',{'address_id':address.pk,'payment':'escrow','delivery_at':self.delivery.isoformat()},format='json')
        self.assertEqual(response.status_code,201,response.data)
        order=Order.objects.get(pk=response.data['order_id']);self.assertEqual(order.payment_method,'escrow');self.assertEqual(order.payment_status,'unpaid')
    def test_invoice_is_bound_to_server_total_and_reused(self):
        r=self.create();i=r.data['invoice'];self.assertEqual(i['amount_myr'],'30.00');self.assertEqual(i['amount_wei'],'30000000000000')
        again=self.create();self.assertEqual(again.data['invoice']['reference'],i['reference'])
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
        r=self.client.post(self.url,{'action':'create','buyer':BUYER,'amount_wei':'1'},format='json');self.assertEqual(r.status_code,400)
    def test_funding_and_refund_record_once_without_progress_or_stock_changes(self):
        self.create();r=self.verify();self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['payment_status'],'paid');self.assertEqual(r.data['invoice']['confirmations'],3);self.assertEqual(r.data['invoice']['observed_confirmations'],4)
        self.verify();self.assertEqual(PaymentEvent.objects.filter(kind='receipt').count(),1)
        self.chain.state=5;r=self.verify();self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['payment_status'],'refunded')
        self.verify();self.assertEqual(PaymentEvent.objects.filter(kind='refund').count(),1)
        self.order.refresh_from_db();self.assertEqual(self.order.status,'pending');self.assertFalse(self.order.inventory_deducted)
    def test_insufficient_confirmations_and_rpc_failure_never_mark_paid(self):
        self.create();self.chain.head=100;r=self.verify();self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['invoice']['state'],'pending')
        self.chain.fail=True;self.assertEqual(self.verify().status_code,503)
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
        self.assertEqual(self.order.payment_instructions['escrow_sepolia']['funding_hash'],TX)
    def test_wrong_sender_recipient_amount_calldata_event_and_block_rejected(self):
        self.create()
        mutations=[lambda r,t:t.update({'from':ARBITER}),lambda r,t:t.update(to=ARBITER),lambda r,t:t.update(value='0x1'),
            lambda r,t:t.update(input='0x1234'),lambda r,t:r.update(logs=[]),lambda r,t:r.update(blockHash='0x'+'a'*64)]
        for mutation in mutations:
            self.chain.change=mutation
            r=self.verify();self.assertEqual(r.status_code,409,r.data)
            self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
    def test_manual_owner_payment_and_refund_bypass_are_blocked(self):
        import uuid
        self.client.force_authenticate(self.owner)
        for kind in ['receipt','refund']:
            if kind=='refund':Order.objects.filter(pk=self.order.pk).update(payment_status='paid')
            r=self.client.post(f'/api/admin/orders/{self.order.pk}/payments/',{'request_id':str(uuid.uuid4()),'kind':kind,'outcome':'completed','reference':'not verified'},format='json')
            self.assertEqual(r.status_code,400,r.data)
        self.assertFalse(PaymentEvent.objects.exists())
    def test_private_access_csrf_configuration_and_buyer_participants(self):
        for actor in [None,self.other]:
            self.client.force_authenticate(actor);self.assertIn(self.client.get(self.url).status_code,[401,403,404])
        self.client.force_authenticate(self.owner);self.assertEqual(self.client.get(self.url).status_code,200)
        self.assertEqual(self.client.post(self.url,{'action':'create','buyer':BUYER},format='json').status_code,400)
        self.client.force_authenticate(self.buyer)
        with override_settings(ESCROW_SEPOLIA_ENABLED=False):self.assertEqual(self.client.post(self.url,{'action':'create','buyer':BUYER},format='json').status_code,503)
        for value in [SELLER,ARBITER,'0x'+'0'*40]:self.assertEqual(self.client.post(self.url,{'action':'create','buyer':value},format='json').status_code,400)
        c=APIClient(enforce_csrf_checks=True);c.force_login(self.buyer);self.assertEqual(c.post(self.url,{'action':'create','buyer':BUYER},format='json').status_code,403)
    def test_delivery_and_total_cannot_change_behind_invoice(self):
        self.create()
        r=self.client.post(f'/api/orders/{self.order.pk}/reschedule/',{'delivery_at':(self.delivery+timedelta(days=1)).isoformat(),'reason':'Change'},format='json');self.assertEqual(r.status_code,400)
        self.order.refresh_from_db();self.order.total_amount=35;self.order.save();r=self.verify();self.assertEqual(r.status_code,409);self.assertFalse(PaymentEvent.objects.exists())
    def test_config_does_not_expose_rpc_credentials(self):
        with override_settings(ESCROW_RPC_URL='https://rpc.example.invalid/private-key-in-path'):
            r=self.client.get('/api/payments/escrow/config/');self.assertTrue(r.data['enabled']);self.assertNotIn('private-key-in-path',str(r.data))

    def test_wrong_chain_code_and_missing_escrow_state_never_record_payment(self):
        self.create()
        for field,value in [('network','0x1'),('code','0x6000'),('state',0)]:
            original=getattr(self.chain,field);setattr(self.chain,field,value)
            response=self.verify();self.assertEqual(response.status_code,409,response.data)
            self.assertFalse(PaymentEvent.objects.exists());setattr(self.chain,field,original)

    def test_public_rpc_errors_and_duplicate_batch_ids_fail_closed(self):
        from unittest.mock import MagicMock
        from .services.escrow import SepoliaClient
        import json
        client=SepoliaClient();response=MagicMock();response.__enter__.return_value=response
        client.opener=MagicMock();client.opener.open.return_value=response
        for raw in [b'{}',b'[{},{}]',b'[{"id":0,"result":"x"},{"id":0,"result":"y"}]',b'[{"id":0,"error":{"message":"secret"}}]']:
            response.read.return_value=raw
            with self.assertRaises(EscrowError):client.batch([('eth_chainId',[]),('eth_blockNumber',[])])

    def test_contradictory_confirmations_keep_paid_records_and_flag_review(self):
        self.create();self.verify();self.chain.head=100
        result=self.verify();self.assertEqual(result.status_code,409,result.data)
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'paid')
        self.assertEqual(PaymentEvent.objects.count(),1)
        self.assertIn('Owner review',self.order.payment_instructions['escrow_sepolia']['check_error'])

    def test_recovery_command_reconciles_once_and_does_not_send_transactions(self):
        from django.core.management import call_command
        from io import StringIO
        self.create();self.chain.head=100;self.verify();self.chain.head=103
        with patch('myapp.management.commands.reconcile_escrow_orders.SepoliaClient',return_value=self.chain):
            output=StringIO();call_command('reconcile_escrow_orders',order_id=[self.order.pk],stdout=output)
            self.assertIn('paid',output.getvalue())
            call_command('reconcile_escrow_orders',order_id=[self.order.pk],stdout=StringIO())
        self.assertEqual(PaymentEvent.objects.filter(kind='receipt').count(),1)

    def test_conflicting_refund_reference_rolls_back_new_receipt(self):
        import uuid
        self.create();self.chain.state=5
        other=Order.objects.create(user=self.other,total_amount=1,payment_status='paid')
        PaymentEvent.objects.create(order=other,request_id=uuid.uuid5(uuid.NAMESPACE_URL,f"sepolia-refund:{CONTRACT}:{self.chain.invoice['reference']}"),
            kind='refund',outcome='completed',amount=1,method='cod',reference='Other record',source='owner_verified')
        result=self.verify();self.assertEqual(result.status_code,409,result.data)
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'unpaid')
        self.assertFalse(PaymentEvent.objects.filter(order=self.order).exists())
