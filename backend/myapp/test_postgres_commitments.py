"""Run only against an isolated PostgreSQL test database, never production."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest import skipUnless
from django.db import connection, connections, close_old_connections
from django.test import TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront, Product, Address, CartItem, Order


@skipUnless(connection.vendor == 'postgresql', 'Requires isolated PostgreSQL to verify real row locking')
class PostgreSQLCommitmentTests(TransactionTestCase):
    def test_two_buyers_cannot_take_the_last_portion(self):
        Storefront.objects.create(pk=1)
        product=Product.objects.create(name='Last portion',price=10,daily_capacity=1,lead_hours=1)
        buyers=[]
        for name in ('first','second'):
            user=User.objects.create_user(name)
            address=Address.objects.create(user=user,line1='Test',city='KL',state='KL',postal_code='50000',phone='0100000000')
            CartItem.objects.create(user=user,product=product,quantity=1)
            buyers.append((user.pk,address.pk))
        delivery=(timezone.localtime()+timedelta(days=3)).replace(hour=16,minute=0,second=0,microsecond=0)
        barrier=Barrier(2)
        def place(buyer):
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=buyer[0]))
                barrier.wait(timeout=10)
                return client.post('/api/orders/place/',{'address_id':buyer[1],'payment':'cod','delivery_at':delivery.isoformat()},format='json').status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(place,buyers))
        self.assertEqual(sorted(outcomes),[201,400])
        self.assertEqual(Order.objects.count(),1)

    def test_same_checkout_reference_concurrently_creates_one_order_and_debit(self):
        import uuid
        from decimal import Decimal
        from .models import Wallet, WalletTransaction, PaymentEvent
        Storefront.objects.create(pk=1)
        product=Product.objects.create(name='Retry meal',price=10,lead_hours=1)
        user=User.objects.create_user('retry-buyer')
        address=Address.objects.create(user=user,line1='Test',city='KL',state='KL',postal_code='50000',phone='0100000000')
        CartItem.objects.create(user=user,product=product,quantity=1)
        wallet=Wallet.objects.create(user=user,balance=100,wallet_address='isolated-concurrent-wallet')
        delivery=(timezone.localtime()+timedelta(days=3)).replace(hour=16,minute=0,second=0,microsecond=0)
        body={'address_id':address.pk,'payment':'wallet','delivery_at':delivery.isoformat(),'request_id':str(uuid.uuid4())}
        barrier=Barrier(2)
        def place(_):
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=user.pk))
                barrier.wait(timeout=10)
                response=client.post('/api/orders/place/',body,format='json')
                return response.status_code,response.data.get('order_id')
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(place,range(2)))
        self.assertEqual(sorted(code for code,_ in results),[200,201])
        self.assertEqual(len({pk for _,pk in results}),1)
        self.assertEqual(Order.objects.count(),1)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance,Decimal('85'))
        self.assertEqual(WalletTransaction.objects.filter(type='payment').count(),1)
        self.assertEqual(PaymentEvent.objects.count(),1)
        self.assertFalse(CartItem.objects.filter(user=user).exists())
