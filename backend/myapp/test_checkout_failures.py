"""Failure injection uses synthetic records and mocked persistence, never live payments."""
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront, Product, CartItem, Address, Order, OrderItem, Wallet, WalletTransaction, PaymentEvent

class CheckoutFailureTests(TestCase):
    def setUp(self):
        self.buyer=User.objects.create_user('failure-buyer')
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        Storefront.objects.create(pk=1)
        product=Product.objects.create(name='Test meal',price=12,lead_hours=1)
        CartItem.objects.create(user=self.buyer,product=product,quantity=1)
        address=Address.objects.create(user=self.buyer,line1='Test',city='KL',state='KL',postal_code='50000',phone='0100000000')
        delivery=(timezone.localtime()+timedelta(days=4)).replace(hour=16,minute=0,second=0)
        self.body=dict(address_id=address.pk,payment='cod',delivery_at=delivery.isoformat(),request_id=str(uuid.uuid4()))

    @patch('myapp.exceptions.logger.error')
    def test_failed_item_write_rolls_back_order_and_preserves_basket(self,log):
        with patch('myapp.views.orders.OrderItem.objects.create',side_effect=RuntimeError('private failure')):
            response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,500)
        self.assertIn('reference',response.data)
        self.assertNotIn('private',str(response.data))
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderItem.objects.exists())
        self.assertTrue(CartItem.objects.filter(user=self.buyer).exists())
        retry=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(retry.status_code,201,retry.data)
        repeated=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(repeated.data['order_id'],retry.data['order_id'])
        self.assertEqual(Order.objects.count(),1)

    @patch('myapp.exceptions.logger.error')
    def test_failure_after_demo_wallet_debit_rolls_back_balance_and_receipts(self,log):
        wallet=Wallet.objects.create(user=self.buyer,balance=100,wallet_address='isolated-test-wallet')
        self.body['payment']='wallet'
        with patch('myapp.views.orders.OrderItem.objects.create',side_effect=RuntimeError('write failed')):
            response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,500)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance,Decimal('100'))
        self.assertFalse(Order.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertTrue(CartItem.objects.filter(user=self.buyer).exists())
