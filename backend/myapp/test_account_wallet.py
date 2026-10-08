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

    def test_infeasible_recipe_becomes_unpaid_review_request_and_retry_is_safe(self):
        Product.objects.update(batch_size=1, preparation_minutes=60)
        quote = self.client.post('/api/orders/quote/', self.body, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertTrue(quote.data['needs_review'])
        self.assertIsNone(quote.data['preparation_at'])
        response = self.client.post('/api/orders/place/', self.body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data['needs_review'])
        retry = self.client.post('/api/orders/place/', self.body, format='json')
        self.assertEqual(retry.status_code, 200)
        self.assertTrue(retry.data['needs_review'])
        order = Order.objects.get()
        self.assertEqual(order.status, 'pending')
        self.assertEqual(order.payment_status, 'unpaid')
        self.assertEqual(order.payment_method, 'cod')
        self.assertIsNone(order.preparation_at)
        self.assertIsNone(order.preparation_end_at)
        self.assertEqual(order.preparation_plan['tasks'], [])
        self.assertIn('cannot fit', order.preparation_plan['review_reason'])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal('8836.48'))
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(CartItem.objects.filter(user=self.user).exists())
        owner = User.objects.create_user('owner', is_staff=True)
        self.client.force_authenticate(owner)
        changed = self.client.patch(f'/api/admin/orders/{order.pk}/', {'status':'processing'}, format='json')
        self.assertEqual(changed.status_code, 400, changed.data)
        order.refresh_from_db()
        self.assertTrue(order.preparation_plan['needs_review'])
        self.assertIsNone(order.preparation_at)
        self.assertEqual(order.payment_status, 'unpaid')

    def test_review_request_does_not_bypass_capacity_or_selling_status(self):
        Product.objects.update(daily_capacity=1)
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,400)
        self.assertFalse(Order.objects.exists())
        Product.objects.update(daily_capacity=100, selling_status='paused')
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_cod_review_request_for_unsplittable_step(self):
        Product.objects.update(preparation_minutes=1440)
        self.body['payment']='cod'
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,201,response.data)
        self.assertTrue(response.data['needs_review'])
        self.assertIsNone(Order.objects.get().preparation_at)

    def test_review_request_delivery_change_preserves_pending_review(self):
        Product.objects.update(preparation_minutes=1440)
        self.body['payment']='cod'
        placed=self.client.post('/api/orders/place/',self.body,format='json')
        order=Order.objects.get(pk=placed.data['order_id'])
        url=f'/api/orders/{order.pk}/reschedule/'
        self.assertTrue(self.client.get(url).data['eligible'])
        target=(timezone.localtime()+timedelta(days=6)).replace(hour=17,minute=0,second=0,microsecond=0)
        preview=self.client.post(url,{'delivery_at':target.isoformat(),'reason':'Customer requested another day'},format='json')
        self.assertEqual(preview.status_code,200,preview.data)
        self.assertTrue(preview.data['preview']['needs_review'])
        confirmed=self.client.post(url,{'confirm':preview.data['confirm']},format='json')
        self.assertEqual(confirmed.status_code,200,confirmed.data)
        order.refresh_from_db()
        self.assertEqual(order.delivery_at,target)
        self.assertTrue(order.preparation_plan['needs_review'])
        self.assertIsNone(order.preparation_at)
        self.assertEqual(self.client.post(url,{'confirm':preview.data['confirm']},format='json').status_code,200)

    def test_unexpected_planner_failure_does_not_create_review_request(self):
        from unittest.mock import patch
        from django.db import OperationalError
        with patch('myapp.services.scheduling.automatic_plan', side_effect=OperationalError('test outage')):
            with self.assertLogs('myapp.exceptions', level='ERROR'):
                response=self.client.post('/api/orders/place/',self.body,format='json')
            self.assertEqual(response.status_code,503)
            self.assertNotIn('needs_review',response.data)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(PaymentEvent.objects.exists())
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance,Decimal('8836.48'))

    def test_nine_pm_is_accepted_but_later_is_not(self):
        delivery=(timezone.localtime()+timedelta(days=4)).replace(hour=21,minute=0,second=0,microsecond=0)
        self.body['delivery_at']=delivery.isoformat()
        self.assertEqual(self.client.post('/api/orders/quote/',self.body,format='json').status_code,200)
        self.body['delivery_at']=(delivery+timedelta(minutes=1)).isoformat()
        self.assertEqual(self.client.post('/api/orders/quote/',self.body,format='json').status_code,400)

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
