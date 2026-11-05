"""Client-approved poster data, repeat-safe SQL import and unchanged ledgers."""
import importlib.util
import json
from pathlib import Path
from unittest import skipUnless
from django.db import connection,transaction,DatabaseError
from django.test import SimpleTestCase,TransactionTestCase
from .models import (Storefront,Product,Category,RawMaterial,ProductIngredient,InventoryItem,
    PackagingItem,ProductPackaging,Order,OrderItem)
from .serializers import ProductSerializer,MenuImageReference

ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'deploy/data/wrap_bowl_kuch.json').read_text())


class WrapBowlDataTests(SimpleTestCase):
    def test_poster_prices_and_days_match_and_recipes_are_marked_estimated(self):
        self.assertEqual({p['name']:p['price'] for p in DATA['menus']},{
            'Chicken Grilled Salad':'13.00','Chicken Popcorn Salad':'13.00','Eggsquisite Salad':'12.00',
            'Beef Sukiya Salad':'18.00','Wanpaku Chicken Katsu':'12.00','Wanpaku Chicken Grilled':'12.00',
            'Salmon Grilled Salad Bowl':'28.00','Sukiya Beef Rice Bowl':'20.00'})
        self.assertIn('editable estimates',DATA['recipe_basis'])
        for product in DATA['menus']:
            self.assertEqual(product['delivery_weekdays'],[0] if product['name']=='Sukiya Beef Rice Bowl' else [0,1,2,3,4])
            self.assertTrue(product['ingredients']);self.assertTrue(product['packaging'])
            self.assertTrue(all(float(q)>0 for q in product['ingredients'].values()))
            self.assertLessEqual(set(product['ingredients']),{r['name'] for r in DATA['raw_materials']})
            self.assertLessEqual(set(product['packaging']),set(DATA['packaging_items']))
        self.assertTrue(DATA['storefront']['whatsapp_number'].startswith('60'))
        self.assertLessEqual(len(DATA['storefront']['founder_intro']),250)

    def test_committed_sql_matches_catalogue_and_template(self):
        spec=importlib.util.spec_from_file_location('wrap_builder',ROOT/'deploy/build_wrap_bowl_catalogue.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        self.assertEqual(module.build(),(ROOT/'deploy/sql/apply_wrap_bowl_catalogue.sql').read_text())

    def test_only_registered_static_illustrations_are_accepted(self):
        field=MenuImageReference()
        for menu in DATA['menus']:
            self.assertEqual(field.run_validation(menu['image_url']),menu['image_url'])
        from rest_framework.exceptions import ValidationError
        for value in ['/static/client-menu/other.svg','/static/client-menu/../salad-bowl.svg','javascript:alert(1)']:
            with self.assertRaises(ValidationError):field.run_validation(value)


@skipUnless(connection.vendor=='postgresql','Actual PostgreSQL catalogue import required')
class WrapBowlImportTests(TransactionTestCase):
    def setUp(self):
        from django.utils import timezone
        from datetime import timedelta
        self.store=Storefront.objects.create(pk=1,name='Original kitchen',bulk_minimum=10,bulk_discount_percent=10,
            delivery_area_fees={'Existing area':'7.00'},manual_payment_enabled=True,bank_transfer_instructions='Saved bank settings')
        self.raw=RawMaterial.objects.create(name='Rice',unit='g')
        self.stock=InventoryItem.objects.create(raw_material=self.raw,quantity=1000,received_date=timezone.localdate(),
            expiry_date=timezone.localdate()+timedelta(days=10),storage_location='Dry shelf')
        self.old=Product.objects.create(name='Earlier rice meal',price=11)
        ProductIngredient.objects.create(product=self.old,raw_material=self.raw,quantity_required=100)
        from django.contrib.auth.models import User
        user=User.objects.create_user('catalogue-local-buyer')
        self.order=Order.objects.create(user=user,total_amount=11,payment_method='paypal')
        self.line=OrderItem.objects.create(order=self.order,product=self.old,product_name=self.old.name,unit_price=11,quantity=1,subtotal=11)
        self.old_order=list(Order.objects.values());self.old_lines=list(OrderItem.objects.values())
        with connection.cursor() as q:
            q.execute('SELECT current_schema()');self.schema=connection.ops.quote_name(q.fetchone()[0])
        self.sql=(ROOT/'deploy/sql/apply_wrap_bowl_catalogue.sql').read_text().replace('django_app.',self.schema+'.')

    def run_sql(self):
        with connection.cursor() as q:
            q.execute(self.sql);value=q.fetchone()[0]
        return json.loads(value) if isinstance(value,str) else value

    def test_import_catalogue_branding_packaging_keeps_stock_history_and_payment_settings(self):
        result=self.run_sql();self.assertEqual(result['status'],'configured')
        self.assertEqual(Product.objects.filter(selling_status='active').count(),8)
        self.assertEqual(len(result['menus']),8)
        self.old.refresh_from_db();self.assertEqual(self.old.selling_status,'archived');self.assertEqual(self.old.name,'Earlier rice meal')
        self.assertEqual(list(Order.objects.values()),self.old_order);self.assertEqual(list(OrderItem.objects.values()),self.old_lines)
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)
        self.assertEqual(InventoryItem.objects.count(),1)
        self.assertTrue(all(p.quantity==0 and p.unit_cost is None for p in PackagingItem.objects.all()))
        for menu in DATA['menus']:
            p=Product.objects.get(name=menu['name'])
            self.assertEqual(str(p.price),menu['price']);self.assertEqual(p.ingredients.count(),len(menu['ingredients']))
            self.assertEqual(p.packaging_requirements.count(),len(menu['packaging']))
            data=ProductSerializer(p).data
            form=ProductSerializer(p,data=data,partial=True);self.assertTrue(form.is_valid(),form.errors)
        self.store.refresh_from_db();self.assertEqual(self.store.name,'Wrap & Bowl Kuch');self.assertEqual(self.store.founder_name,'Ayu Shafinaz')
        self.assertEqual(self.store.bank_transfer_instructions,'Saved bank settings');self.assertTrue(self.store.manual_payment_enabled)
        self.assertEqual(self.store.delivery_area_fees,{'Existing area':'7.00'})
        self.assertEqual(self.store.bulk_discount_percent,10)

    def test_repeat_preserves_owner_edits_and_consumed_stock(self):
        self.run_sql();menu=Product.objects.get(name='Chicken Grilled Salad');menu.price=15;menu.save()
        recipe=menu.ingredients.first();recipe.quantity_required=123;recipe.save()
        box=PackagingItem.objects.first();box.quantity=17;box.save()
        self.store.refresh_from_db();self.store.founding_story='Owner edited story';self.store.save()
        self.assertEqual(self.run_sql()['status'],'already_configured')
        menu.refresh_from_db();recipe.refresh_from_db();box.refresh_from_db();self.store.refresh_from_db()
        self.assertEqual(menu.price,15);self.assertEqual(recipe.quantity_required,123);self.assertEqual(box.quantity,17)
        self.assertEqual(self.store.founding_story,'Owner edited story');self.assertEqual(Product.objects.count(),9)

    def test_unit_conflict_rolls_back_all_changes(self):
        self.raw.unit='kg';self.raw.save()
        with self.assertRaises(DatabaseError):
            with transaction.atomic():self.run_sql()
        self.assertEqual(Product.objects.count(),1);self.assertEqual(RawMaterial.objects.count(),1)
        self.assertFalse(PackagingItem.objects.exists());self.old.refresh_from_db();self.assertEqual(self.old.selling_status,'active')
        self.store.refresh_from_db();self.assertEqual(self.store.name,'Original kitchen')

    def test_partial_catalogue_needs_review_without_overwriting(self):
        Product.objects.create(name=DATA['menus'][0]['name'],price=99)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():self.run_sql()
        self.assertEqual(Product.objects.count(),2);self.assertFalse(PackagingItem.objects.exists())

    def test_existing_packaging_quantities_and_unit_costs_are_not_replenished(self):
        box=PackagingItem.objects.create(name='Salad bowl with lid (1000 ml)',quantity=22,unit_cost='.65')
        self.run_sql();box.refresh_from_db();self.assertEqual(box.quantity,22);self.assertEqual(str(box.unit_cost),'0.650000')
