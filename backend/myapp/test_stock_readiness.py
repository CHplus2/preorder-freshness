"""Staff-only date/recipe stock targets, with no receipt or allocation side effect."""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Storefront,Product,Category,RawMaterial,ProductIngredient,InventoryItem,PackagingItem,
    ProductPackaging,InventoryLog,PackagingMovement,Order,IngredientConsumption,CustomerAccount,CartItem)

URL='/api/admin/stock-readiness/'
class StockReadinessTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('stock-target-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.day=timezone.localdate()+timedelta(days=2)
        self.store=Storefront.objects.create(pk=1,delivery_areas=['Local area'],delivery_area_fees={'Local area':'10.00'},free_delivery_minimum_myr=None)
        self.raw=RawMaterial.objects.create(name='Rice',unit='g')
        self.box=PackagingItem.objects.create(name='Lidded bowl',quantity=4)
        self.menus=[Product.objects.create(name=name,price=12,delivery_weekdays=[self.day.weekday()]) for name in ['Bowl A','Bowl B']]
        for menu in self.menus:
            ProductIngredient.objects.create(product=menu,raw_material=self.raw,quantity_required=100)
            ProductPackaging.objects.create(product=menu,packaging_item=self.box,quantity_per_item=1)
        self.batch=self.lot(400)
        self.lot(900,quarantined=True)
        self.lot(900,expiry_date=self.day-timedelta(days=1))
        self.lot(900,received_date=timezone.localdate()+timedelta(days=1))
    def lot(self,qty,**change):
        return InventoryItem.objects.create(raw_material=self.raw,quantity=qty,received_date=change.pop('received_date',timezone.localdate()),expiry_date=change.pop('expiry_date',self.day),storage_location='Dry shelf',**change)
    def check(self,**kwargs):return self.client.get(URL,{'date':self.day.isoformat(),'quantity':'3',**kwargs})
    def test_requires_staff_and_validates_strict_bounded_inputs(self):
        self.client.force_authenticate(None);self.assertIn(self.check().status_code,(401,403))
        self.client.force_authenticate(User.objects.create_user('stock-target-buyer'));self.assertEqual(self.check().status_code,403)
        self.client.force_authenticate(self.owner)
        for change in [{'quantity':'0'},{'quantity':'101'},{'quantity':'1.5'},{'quantity':'１２'},{'date':'2026-02-30'},{'date':(timezone.localdate()-timedelta(days=1)).isoformat()},{'date':(timezone.localdate()+timedelta(days=91)).isoformat()},{'surprise':'1'}]:
            with self.subTest(change=change):self.assertEqual(self.check(**change).status_code,400)
        self.assertEqual(self.client.get(URL+'?quantity=1&quantity=2').status_code,400)
    def test_combines_shared_recipes_and_packaging_and_uses_checkout_stock_filter(self):
        before=list(InventoryItem.objects.values());response=self.check();self.assertEqual(response.status_code,200,response.data)
        self.assertIn('no-store',response.get('Cache-Control',''));data=response.data;self.assertEqual(data['state'],'shortages');self.assertEqual(len(data['menus']),2)
        self.assertEqual(data['ingredients'],[dict(id=self.raw.pk,name='Rice',unit='g',required='600.000',available='400.000',shortfall='200.000',menu_count=2)])
        self.assertEqual(data['packaging'],[dict(id=self.box.pk,name='Lidded bowl',required=6,available=4,shortfall=2,is_active=True,menu_count=2)])
        self.assertEqual(before,list(InventoryItem.objects.values()));self.box.refresh_from_db();self.assertEqual(self.box.quantity,4)
        self.assertFalse(InventoryLog.objects.exists());self.assertFalse(PackagingMovement.objects.exists());self.assertFalse(Order.objects.exists())
    def test_nonoffered_archived_and_shipping_menus_not_in_target(self):
        excluded=Product.objects.create(name='Monday bowl',price=12,delivery_weekdays=[(self.day.weekday()+1)%7])
        Product.objects.create(name='Archived bowl',price=12,selling_status='archived')
        self.menus[0].delivery_dates=[(self.day+timedelta(days=1)).isoformat()];self.menus[0].save()
        data=self.check().data;self.assertEqual([r['name'] for r in data['menus']],['Bowl B'])
        self.assertEqual({r['name'] for r in data['excluded_menus']},{'Bowl A',excluded.name})
        self.assertEqual(data['ingredients'][0]['required'],'300.000')
    def test_covered_no_menus_missing_recipe_and_inactive_packaging_are_distinct(self):
        self.assertEqual(self.check(quantity='1').data['state'],'covered')
        self.box.is_active=False;self.box.save();self.assertEqual(self.check(quantity='1').data['state'],'review')
        self.box.is_active=True;self.box.save();self.menus[0].ingredients.all().delete()
        data=self.check(quantity='1').data;self.assertEqual(data['state'],'review');self.assertEqual(data['issues'][0]['name'],'Bowl A')
        for menu in self.menus:menu.selling_status='paused';menu.save()
        self.assertEqual(self.check().data['state'],'no_menus')
    def test_material_usage_keeps_old_records_accessible_without_calling_them_current(self):
        old=RawMaterial.objects.create(name='Earlier flour',unit='g');menu=Product.objects.create(name='Earlier cake',price=12,selling_status='archived')
        ProductIngredient.objects.create(product=menu,raw_material=old,quantity_required=100)
        rows={r['id']:r for r in self.client.get('/api/admin/raw-materials/').data}
        self.assertEqual(rows[self.raw.pk]['active_menu_count'],2);self.assertEqual(rows[old.pk]['active_menu_count'],0)

class ClientRecipeAllocationTests(TestCase):
    def test_all_eight_client_recipes_and_packaging_deduct_once_using_current_materials(self):
        import json,uuid
        from pathlib import Path
        from collections import defaultdict
        data=json.loads((Path(__file__).resolve().parents[2]/'deploy/data/wrap_bowl_kuch.json').read_text())
        store=Storefront.objects.create(pk=1,delivery_areas=['Local area'],delivery_area_fees={'Local area':'10.00'},free_delivery_minimum_myr=None)
        user=User.objects.create_user('client-allocation-buyer');CustomerAccount.objects.create(user=user,name='Local buyer',phone='+60123456789')
        client=APIClient();client.force_authenticate(user)
        day=timezone.localdate()+timedelta(days=1)
        while day.weekday()!=0:day+=timedelta(days=1)
        received=timezone.localdate()
        raws={r['name']:RawMaterial.objects.create(**r) for r in data['raw_materials']}
        packs={name:PackagingItem.objects.create(name=name,quantity=0) for name in data['packaging_items']}
        needed=defaultdict(Decimal);pieces=defaultdict(int)
        for source in data['menus']:
            menu=Product.objects.create(name=source['name'],price=source['price'],delivery_weekdays=source['delivery_weekdays'])
            CartItem.objects.create(user=user,product=menu,quantity=1)
            for name,qty in source['ingredients'].items():
                ProductIngredient.objects.create(product=menu,raw_material=raws[name],quantity_required=qty);needed[name]+=Decimal(qty)
            for name,qty in source['packaging'].items():
                ProductPackaging.objects.create(product=menu,packaging_item=packs[name],quantity_per_item=qty);pieces[name]+=qty
        for name,qty in needed.items():InventoryItem.objects.create(raw_material=raws[name],quantity=qty*10,received_date=received,expiry_date=day,storage_location='Local test storage')
        for name,qty in pieces.items():packs[name].quantity=qty*10;packs[name].save()
        select=dict(delivery_at=day.isoformat()+'T07:30:00+08:00',delivery_method='standard',delivery_area='Local area',arrival_window_minutes=0)
        quote=client.post('/api/orders/quote/',select,format='json');self.assertEqual(quote.status_code,200,quote.data)
        self.assertEqual(quote.data['pricing']['food_subtotal'],'128.00')
        body=dict(**select,payment='cod',expected_total='138.00',request_id=str(uuid.uuid4()),customer={'name':'Local buyer','phone':'0123456789'},delivery_address={'line1':'Local address'})
        placed=client.post('/api/orders/place/',body,format='json');self.assertEqual(placed.status_code,201,placed.data)
        repeated=client.post('/api/orders/place/',body,format='json');self.assertEqual(repeated.data['order_id'],placed.data['order_id'])
        for name,qty in needed.items():self.assertEqual(InventoryItem.objects.get(raw_material=raws[name]).quantity,qty*9)
        for name,qty in pieces.items():packs[name].refresh_from_db();self.assertEqual(packs[name].quantity,qty*9)
        order=Order.objects.get(pk=placed.data['order_id']);self.assertEqual(order.payment_status,'unpaid')
        self.assertEqual(order.items.count(),8);self.assertEqual(IngredientConsumption.objects.count(),89)
