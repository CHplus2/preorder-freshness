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
    def test_concurrent_plan_confirmations_save_one_reservation_and_amendment(self):
        from .models import OrderItem
        Storefront.objects.create(pk=1)
        owner = User.objects.create_user('plan-retry-owner', is_staff=True)
        buyer = User.objects.create_user('plan-retry-buyer')
        product = Product.objects.create(name='Plan retry meal', price=10, lead_hours=1,
            preparation_tasks=[dict(name='Prepare', minutes=30, worker=True, resource='prep_table')])
        delivery = (timezone.localtime()+timedelta(days=3)).replace(hour=18, minute=0, second=0, microsecond=0)
        order = Order.objects.create(user=buyer, delivery_at=delivery,
            preparation_plan={'needs_review': True, 'tasks': []})
        OrderItem.objects.create(order=order, product=product, product_name=product.name,
            quantity=1, unit_price=10, subtotal=10)
        url = f'/api/admin/orders/{order.pk}/preparation-plan/'
        client = APIClient(); client.force_authenticate(owner)
        preview = client.post(url, {}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        barrier = Barrier(2)
        def confirm(_):
            close_old_connections()
            try:
                current = APIClient(); current.force_authenticate(User.objects.get(pk=owner.pk))
                barrier.wait(timeout=10)
                response = current.post(url, {'confirm': preview.data['confirm']}, format='json')
                return response.status_code, response.data.get('already_applied')
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(confirm, range(2)))
        self.assertEqual(sorted(results), [(200, False), (200, True)])
        order.refresh_from_db()
        self.assertEqual(order.amendments.count(), 1)
        self.assertEqual(len(order.preparation_plan['tasks']), 1)
        self.assertFalse(order.preparation_plan.get('needs_review', False))
        self.assertEqual(order.status, 'pending')
        self.assertFalse(order.inventory_deducted)

    def test_two_buyers_cannot_reserve_the_last_portion_twice(self):
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
        # Checkout can accept a second *request* for owner review. It cannot
        # reserve another portion or take payment for that unconfirmed request.
        self.assertEqual(sorted(outcomes),[201,201])
        orders=list(Order.objects.order_by('pk'))
        confirmed=[o for o in orders if not o.preparation_plan.get('needs_review')]
        requests=[o for o in orders if o.preparation_plan.get('needs_review')]
        self.assertEqual(len(confirmed),1);self.assertEqual(len(requests),1)
        self.assertIsNotNone(confirmed[0].preparation_at)
        self.assertIsNone(requests[0].preparation_at)
        self.assertFalse(requests[0].preparation_plan.get('tasks'))
        self.assertEqual(requests[0].payment_status,'unpaid')

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


@skipUnless(connection.vendor == 'postgresql', 'Requires isolated PostgreSQL to verify real row locking')
class PostgreSQLWalletIntegrityTests(TransactionTestCase):
    def setUp(self):
        from .models import Wallet
        self.user=User.objects.create_user('concurrent-credit-buyer')
        self.wallet=Wallet.objects.create(user=self.user,balance=100,wallet_address='concurrent-demo-wallet')

    def concurrent(self, requests):
        barrier=Barrier(len(requests));user_id=self.user.pk
        def post(request):
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=user_id))
                barrier.wait(timeout=10)
                response=client.post(request[0],request[1],format='json')
                return response.status_code,response.data
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=len(requests)) as pool:return list(pool.map(post,requests))

    def test_same_topup_reference_credits_once_under_real_row_locks(self):
        import uuid
        from decimal import Decimal
        from .models import WalletTransaction
        request=('/api/wallet/topup/',{'amount':'25.00','request_id':str(uuid.uuid4())})
        results=self.concurrent([request,request])
        self.assertEqual([code for code,_ in results],[200,200],results)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('125'))
        self.assertEqual(WalletTransaction.objects.filter(type='deposit').count(),1)
        self.assertEqual(sorted(data['already_applied'] for _,data in results),[False,True])

    def test_different_topups_cannot_overwrite_each_other(self):
        import uuid
        from decimal import Decimal
        from .models import WalletTransaction
        results=self.concurrent([('/api/wallet/topup/',{'amount':amount,'request_id':str(uuid.uuid4())}) for amount in ['20.00','30.00']])
        self.assertEqual([code for code,_ in results],[200,200],results)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('150'))
        self.assertEqual(WalletTransaction.objects.filter(type='deposit').count(),2)

    def test_topup_and_checkout_preserve_both_credit_and_debit(self):
        import uuid
        from decimal import Decimal
        from .models import WalletTransaction
        Storefront.objects.create(pk=1)
        product=Product.objects.create(name='Concurrent wallet meal',price=10,lead_hours=1)
        address=Address.objects.create(user=self.user,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0100000000')
        CartItem.objects.create(user=self.user,product=product,quantity=1)
        day=(timezone.localtime()+timedelta(days=4)).replace(hour=18,minute=0,second=0,microsecond=0)
        results=self.concurrent([
            ('/api/wallet/topup/',{'amount':'25.00','request_id':str(uuid.uuid4())}),
            ('/api/orders/place/',{'address_id':address.pk,'payment':'wallet','delivery_at':day.isoformat(),'request_id':str(uuid.uuid4())})])
        self.assertEqual(sorted(code for code,_ in results),[200,201],results)
        self.wallet.refresh_from_db();self.assertEqual(self.wallet.balance,Decimal('110'))
        self.assertEqual(WalletTransaction.objects.filter(type='deposit').count(),1)
        self.assertEqual(WalletTransaction.objects.filter(type='payment').count(),1)
        self.assertEqual(Order.objects.get().payment_status,'paid')
