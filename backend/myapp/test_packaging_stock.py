"""Client feedback batch 1: isolated stock, acceptance snapshots and failure recovery."""
import uuid
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (PackagingItem, ProductPackaging, OrderPackaging, PackagingMovement,
    Product, Order, OrderItem, CartItem, Address, Storefront, RawMaterial, ProductIngredient, InventoryItem)
from .services.packaging import allocate_packaging
from .services.order_progress import apply_progress


class PackagingFixture:
    def setUp(self):
        self.owner = User.objects.create_user('pack-owner', is_staff=True)
        self.buyer = User.objects.create_user('pack-buyer')
        self.client = APIClient(); self.client.force_authenticate(self.owner)
        self.box = PackagingItem.objects.create(name='Meal container', quantity=12, reorder_level=3, unit_cost='0.350000')
        self.lid = PackagingItem.objects.create(name='Lid', quantity=12, unit_cost='0.150000')
        self.product = Product.objects.create(name='Test meal', price=12, lead_hours=1, preparation_minutes=30)
        ProductPackaging.objects.create(product=self.product, packaging_item=self.box, quantity_per_item=1)
        ProductPackaging.objects.create(product=self.product, packaging_item=self.lid, quantity_per_item=1)
        self.base = '/api/admin/packaging/'

    def order(self, quantity=2):
        now = timezone.now()
        order = Order.objects.create(user=self.buyer, delivery_at=now+timedelta(days=3),
            preparation_at=now+timedelta(days=2), preparation_end_at=now+timedelta(days=2,hours=1))
        OrderItem.objects.create(order=order, product=self.product, product_name=self.product.name,
            unit_price=12, quantity=quantity, subtotal=12*quantity)
        return order

    def adjustment(self, change, **extra):
        self.box.refresh_from_db()
        return dict(change=change, reason='Supplier receipt', request_id=str(uuid.uuid4()),
                    expected_updated_at=self.box.updated_at.isoformat(), **extra)



