from datetime import timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from .models import Product, CartItem, Storefront
from .services.scheduling import schedule_order


class MenuLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user('owner', is_staff=True)
        self.buyer = User.objects.create_user('buyer')
        self.product = Product.objects.create(name='Rice meal', price=12)
        self.store = Storefront.objects.create(pk=1)

    def test_public_menu_excludes_paused_and_archived(self):
        for state in ['paused', 'archived']:
            self.product.selling_status = state
            self.product.save()
            self.assertEqual(self.client.get('/api/menu/').data['count'], 0)
        self.product.selling_status = 'active'
        self.product.save()
        self.assertEqual(self.client.get('/api/menu/').data['count'], 1)

    def test_only_owner_can_change_status_and_invalid_values_rejected(self):
        url = f'/api/admin/products/{self.product.pk}/'
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.patch(url, {'selling_status':'paused'}).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, {'selling_status':'invalid'}).status_code, 400)
        for state in ['paused', 'archived', 'paused', 'active']:
            response = self.client.patch(url, {'selling_status':state})
            self.assertEqual(response.status_code, 200, response.data)
            self.product.refresh_from_db()
            self.assertEqual(self.product.selling_status, state)

    def test_existing_basket_can_be_reduced_or_removed_but_not_increased(self):
        self.client.force_authenticate(self.buyer)
        item = CartItem.objects.create(user=self.buyer, product=self.product, quantity=3)
        for state in ['paused', 'archived']:
            self.product.selling_status = state
            self.product.save()
            self.assertEqual(self.client.post('/api/cart/', {'product_id':self.product.pk}).status_code, 400)
            self.assertEqual(self.client.patch(f'/api/cart/{item.pk}/', {'quantity':4}).status_code, 400)
            self.assertEqual(self.client.get('/api/cart/').data[0]['product']['selling_status'], state)
        self.assertEqual(self.client.patch(f'/api/cart/{item.pk}/', {'quantity':1}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/cart/{item.pk}/').status_code, 200)

    def test_planning_rejects_inactive_new_order(self):
        item = CartItem.objects.create(user=self.buyer, product=self.product, quantity=1)
        for state in ['paused', 'archived']:
            self.product.selling_status = state
            self.product.save()
            item.product = self.product
            with self.assertRaisesMessage(ValidationError, 'not accepting new orders'):
                schedule_order([item], timezone.now()+timedelta(days=3), self.store)

    def test_existing_order_plan_can_be_retained_after_archive(self):
        from .models import Order, OrderItem
        delivery = (timezone.localtime()+timedelta(days=3)).replace(hour=16, minute=0)
        order = Order.objects.create(user=self.buyer, status='processing', total_amount=12, delivery_at=delivery)
        item = OrderItem.objects.create(order=order, product=self.product, product_name=self.product.name, quantity=1, unit_price=12, subtotal=12)
        self.product.selling_status = 'archived'
        self.product.save()
        item.product = self.product
        plan = schedule_order([item], delivery, self.store, exclude_order_id=order.pk)
        self.assertIsNotNone(plan)
        item.refresh_from_db()
        self.assertEqual(item.product_name, 'Rice meal')
        self.assertEqual(item.quantity, 1)

    def test_unused_menu_can_be_deleted_with_its_basket_and_current_recipe(self):
        from .models import RawMaterial,ProductIngredient
        material=RawMaterial.objects.create(name='Fixture rice',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=material,quantity_required=100)
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        self.client.force_authenticate(self.owner)
        pk=self.product.pk
        self.assertTrue(self.client.get(f'/api/admin/products/{pk}/').data['can_delete'])
        self.assertEqual(self.client.delete(f'/api/admin/products/{pk}/').status_code,204)
        self.assertFalse(Product.objects.filter(pk=pk).exists());self.assertFalse(CartItem.objects.exists())
        self.assertFalse(ProductIngredient.objects.exists());self.assertTrue(RawMaterial.objects.filter(pk=material.pk).exists())

    def test_used_menus_keep_order_links_and_recipes_and_offer_archiving(self):
        from .models import Order,OrderItem
        self.client.force_authenticate(self.owner)
        for state in ['pending','processing','delivered','cancelled']:
            order=Order.objects.create(user=self.buyer,status=state)
            item=OrderItem.objects.create(order=order,product=self.product,product_name=self.product.name,unit_price=12,quantity=1,subtotal=12)
            url=f'/api/admin/products/{self.product.pk}/'
            self.assertFalse(self.client.get(url).data['can_delete'])
            result=self.client.delete(url);self.assertEqual(result.status_code,409,result.data)
            self.assertEqual(result.data['code'],'menu_used_in_orders')
            item.refresh_from_db();self.assertEqual(item.product_id,self.product.pk)
        self.assertEqual(self.client.patch(url,{'selling_status':'archived'},format='json').status_code,200)
        self.assertEqual(OrderItem.objects.count(),4)

    def test_deletion_capability_is_staff_only_and_delete_is_guarded_on_both_routes(self):
        for user in [None,self.buyer]:
            self.client.force_authenticate(user)
            self.assertNotIn('can_delete',self.client.get(f'/api/products/{self.product.pk}/').data)
            for prefix in ['products','admin/products']:
                self.assertEqual(self.client.delete(f'/api/{prefix}/{self.product.pk}/').status_code,403)
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())


from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import skipUnless
from django.db import connection, connections, close_old_connections, transaction
from django.test import TransactionTestCase


@skipUnless(connection.vendor=='postgresql','Requires isolated PostgreSQL deletion locks')
class MenuDeletionLockTests(TransactionTestCase):
    def setUp(self):
        self.owner=User.objects.create_user('delete-lock-owner',is_staff=True)
        self.buyer=User.objects.create_user('delete-lock-buyer')
        self.product=Product.objects.create(name='Busy fixture menu',price=12)
        self.cart=CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        self.client=APIClient();self.client.force_authenticate(self.owner)

    def check_busy(self, model, pk):
        locked,release=Event(),Event()
        def hold():
            close_old_connections()
            try:
                with transaction.atomic():
                    model.objects.select_for_update().get(pk=pk)
                    locked.set();release.wait(timeout=10)
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=1) as pool:
            holder=pool.submit(hold)
            try:
                self.assertTrue(locked.wait(timeout=5))
                response=self.client.delete(f'/api/admin/products/{self.product.pk}/')
                self.assertEqual(response.status_code,409,response.data)
                self.assertEqual(response.data['code'],'menu_busy')
                self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
                self.assertTrue(CartItem.objects.filter(pk=self.cart.pk).exists())
            finally:release.set();holder.result(timeout=5)
        self.assertEqual(self.client.delete(f'/api/admin/products/{self.product.pk}/').status_code,204)

    def test_checkout_menu_lock_returns_recoverable_conflict(self):
        self.check_busy(Product,self.product.pk)

    def test_basket_quantity_lock_returns_recoverable_conflict(self):
        self.check_busy(CartItem,self.cart.pk)
