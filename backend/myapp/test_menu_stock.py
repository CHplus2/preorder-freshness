"""Derived menu units share checkout eligibility and include assigned packaging."""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from .models import Product, RawMaterial, ProductIngredient, InventoryItem, PackagingItem, ProductPackaging
from .serializers import ProductSerializer
from .services.menu_stock import MenuStockSnapshot


class MenuStockTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.raw = RawMaterial.objects.create(name='Chicken', unit='g')
        self.product = Product.objects.create(name='Salad', price=13, daily_capacity=1)
        ProductIngredient.objects.create(product=self.product, raw_material=self.raw, quantity_required=100)
        self.batch = self.batch_for(800)

    def batch_for(self, quantity, **kwargs):
        values = dict(raw_material=self.raw, quantity=quantity, received_date=self.today,
                      expiry_date=self.today+timedelta(days=7), storage_location='Fridge')
        values.update(kwargs)
        return InventoryItem.objects.create(**values)

    def packaging(self):
        bowl = PackagingItem.objects.create(name='Bowl', quantity=6)
        labels = PackagingItem.objects.create(name='Label', quantity=9)
        ProductPackaging.objects.create(product=self.product, packaging_item=bowl, quantity_per_item=1)
        ProductPackaging.objects.create(product=self.product, packaging_item=labels, quantity_per_item=2)
        return bowl, labels

    def test_ingredient_yield_is_read_only_and_not_the_manual_daily_limit(self):
        self.assertEqual(self.product.get_available_quantity(), 8)
        form = ProductSerializer(self.product)
        self.assertTrue(form.fields['stock'].read_only)
        self.assertEqual(form.data['stock'], 8)

    def test_smallest_ingredient_and_packaging_yield_wins_with_whole_units(self):
        self.packaging()
        self.assertEqual(self.product.get_available_quantity(), 4)
        self.assertEqual(ProductSerializer(self.product).data['stock'], 4)
        self.batch.quantity = 250
        self.batch.save()
        self.assertEqual(ProductSerializer(self.product).data['stock'], 2)

    def test_empty_or_inactive_assigned_packaging_prevents_available_units(self):
        bowl, labels = self.packaging()
        bowl.quantity = 0
        bowl.save()
        self.assertEqual(self.product.get_available_quantity(), 0)
        bowl.quantity = 6
        bowl.save()
        labels.is_active = False
        labels.save()
        self.assertEqual(ProductSerializer(self.product).data['stock'], 0)

    def test_expired_held_and_future_received_lots_do_not_inflate_estimate(self):
        self.batch_for(10000, expiry_date=self.today-timedelta(days=1))
        self.batch_for(10000, quarantined=True)
        self.batch_for(10000, received_date=self.today+timedelta(days=1))
        self.assertEqual(self.product.get_available_quantity(), 8)

    def test_later_delivery_can_have_less_stock_than_todays_estimate(self):
        self.batch.expiry_date = self.today+timedelta(days=1)
        self.batch.save()
        self.assertEqual(self.product.get_available_quantity(), 8)
        self.assertEqual(MenuStockSnapshot(self.today+timedelta(days=2)).available(self.product), 0)

    def test_missing_or_invalid_recipe_never_claims_available_units(self):
        missing = Product.objects.create(name='No recipe', price=10)
        self.assertEqual(missing.get_available_quantity(), 0)
        ProductIngredient.objects.filter(product=self.product).update(quantity_required=0)
        self.assertEqual(ProductSerializer(self.product).data['stock'], 0)

    def test_shared_stock_is_estimated_per_menu_with_bounded_list_queries(self):
        bowl, labels = self.packaging()
        for index in range(18):
            other = Product.objects.create(name=f'Another salad {index}', price=13)
            ProductIngredient.objects.create(product=other, raw_material=self.raw, quantity_required=100)
            ProductPackaging.objects.create(product=other, packaging_item=labels, quantity_per_item=2)
        with self.assertNumQueries(4):
            data = ProductSerializer(Product.objects.prefetch_related('ingredients').order_by('id'), many=True).data
        self.assertEqual(len(data), 19)
        self.assertTrue(all(row['stock'] == 4 for row in data))
        self.assertEqual(InventoryItem.objects.get(pk=self.batch.pk).quantity, 800)
        self.assertEqual(PackagingItem.objects.get(pk=labels.pk).quantity, 9)