class PackagingStockTests(PackagingFixture, TestCase):
    def test_stock_endpoints_are_staff_only(self):
        for user in [None, self.buyer]:
            c=APIClient();c.force_authenticate(user)
            for path in [self.base,self.base+'menus/',self.base+f'{self.box.pk}/movements/']:
                self.assertIn(c.get(path).status_code,[401,403])
            self.assertIn(c.post(self.base,{}).status_code,[401,403])

    def test_csrf_is_required_for_session_writes(self):
        c=APIClient(enforce_csrf_checks=True);c.force_login(self.owner)
        self.assertEqual(c.post(self.base,{},format='json').status_code,403)

    def test_catalogue_query_count_is_constant_and_low_stock_is_recorded(self):
        PackagingItem.objects.create(name='Bag',quantity=1,reorder_level=2)
        with self.assertNumQueries(1):response=self.client.get(self.base)
        self.assertEqual(response.status_code,200)
        self.assertTrue(next(x for x in response.data if x['name']=='Bag')['low_stock'])
        self.assertEqual(next(x for x in response.data if x['id']==self.box.pk)['menu_count'],1)

    def test_opening_stock_is_retry_safe(self):
        body=dict(name='Carry bag',quantity=100,reorder_level=20,unit_cost=None,request_id=str(uuid.uuid4()))
        first=self.client.post(self.base,body,format='json');second=self.client.post(self.base,body,format='json')
        self.assertEqual(first.status_code,201,first.data);self.assertEqual(second.status_code,200,second.data)
        self.assertEqual(first.data['id'],second.data['id'])
        self.assertEqual(PackagingMovement.objects.filter(kind='opening').count(),1)

    def test_names_and_stock_inputs_cannot_bypass_validation(self):
        for body in [dict(name='meal CONTAINER',quantity=1,reorder_level=2,unit_cost=None),
                     dict(name='Bag',quantity=-1,reorder_level=2,unit_cost=None),
                     dict(name='Bag',quantity='2.5',reorder_level=2,unit_cost=None)]:
            body['request_id']=str(uuid.uuid4())
            self.assertEqual(self.client.post(self.base,body,format='json').status_code,400)
        response=self.client.patch(self.base+f'{self.box.pk}/',{'quantity':999},format='json')
        self.assertEqual(response.status_code,400)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,12)

    def test_adjustment_retries_once_and_rejects_changed_reference(self):
        body=self.adjustment(5);path=self.base+f'{self.box.pk}/movements/'
        self.assertEqual(self.client.post(path,body,format='json').status_code,200)
        self.assertEqual(self.client.post(path,body,format='json').status_code,200)
        self.assertEqual(self.client.post(path,{**body,'change':6},format='json').status_code,409)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,17)
        self.assertEqual(PackagingMovement.objects.count(),1)

    def test_stale_adjustment_does_not_overwrite_new_stock(self):
        body=self.adjustment(5)
        path=self.base+f'{self.box.pk}/movements/'
        self.client.post(path,body,format='json')
        body['request_id']=str(uuid.uuid4())
        self.assertEqual(self.client.post(path,body,format='json').status_code,409)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,17)

    def test_stock_cannot_become_negative(self):
        response=self.client.post(self.base+f'{self.box.pk}/movements/',self.adjustment(-13),format='json')
        self.assertEqual(response.status_code,400)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,12)
        self.assertFalse(PackagingMovement.objects.exists())

    def test_accepted_mapping_and_cost_survive_later_menu_edits(self):
        order=self.order(3);line=order.items.get()
        self.assertEqual(line.packaging_unit_cost,Decimal('0.50'))
        ProductPackaging.objects.filter(product=self.product).delete()
        self.box.unit_cost=9;self.box.save()
        with transaction.atomic():allocate_packaging(order,self.owner)
        self.box.refresh_from_db();self.lid.refresh_from_db()
        self.assertEqual((self.box.quantity,self.lid.quantity),(9,9))
        line.refresh_from_db();self.assertEqual(line.packaging_unit_cost,Decimal('0.50'))
        self.assertEqual(OrderPackaging.objects.get(order_item=line,packaging_item=self.box).unit_cost,Decimal('.35'))

    def test_fractional_packaging_cost_is_preserved_before_order_total_rounding(self):
        self.box.unit_cost=Decimal('0.001250');self.box.save()
        self.lid.unit_cost=Decimal('0.002500');self.lid.save()
        line=self.order(20).items.get()
        self.assertEqual(line.packaging_unit_cost,Decimal('0.003750'))
        self.assertEqual(line.packaging_unit_cost*line.quantity,Decimal('0.075000'))

    def test_unknown_supply_cost_stays_unknown(self):
        self.lid.unit_cost=None;self.lid.save()
        line=self.order().items.get()
        self.assertIsNone(line.packaging_unit_cost)

    def test_grouped_shortage_rolls_back_all_packaging(self):
        order=self.order(3);self.lid.quantity=2;self.lid.save()
        with self.assertRaisesMessage(Exception,'Not enough Lid'):
            with transaction.atomic():allocate_packaging(order,self.owner)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,12)
        self.assertFalse(PackagingMovement.objects.exists())
        self.assertFalse(OrderPackaging.objects.filter(allocated_at__isnull=False).exists())

    def test_allocation_is_once_only_and_archived_supplies_block_new_allocations(self):
        order=self.order()
        with transaction.atomic():allocate_packaging(order,self.owner);allocate_packaging(order,self.owner)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,10)
        self.assertEqual(PackagingMovement.objects.filter(kind='allocate').count(),2)
        other=self.order();self.box.is_active=False;self.box.save()
        with self.assertRaisesMessage(Exception,'archived'):
            with transaction.atomic():allocate_packaging(other,self.owner)

    def test_cancel_before_cooking_returns_stock_exactly_once(self):
        order=self.order()
        with transaction.atomic():allocate_packaging(order,self.owner)
        with transaction.atomic():apply_progress(order,'cancelled',self.owner)
        with transaction.atomic():apply_progress(order,'cancelled',self.owner)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,12)
        self.assertEqual(PackagingMovement.objects.filter(kind='release').count(),2)

    def test_cooked_cancellation_does_not_return_used_packaging(self):
        order=self.order()
        with transaction.atomic():allocate_packaging(order,self.owner)
        order.status='cooked';order.save()
        with transaction.atomic():apply_progress(order,'cancelled',self.owner)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,10)
        self.assertFalse(PackagingMovement.objects.filter(kind='release').exists())

    def test_mapping_updates_are_versioned_and_do_not_rewrite_old_orders(self):
        old=self.order();path=self.base+f'menus/{self.product.pk}/'
        body=dict(expected_updated_at=self.product.updated_at.isoformat(),requirements=[dict(packaging_item=self.box.pk,quantity_per_item=2)])
        response=self.client.put(path,body,format='json');self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(self.client.put(path,body,format='json').status_code,409)
        self.assertEqual(old.items.get().accepted_packaging.count(),2)
        self.assertEqual(self.order().items.get().accepted_packaging.get().quantity,4)

    def test_mapping_duplicate_invalid_and_archived_items_rejected(self):
        path=self.base+f'menus/{self.product.pk}/';version=self.product.updated_at.isoformat()
        for rows in [[dict(packaging_item=self.box.pk,quantity_per_item=0)],
                     [dict(packaging_item=self.box.pk,quantity_per_item=1)]*2,
                     [dict(packaging_item=999999,quantity_per_item=1)]]:
            self.assertEqual(self.client.put(path,dict(expected_updated_at=version,requirements=rows),format='json').status_code,400)
        self.assertEqual(self.product.packaging_requirements.count(),2)

    def test_history_is_bounded_and_includes_the_order(self):
        order=self.order()
        with transaction.atomic():allocate_packaging(order,self.owner)
        response=self.client.get(self.base+f'{self.box.pk}/movements/')
        self.assertEqual(response.data['results'][0]['order_id'],order.pk)
        self.assertIsNone(response.data['next_before'])
        self.assertEqual(self.client.get(self.base+f'{self.box.pk}/movements/?before=bad').status_code,400)


