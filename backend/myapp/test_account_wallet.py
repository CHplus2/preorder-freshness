from datetime import timedelta
from decimal import Decimal
import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront, Product, CartItem, Address, Wallet, Order, PaymentEvent, WalletTransaction


class AccountWalletTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('buyer')
        self.other = User.objects.create_user('other')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        Storefront.objects.create(pk=1)
        self.address = Address.objects.create(user=self.user, is_default=True, line1='Test', city='KL', state='Kuala Lumpur', postal_code='50000', phone='0123456789')
        self.wallet = Wallet.objects.create(user=self.user, wallet_address='synthetic-wallet', balance=Decimal('8836.48'))
        for name,price,quantity in [('Fresh Milk',5,1),('Granola Bar',10,3),('Cabbage',9,2),('Dark Chocolate',11,2)]:
            product = Product.objects.create(name=name, price=price, batch_size=10, preparation_minutes=15)
            CartItem.objects.create(user=self.user, product=product, quantity=quantity)
        self.body = dict(address_id=self.address.pk, payment='wallet', request_id=str(uuid.uuid4()), delivery_at=(timezone.localtime()+timedelta(days=4)).replace(hour=12,minute=0,second=0).isoformat())

    def test_wallet_checkout_and_retry_debit_once(self):
        response = self.client.post('/api/orders/place/', self.body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.client.post('/api/orders/place/', self.body, format='json').status_code, 200)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal('8761.48'))
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(PaymentEvent.objects.filter(source='demo_wallet').count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(type='payment').count(), 1)

    def test_rejected_schedule_does_not_debit_or_create_order(self):
        self.body['delivery_at'] = (timezone.now()-timedelta(days=1)).isoformat()
        response = self.client.post('/api/orders/place/', self.body, format='json')
        self.assertEqual(response.status_code, 400)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal('8836.48'))
        self.assertFalse(Order.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())

    def test_multi_menu_preparation_rejection_is_not_a_payment_failure(self):
        Product.objects.update(batch_size=1, preparation_minutes=60)
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,400)
        self.assertIn('cannot fit',str(response.data))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance,Decimal('8836.48'))
        self.assertFalse(Order.objects.exists())

    def test_insufficient_credit_preserves_cart_and_creates_no_payment(self):
        self.wallet.balance=1
        self.wallet.save()
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,400)
        self.assertIn('Insufficient wallet balance',str(response.data))
        self.assertEqual(CartItem.objects.filter(user=self.user).count(),4)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_profile_cannot_modify_another_account_or_privileges(self):
        response = self.client.patch('/api/account/', {'first_name':'Aina','id':self.other.pk,'is_staff':True,'username':'other'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Aina')
        self.assertFalse(self.user.is_staff)
        self.assertEqual(self.user.username, 'buyer')
        self.assertEqual(self.other.first_name, '')

    def test_address_is_account_scoped_and_order_keeps_snapshot(self):
        self.assertEqual(self.client.post('/api/orders/place/', self.body, format='json').status_code, 201)
        data={'user':self.other.pk,'recipient_name':'Aina','line1':'New street','line2':'','city':'KL','state':'Kuala Lumpur','postal_code':'50000','phone':'0123456789','country':'Malaysia'}
        response=self.client.put('/api/address/',data,format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['user'],self.user.pk)
        self.assertEqual(Order.objects.get().delivery_address['line1'],'Test')
        self.client.force_authenticate(self.other)
        self.assertIsNone(self.client.get('/api/address/').data)

    def test_account_requires_login(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/account/').status_code, [401,403])
