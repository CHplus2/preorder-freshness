import uuid
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APIClient
from .models import Wallet,WalletTransaction,Product,CartItem,Address,Storefront,Order,OrderItem,PaymentEvent


class WalletIntegrityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.buyer=User.objects.create_user('credit-buyer')
        self.other=User.objects.create_user('other-credit-buyer')
        self.wallet=Wallet.objects.create(user=self.buyer,balance=10,wallet_address='credit-fixture')
        self.foreign=Wallet.objects.create(user=self.other,balance=30,wallet_address='other-credit-fixture')
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.url='/api/wallet/topup/'

    def test_rejects_invalid_nonfinite_oversized_and_fractional_cent_amounts(self):
        for value in ['NaN','Infinity','-Infinity','no-number',None,True,{},[],0,-1,'0.001','100000000.00']:
            with self.subTest(value=value):
                response=self.client.post(self.url,{'amount':value},format='json')
                self.assertEqual(response.status_code,400)
                self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('10'))
        self.assertFalse(WalletTransaction.objects.exists())

    def test_repeat_topup_reference_credits_once_and_uses_current_balance(self):
        body={'amount':'12.50','request_id':str(uuid.uuid4()),'user':self.other.pk,'wallet':self.foreign.pk}
        first=self.client.post(self.url,body,format='json');self.assertEqual(first.status_code,200,first.data)
        self.assertEqual(self.client.post(self.url,body,format='json').status_code,200)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('22.50'))
        self.foreign.refresh_from_db();self.assertEqual(self.foreign.balance,Decimal('30'))
        self.assertEqual(WalletTransaction.objects.filter(type='deposit').count(),1)
        changed=self.client.post(self.url,{**body,'amount':'13.00'},format='json')
        self.assertEqual(changed.status_code,400)

    @patch('myapp.exceptions.logger.error')
    def test_ledger_failure_rolls_back_credit(self,log):
        with patch('myapp.views.wallet.WalletTransaction.objects.create',side_effect=RuntimeError('fixture failure')):
            response=self.client.post(self.url,{'amount':'5.00','request_id':str(uuid.uuid4())},format='json')
        self.assertEqual(response.status_code,500)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('10'))
        self.assertFalse(WalletTransaction.objects.exists())

    def test_balance_ceiling_and_request_reference_validation(self):
        self.wallet.balance=Decimal('99999999.98');self.wallet.save()
        self.assertEqual(self.client.post(self.url,{'amount':'.02'},format='json').status_code,400)
        self.assertEqual(self.client.post(self.url,{'amount':'.01','request_id':'bad'},format='json').status_code,400)
        self.assertFalse(WalletTransaction.objects.exists())

    def test_duplicate_wallet_creation_returns_same_account_wallet(self):
        for _ in range(2):
            response=self.client.post('/api/wallet/create/',{'user':self.other.pk},format='json')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.data['id'],self.wallet.pk)
        self.assertEqual(Wallet.objects.filter(user=self.buyer).count(),1)

    def test_cannot_topup_without_session_and_csrf(self):
        anon=APIClient();self.assertEqual(anon.post(self.url,{'amount':5}).status_code,403)
        csrf=APIClient(enforce_csrf_checks=True);csrf.force_login(self.buyer)
        self.assertEqual(csrf.post(self.url,{'amount':5}).status_code,403)

    def test_repeated_credit_writes_are_throttled_before_second_credit(self):
        with patch('myapp.views.wallet.DemoCreditThrottle.rate','1/min'):
            self.assertEqual(self.client.post(self.url,{'amount':1},format='json').status_code,200)
            self.assertEqual(self.client.post(self.url,{'amount':1},format='json').status_code,429)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('11'))

    def test_refund_above_balance_limit_preserves_payment_and_ledger(self):
        owner=User.objects.create_user('credit-owner',is_staff=True)
        self.client.force_authenticate(owner)
        order=Order.objects.create(user=self.buyer,payment_method='wallet',payment_status='paid',total_amount=5)
        self.wallet.balance=Decimal('99999999.00');self.wallet.save()
        response=self.client.post(f'/api/admin/orders/{order.pk}/payments/',{
            'request_id':str(uuid.uuid4()),'kind':'refund','outcome':'completed','reference':'fixture-refund'},format='json')
        self.assertEqual(response.status_code,400,response.data)
        order.refresh_from_db();self.assertEqual(order.payment_status,'paid')
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('99999999.00'))
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(PaymentEvent.objects.exists())