class PackagingCheckoutTests(PackagingFixture, TestCase):
    # Reuse stock setup; checkout tests exercise actual API placement and retry.
    def checkout_setup(self, quantity=2):
        Storefront.objects.create(pk=1,manual_payment_enabled=True,bank_transfer_instructions='Test QR instructions')
        Address.objects.create(user=self.buyer,line1='Test address',city='KL',state='KL',postal_code='50000',phone='0100000000')
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=quantity)
        material=RawMaterial.objects.create(name='Test rice',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=material,quantity_required=100)
        InventoryItem.objects.create(raw_material=material,quantity=1000,received_date=timezone.localdate(),
            expiry_date=timezone.localdate()+timedelta(days=30),storage_location='Dry shelf',unit_cost='.01')
        self.client.force_authenticate(self.buyer)
        delivery=(timezone.localtime()+timedelta(days=4)).replace(hour=18,minute=0,second=0,microsecond=0)
        return dict(request_id=str(uuid.uuid4()),address_id=Address.objects.get(user=self.buyer).pk,
                    payment='manual',delivery_at=delivery.isoformat())

    def test_checkout_deducts_packaging_once_and_food_ready_does_not_repeat(self):
        body=self.checkout_setup();response=self.client.post('/api/orders/place/',body,format='json')
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(self.client.post('/api/orders/place/',body,format='json').data['order_id'],response.data['order_id'])
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,10)
        order=Order.objects.get(pk=response.data['order_id'])
        with transaction.atomic():apply_progress(order,'cooked',self.owner)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,10)
        self.assertEqual(PackagingMovement.objects.filter(kind='allocate').count(),2)

    def test_checkout_shortage_rolls_back_order_and_preserves_basket(self):
        body=self.checkout_setup(3);self.box.quantity=2;self.box.save()
        response=self.client.post('/api/orders/place/',body,format='json')
        self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(Order.objects.exists());self.assertTrue(CartItem.objects.filter(user=self.buyer).exists())
        self.assertFalse(OrderPackaging.objects.exists());self.assertFalse(PackagingMovement.objects.exists())

    def test_quote_reports_packaging_shortage_without_changing_stock(self):
        body=self.checkout_setup(3);self.box.quantity=2;self.box.save()
        response=self.client.post('/api/orders/quote/',body,format='json')
        self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(Order.objects.exists());self.assertFalse(PackagingMovement.objects.exists())
