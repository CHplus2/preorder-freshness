"""Real row-lock assertions; run only against the isolated PostgreSQL test DB."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection, connections, close_old_connections, transaction
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError
from .models import PackagingItem, PackagingMovement, Product, ProductPackaging, Order, OrderItem
from .services.packaging import allocate_packaging


@skipUnless(connection.vendor=='postgresql','Real PostgreSQL row locks required')
class PackagingLockTests(TransactionTestCase):
    def setUp(self):
        self.owner=User.objects.create_user('packaging-lock-owner',is_staff=True)
        self.buyer=User.objects.create_user('packaging-lock-buyer')
        self.box=PackagingItem.objects.create(name='Box',quantity=4)
        self.product=Product.objects.create(name='Meal',price=10)
        ProductPackaging.objects.create(product=self.product,packaging_item=self.box,quantity_per_item=1)

    def order(self):
        order=Order.objects.create(user=self.buyer)
        OrderItem.objects.create(order=order,product=self.product,product_name='Meal',unit_price=10,quantity=3,subtotal=30)
        return order

    def concurrent(self,ids):
        barrier=Barrier(2)
        def allocate(pk):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                with transaction.atomic():
                    with connections['default'].cursor() as cur:cur.execute("SET LOCAL lock_timeout = '8s'")
                    order=Order.objects.select_for_update().get(pk=pk)
                    allocate_packaging(order,self.owner)
                return 'accepted'
            except ValidationError:return 'shortage'
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(allocate,ids))

    def test_competing_orders_cannot_oversell_shared_packaging(self):
        a,b=self.order(),self.order()
        results=self.concurrent([a.pk,b.pk])
        self.assertCountEqual(results,['accepted','shortage'])
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,1)
        self.assertEqual(PackagingMovement.objects.filter(kind='allocate').count(),1)

    def test_same_order_concurrent_retry_deducts_once(self):
        a=self.order();self.assertEqual(self.concurrent([a.pk,a.pk]),['accepted','accepted'])
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,1)
        self.assertEqual(PackagingMovement.objects.filter(kind='allocate').count(),1)
