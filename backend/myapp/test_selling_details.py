from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Address, CartItem, InventoryItem, Order, OrderItem, Product, ProductIngredient, RawMaterial, Storefront
from .serializers import ProductSerializer, OrderItemSerializer
from .services.commitments import preparation_snapshot


BOX = dict(unit='box', size_label='Nine pieces', serves_min=3, serves_max=4,
           contents='3 original; 2 salted egg; 2 dark chocolate; 2 matcha.', no_substitutions=True)


class SellingDetailsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('offer-owner', is_staff=True)
        self.buyer = User.objects.create_user('offer-buyer')
        self.client = APIClient()
        self.menu = Product.objects.create(name='Fictional gift box', price=18, selling_details=BOX.copy(),
            lead_hours=1, preparation_minutes=20, packing_minutes_per_portion=0,
            batch_size=10, max_early_minutes=120)
        self.material = RawMaterial.objects.create(name='Flour for a whole box', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=self.material, quantity_required=120)
        Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1)

    def test_valid_offer_is_visible_on_public_cards_detail_and_discovery(self):
        self.assertEqual(ProductSerializer(self.menu).data['selling_details'], BOX)
        from .views.products import MenuCardSerializer
        self.assertEqual(MenuCardSerializer(self.menu).data['selling_details'], BOX)
        response = self.client.post('/api/menu/suggestions/', {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['results'][0]['selling_details'], BOX)

    def test_staff_can_replace_or_clear_details_buyer_cannot_write(self):
        self.client.force_authenticate(self.buyer)
        url = f'/api/admin/products/{self.menu.pk}/'
        self.assertEqual(self.client.patch(url, {'selling_details': {}}, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        response = self.client.patch(url, {'selling_details': {'unit': 'jar'}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.menu.refresh_from_db()
        self.assertEqual(self.menu.selling_details['unit'], 'jar')
        self.assertEqual(self.menu.selling_details['contents'], '')
        self.assertIsNone(self.menu.selling_details['serves_max'])
        self.assertFalse(self.menu.selling_details['no_substitutions'])
        response = self.client.patch(url, {'selling_details': {}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.menu.refresh_from_db(); self.assertEqual(self.menu.selling_details, {})

    def test_invalid_documents_servings_and_unexplained_fixed_contents_are_rejected(self):
        invalid = [None, [], 'box', {'unit': 'pallet'}, {'serves_min': 1},
            {'serves_min': 7, 'serves_max': 4}, {'serves_min': 0, 'serves_max': 1},
            {'serves_min': 1, 'serves_max': 1001}, {'contents': 'x'*501},
            {'size_label': 'x'*61}, {'no_substitutions': True}, {'unit': 'box', 'unknown': 3}]
        for value in invalid:
            with self.subTest(value=value):
                serializer = ProductSerializer(self.menu, data={'selling_details': value}, partial=True)
                self.assertFalse(serializer.is_valid(), serializer.validated_data)

    def test_two_boxes_charge_and_schedule_two_units_not_eighteen_pieces(self):
        self.client.force_authenticate(self.buyer)
        address = Address.objects.create(user=self.buyer, line1='Fictional address', city='Kuching',
            state='Sarawak', postal_code='93000', phone='0100000000')
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=2)
        now = timezone.make_aware(datetime(2030, 1, 7, 10))
        with patch('django.utils.timezone.now', return_value=now):
            response = self.client.post('/api/orders/place/', {'delivery_at': (now+timedelta(days=2)).replace(hour=15).isoformat(),
                'address_id': address.pk, 'payment': 'manual'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(); item = order.items.get()
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.subtotal, Decimal('36'))
        self.assertEqual(order.total_amount, Decimal('36'))
        self.assertEqual(item.accepted_ingredients.get().quantity_per_portion*item.quantity, Decimal('240'))
        self.assertEqual(item.preparation_snapshot['selling_details'], BOX)
        self.assertEqual(OrderItemSerializer(item).data['selling_details'], BOX)
        batch = InventoryItem.objects.create(raw_material=self.material, quantity=1000,
            received_date=now.date(), expiry_date=(now+timedelta(days=10)).date())
        self.client.force_authenticate(self.owner)
        with patch('django.utils.timezone.now', return_value=now+timedelta(days=2)):
            ready = self.client.patch(f'/api/admin/orders/{order.pk}/', {'status': 'cooked'}, format='json')
        self.assertEqual(ready.status_code, 200, ready.data)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, Decimal('760'))

    def test_accepted_details_survive_menu_edits_deletion_and_recipe_adoption(self):
        order = Order.objects.create(user=self.buyer)
        item = OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=2, subtotal=36)
        self.menu.selling_details = {'unit': 'tray', 'contents': 'Different offer'}; self.menu.save()
        self.assertEqual(OrderItemSerializer(item).data['selling_details'], BOX)
        adopted = preparation_snapshot(self.menu, accepted=item.preparation_snapshot)
        self.assertEqual(adopted['selling_details'], BOX)
        self.menu.delete(); item.refresh_from_db()
        self.assertEqual(OrderItemSerializer(item).data['selling_details'], BOX)

    def test_legacy_unspecified_orders_are_not_backfilled_from_current_menu(self):
        order = Order.objects.create(user=self.buyer)
        item = OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=1, subtotal=18)
        OrderItem.objects.filter(pk=item.pk).update(preparation_snapshot={'lead_hours': 24})
        item.refresh_from_db()
        self.assertEqual(OrderItemSerializer(item).data['selling_details'], {})
        self.assertEqual(preparation_snapshot(self.menu, accepted=item.preparation_snapshot)['selling_details'], {})

    def test_snapshot_does_not_share_mutable_menu_document(self):
        snapshot = preparation_snapshot(self.menu)
        self.menu.selling_details['contents'] = 'changed in memory'
        self.assertEqual(snapshot['selling_details'], BOX)

    def test_changed_offer_invalidates_a_signed_assistant_addition(self):
        self.client.force_authenticate(self.buyer)
        preview = self.client.post('/api/help/cart/', {'product_id': self.menu.pk, 'quantity': 2}, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.menu.selling_details = {'unit': 'tray', 'contents': 'Changed contents'}
        self.menu.save()
        result = self.client.post('/api/help/cart/', {'confirm': preview.data['confirm']}, format='json')
        self.assertEqual(result.status_code, 409, result.data)
        self.assertFalse(CartItem.objects.filter(user=self.buyer).exists())

    def test_previous_app_can_still_create_a_menu_after_the_column_is_added(self):
        from django.db.migrations.loader import MigrationLoader
        old_product = MigrationLoader(None).project_state(
            [('myapp', '0020_fulfilment_options')]).apps.get_model('myapp', 'Product')
        previous = old_product.objects.create(name='Created by previous app', price=9)
        self.assertEqual(Product.objects.get(pk=previous.pk).selling_details, {})
