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
