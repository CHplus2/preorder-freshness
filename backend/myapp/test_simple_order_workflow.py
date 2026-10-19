from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (Product, ProductIngredient, RawMaterial, InventoryItem,
    Order, OrderItem, InventoryLog, IngredientConsumption)


class SimpleOrderWorkflowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('workflow-owner', is_staff=True)
        self.buyer = User.objects.create_user('workflow-buyer')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.material = RawMaterial.objects.create(name='Workflow rice', unit='g')
        self.product = Product.objects.create(name='Workflow rice meal', price=10)
        ProductIngredient.objects.create(product=self.product, raw_material=self.material, quantity_required=100)
        self.lot = InventoryItem.objects.create(raw_material=self.material, quantity=500,
            received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=7), unit_cost='0.01')
        delivery = timezone.now()+timedelta(days=3)
        self.order = Order.objects.create(user=self.buyer, status='pending', payment_status='unpaid',
            delivery_at=delivery, preparation_at=delivery-timedelta(hours=3),
            preparation_end_at=delivery-timedelta(minutes=90), preparation_plan={'tasks':[
                {'name':'Prepare rice', 'resource':'prep_table', 'worker':True,
                 'start':(delivery-timedelta(hours=3)).isoformat(),
                 'end':(delivery-timedelta(minutes=90)).isoformat()}]})
        OrderItem.objects.create(order=self.order, product=self.product,
            product_name=self.product.name, quantity=1, unit_price=10, subtotal=10)
        self.url = f'/api/admin/orders/{self.order.pk}/'

    def status(self, value):
        return self.client.patch(self.url, {'status':value}, format='json')

    def test_new_pending_order_is_in_planner_without_processing_or_payment(self):
        response = self.client.get('/api/admin/planning/')
        row = next(o for o in response.data['orders'] if o['id']==self.order.pk)
        self.assertEqual(row['status'], 'pending')
        self.assertEqual(row['payment_status'], 'unpaid')
        self.assertTrue(row['preparation_plan']['tasks'])
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')
        self.assertFalse(self.order.inventory_deducted)

    def test_two_actual_updates_complete_an_order_without_intermediate_steps(self):
        self.assertEqual(self.status('cooked').status_code, 200)
        self.assertEqual(self.status('cooked').status_code, 200)
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.quantity, 400)
        self.assertEqual(IngredientConsumption.objects.count(), 1)
        self.assertEqual(InventoryLog.objects.count(), 1)
        self.assertEqual(self.status('delivered').status_code, 200)
        self.assertEqual(self.status('delivered').status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'delivered')
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertTrue(self.order.inventory_deducted)
        self.assertEqual(IngredientConsumption.objects.count(), 1)
        response = self.client.get('/api/admin/planning/')
        self.assertNotIn(self.order.pk, [o['id'] for o in response.data['orders']])
        self.assertEqual(response.data['analytics']['paid_orders'], 0)

    def test_optional_progress_steps_remain_available(self):
        self.assertEqual(self.status('processing').status_code, 200)
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.quantity, 500)
        self.assertEqual(self.status('cooked').status_code, 200)
        self.assertEqual(self.status('shipped').status_code, 200)
        self.assertEqual(self.status('delivered').status_code, 200)
        self.assertEqual(IngredientConsumption.objects.count(), 1)

    def test_delivery_cannot_skip_confirmation_of_preparation(self):
        self.assertEqual(self.status('delivered').status_code, 400)
        self.assertEqual(self.status('shipped').status_code, 400)
        self.assertEqual(self.status('processing').status_code, 200)
        self.assertEqual(self.status('delivered').status_code, 400)
        self.assertFalse(IngredientConsumption.objects.exists())

    def test_unconfirmed_or_invalid_plan_cannot_skip_review(self):
        for changes in [dict(preparation_plan={'needs_review':True}),
                dict(preparation_at=None), dict(preparation_end_at=None), dict(delivery_at=None),
                dict(preparation_end_at=self.order.delivery_at+timedelta(minutes=1)),
                dict(preparation_end_at=self.order.preparation_at)]:
            with self.subTest(changes=changes):
                before = {key:getattr(self.order,key) for key in changes}
                Order.objects.filter(pk=self.order.pk).update(**changes)
                self.assertEqual(self.status('cooked').status_code, 400)
                self.assertFalse(IngredientConsumption.objects.exists())
                Order.objects.filter(pk=self.order.pk).update(**before)

    def test_shortage_rolls_back_and_order_stays_not_started(self):
        self.lot.quantity = 50
        self.lot.save()
        response = self.status('cooked')
        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.lot.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')
        self.assertFalse(self.order.inventory_deducted)
        self.assertEqual(self.lot.quantity, 50)
        self.assertFalse(InventoryLog.objects.exists())
        self.assertFalse(IngredientConsumption.objects.exists())

    def test_progress_remains_staff_only_and_never_invents_payment(self):
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.status('cooked').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.status('cooked').status_code, 403)
        self.client.force_authenticate(self.owner)
        response = self.client.patch(self.url, {'status':'cooked','payment_status':'paid'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.lot.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertEqual(self.lot.quantity, 500)
