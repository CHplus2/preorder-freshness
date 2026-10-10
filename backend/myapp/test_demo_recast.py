from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
from io import StringIO
import json
from pathlib import Path
import uuid

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import (Category, Product, RawMaterial, ProductIngredient, InventoryItem,
    Order, OrderItem, PaymentEvent, IngredientConsumption, OrderAmendment)
from .services.demo_catalogue import apply_recast, history_fingerprint, plan_recast

ROOT = Path(__file__).resolve().parents[2]
SOURCE = json.loads((ROOT / 'docs/DAPUR-KITA-STARTER-DATA.json').read_text())
MAPPING = json.loads((ROOT / 'docs/DAPUR-KITA-DEMO-ORDER-MAPPING.json').read_text())


class DemoRecastTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('recast-owner', is_staff=True)
        self.category = Category.objects.create(name='Fruits')
        self.product = Product.objects.create(name='Mango', price='5', category=self.category)
        self.material = RawMaterial.objects.create(name='Rice', unit='g', estimated_unit_cost='0.001')
        ProductIngredient.objects.create(product=self.product, raw_material=self.material, quantity_required=20)
        self.stock = InventoryItem.objects.create(raw_material=self.material, quantity=30,
            received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=2))
        self.order = Order.objects.create(user=self.user, total_amount=Decimal('9'),
            discount_amount=1, shipping_fee=4, payment_status='paid', status='delivered',
            inventory_deducted=True, payment_method='manual', delivery_at=timezone.now()+timedelta(days=2))
        self.item = OrderItem.objects.create(order=self.order, product=self.product, product_name='Mango',
            unit_price=5, subtotal=10, quantity=2)
        self.event = PaymentEvent.objects.create(order=self.order, request_id=uuid.uuid4(),
            kind='receipt', outcome='completed', amount=13, method='manual', reference='fictional-test')

    def fingerprint(self):
        return plan_recast(SOURCE, MAPPING)[0]['fingerprint']

    def test_full_atomic_recast_catalogue_orders_payments_and_durable_backups(self):
        created, delivery = self.order.created_at, self.order.delivery_at
        fingerprint = self.fingerprint()
        before_stock = InventoryItem.objects.values().get()
        summary = apply_recast(SOURCE, MAPPING, fingerprint)
        self.assertEqual(summary['orders'], 1)
        self.assertEqual(summary['items'], 1)
        self.assertEqual(summary['new_food_total'], '14.00')
        self.assertEqual(Product.objects.filter(selling_status='active').count(), 24)
        self.assertEqual(RawMaterial.objects.count(), 35)
        self.assertEqual(set(Category.objects.values_list('name', flat=True)), {'Rice meals', 'Noodles', 'Bakes'})
        self.assertEqual(ProductIngredient.objects.filter(product__selling_status='active').count(), 280)
        self.assertEqual(InventoryItem.objects.values().get(), before_stock)
        self.order.refresh_from_db(); self.item.refresh_from_db(); self.event.refresh_from_db()
        self.assertEqual(self.item.product_name, 'Nasi Lemak Telur')
        self.assertEqual(self.item.unit_price, Decimal('7.50'))
        self.assertEqual(self.item.subtotal, Decimal('15'))
        self.assertEqual(self.item.quantity, 2)
        self.assertEqual(self.item.recipe_source, 'demo_recast')
        self.assertEqual(self.item.accepted_ingredients.count(), 14)
        self.assertEqual(self.item.preparation_snapshot['batch_size'], 5)
        self.assertEqual(self.order.total_amount, Decimal('14'))
        self.assertEqual((self.order.created_at, self.order.delivery_at), (created, delivery))
        self.assertEqual(self.order.status, 'delivered')
        self.assertFalse(self.order.inventory_deducted)
        self.assertTrue(self.order.preparation_plan['needs_review'])
        self.assertEqual(self.event.amount, Decimal('18'))
        self.assertEqual(self.event.source, 'demo_recast')
        self.assertEqual(self.event.request_id, PaymentEvent.objects.get().request_id)
        backup = OrderAmendment.objects.get()
        self.assertEqual(backup.before['order']['total_amount'], '9.00')
        self.assertEqual(backup.before['items'][0]['product_name'], 'Mango')
        self.assertEqual(backup.before['payments'][0]['amount'], '13.00')
        self.assertEqual(backup.before['catalogue_before']['categories'][0]['name'], 'Fruits')
        counts = (Product.objects.count(), OrderAmendment.objects.count(), self.event.note)
        self.assertTrue(apply_recast(SOURCE, MAPPING, fingerprint)['already_applied'])
        self.event.refresh_from_db()
        self.assertEqual((Product.objects.count(), OrderAmendment.objects.count(), self.event.note), counts)

    def test_api_and_database_fingerprints_match(self):
        client = APIClient(); client.force_authenticate(self.user)
        rows = client.get('/api/admin/orders/').data
        self.assertEqual(history_fingerprint(rows), self.fingerprint())

    def test_stale_snapshot_and_wrong_unit_stop_all_changes(self):
        fingerprint = self.fingerprint()
        self.item.quantity = 3; self.item.save()
        with self.assertRaisesMessage(ValidationError, 'changed since'):
            apply_recast(SOURCE, MAPPING, fingerprint)
        self.assertEqual(Product.objects.count(), 1)
        self.assertFalse(OrderAmendment.objects.exists())
        self.material.unit = 'kg'; self.material.save()
        with self.assertRaisesMessage(ValidationError, 'material unit differs'):
            plan_recast(SOURCE, MAPPING)

    def test_wallet_consumption_and_inconsistent_payments_are_blocked(self):
        self.order.payment_method = 'wallet'; self.order.save()
        with self.assertRaisesMessage(ValidationError, 'Wallet orders'):
            plan_recast(SOURCE, MAPPING)
        self.order.payment_method = 'manual'; self.order.save()
        self.event.amount = 7; self.event.save()
        with self.assertRaisesMessage(ValidationError, 'payment event'):
            plan_recast(SOURCE, MAPPING)
        self.event.amount = 13; self.event.save()
        IngredientConsumption.objects.create(order_item=self.item, inventory_item=self.stock,
            material_name='Rice', unit='g', quantity=1, recorded_expiry=self.stock.expiry_date)
        with self.assertRaisesMessage(ValidationError, 'Structured ingredient consumption'):
            plan_recast(SOURCE, MAPPING)
        self.assertEqual(Product.objects.count(), 1)

    def test_late_serializer_failure_rolls_back_materials_products_and_history(self):
        fingerprint = self.fingerprint()
        source = deepcopy(SOURCE)
        # Passes basic URL scheme checking, but is rejected by Django's URL field.
        source['menus'][-1]['image_url'] = 'https://'
        with self.assertRaises(ValidationError):
            apply_recast(source, MAPPING, fingerprint)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(RawMaterial.objects.count(), 1)
        self.assertTrue(Category.objects.filter(name='Fruits').exists())
        self.assertFalse(OrderAmendment.objects.exists())
        self.item.refresh_from_db();self.material.refresh_from_db()
        self.assertEqual(self.item.product_name, 'Mango')
        self.assertEqual(self.material.estimated_unit_cost, Decimal('0.001'))

    def test_management_command_defaults_to_plan_and_requires_explicit_apply_guards(self):
        output = StringIO()
        call_command('recast_dapur_kita_demo', stdout=output)
        self.assertEqual(json.loads(output.getvalue())['new_food_total'], '14.00')
        self.assertEqual(Product.objects.count(), 1)
        with self.assertRaisesMessage(CommandError, '--confirm-fictional'):
            call_command('recast_dapur_kita_demo', apply=True)

    def test_unmapped_history_or_excessive_discount_is_rejected(self):
        self.item.product_name = 'Unknown legacy dish';self.item.save()
        with self.assertRaisesMessage(ValidationError, 'No mapping'):
            plan_recast(SOURCE, MAPPING)
        self.item.product_name = 'Mango';self.item.save()
        self.order.discount_amount = 100; self.order.save()
        with self.assertRaisesMessage(ValidationError, 'discount exceeds'):
            plan_recast(SOURCE, MAPPING)