class BasketPrivacyTests(TestCase):
    def setUp(self):
        self.buyer=User.objects.create_user('cart-private-buyer')
        self.other=User.objects.create_user('cart-private-other')
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.product=Product.objects.create(name='Menu',price=10,packaging_cost=Decimal('4.25'))
        self.cart=CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        self.foreign=CartItem.objects.create(user=self.other,product=self.product,quantity=2)

    def test_cart_responses_do_not_disclose_private_menu_cost(self):
        responses=[self.client.get('/api/cart/'),self.client.post('/api/cart/',{'product_id':self.product.pk,'quantity':1},format='json'),
            self.client.patch(f'/api/cart/{self.cart.pk}/',{'quantity':3},format='json')]
        for response in responses:
            self.assertIn(response.status_code,[200,201])
            rows=response.data if isinstance(response.data,list) else [response.data]
            self.assertTrue(rows)
            for row in rows:self.assertNotIn('packaging_cost',row['product'])

    def test_foreign_cart_rows_cannot_be_changed_or_deleted(self):
        url=f'/api/cart/{self.foreign.pk}/'
        self.assertEqual(self.client.patch(url,{'quantity':100},format='json').status_code,404)
        self.assertEqual(self.client.delete(url).status_code,404)
        self.foreign.refresh_from_db();self.assertEqual(self.foreign.quantity,2)

    def test_saved_address_get_does_not_lock_customer_for_other_operations(self):
        Address.objects.create(user=self.buyer,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0100000000')
        with patch('django.contrib.auth.models.User.objects.select_for_update',side_effect=AssertionError('GET must not reserve customer lock')):
            self.assertEqual(self.client.get('/api/address/').status_code,200)


class CheckoutAmountBoundaryTests(TestCase):
    def setUp(self):
        self.buyer=User.objects.create_user('amount-buyer')
        self.other=User.objects.create_user('amount-other')
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1,bulk_minimum=2,bulk_discount_percent=10)
        self.product=Product.objects.create(name='Server priced meal',price=12,lead_hours=0)
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=2)
        self.address=Address.objects.create(user=self.buyer,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0100000000')
        self.body={'address_id':self.address.pk,'payment':'manual','request_id':str(uuid.uuid4()),
            'delivery_at':(timezone.localtime()+timedelta(days=5)).replace(hour=18,minute=0,second=0,microsecond=0).isoformat()}

    def test_client_totals_user_and_paid_claim_cannot_change_checkout_price(self):
        response=self.client.post('/api/orders/place/',{**self.body,'user':self.other.pk,'total_amount':'.01',
            'shipping_fee':0,'discount_amount':999,'payment_status':'paid'},format='json')
        self.assertEqual(response.status_code,201,response.data)
        order=Order.objects.get(pk=response.data['order_id'])
        self.assertEqual(order.user_id,self.buyer.pk);self.assertEqual(order.payment_status,'unpaid')
        self.assertEqual(order.total_amount+order.shipping_fee,Decimal('26.60'))
        self.assertEqual(order.items.get().unit_price,Decimal('12'))

    def test_foreign_address_and_checkout_reference_do_not_clear_basket(self):
        foreign=Address.objects.create(user=self.other,line1='Foreign fixture',city='KL',state='KL',postal_code='50000',phone='0100000000')
        response=self.client.post('/api/orders/place/',{**self.body,'address_id':foreign.pk},format='json')
        self.assertEqual(response.status_code,404)
        Order.objects.create(user=self.other,checkout_request_id=self.body['request_id'])
        self.assertEqual(self.client.post('/api/orders/place/',self.body,format='json').status_code,400)
        self.assertTrue(CartItem.objects.filter(user=self.buyer).exists())
        self.assertFalse(Order.objects.filter(user=self.buyer).exists())

    def test_order_history_query_count_does_not_grow_per_order(self):
        def add():
            order=Order.objects.create(user=self.buyer,total_amount=12,address=self.address)
            OrderItem.objects.create(order=order,product=self.product,product_name=self.product.name,quantity=1,unit_price=12,subtotal=12)
        add()
        with CaptureQueriesContext(connection) as small:
            self.assertEqual(self.client.get('/api/orders/').status_code,200)
        for _ in range(19):add()
        with CaptureQueriesContext(connection) as larger:
            response=self.client.get('/api/orders/')
        self.assertEqual(len(response.data['results']),10)
        self.assertEqual(response.data['counts']['all'],20)
        self.assertIsNotNone(response.data['next_before'])
        self.assertEqual(len(small),len(larger))
        self.assertLessEqual(len(larger),3)
