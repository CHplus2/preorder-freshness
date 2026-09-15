from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Product, RawMaterial, ProductIngredient, InventoryItem, Order, OrderItem, Address, CartItem, InventoryLog, Storefront
from .serializers import InventoryItemSerializer

class KitchenTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner', is_staff=True)
        self.user = User.objects.create_user('customer')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.today = timezone.localdate()
        self.material = RawMaterial.objects.create(name='Chicken', unit='g')
        self.product = Product.objects.create(name='Chicken rice', price='12.00')
        ProductIngredient.objects.create(product=self.product, raw_material=self.material, quantity_required='100')
        self.address = Address.objects.create(user=self.user, line1='1 Jalan Test', city='KL', state='KL', postal_code='50000', phone='0123456789')
        self.delivery = (timezone.localtime() + timedelta(days=4)).replace(hour=12, minute=0, second=0)

    def batch(self, qty, days, **kwargs):
        return InventoryItem.objects.create(raw_material=self.material, quantity=qty, received_date=self.today-timedelta(days=2), expiry_date=self.today+timedelta(days=days), storage_location='Fridge', **kwargs)

    def order(self, qty=1):
        order = Order.objects.create(user=self.user, status='processing', delivery_at=self.delivery, preparation_at=self.delivery-timedelta(hours=3))
        OrderItem.objects.create(order=order, product=self.product, product_name=self.product.name, unit_price=12, quantity=qty, subtotal=12*qty)
        return order

    def test_expiry_sources(self):
        for basis in ['storage', 'manufactured']:
            data = dict(raw_material=self.material.id, quantity='100', storage_location='Fridge', received_date=str(self.today), expiry_basis=basis, shelf_life_days=2, guidance_note='Supplier: chilled at 4C', manufactured_date=str(self.today-timedelta(days=1)))
            s=InventoryItemSerializer(data=data)
            self.assertTrue(s.is_valid(), s.errors)
            batch=s.save()
            self.assertEqual(batch.expiry_date,self.today+timedelta(days=2 if basis=='storage' else 1))

    def test_missing_guidance_rejected(self):
        s=InventoryItemSerializer(data=dict(raw_material=self.material.id, quantity=1, storage_location='Fridge', received_date=str(self.today), expiry_basis='storage', shelf_life_days=2))
        self.assertFalse(s.is_valid())

    def test_negative_batch_rejected(self):
        s=InventoryItemSerializer(data=dict(raw_material=self.material.id, quantity=-1, storage_location='Fridge', received_date=str(self.today), expiry_date=str(self.today)))
        self.assertFalse(s.is_valid())

    def test_available_excludes_expired_and_held(self):
        self.batch(1000,-1)
        self.batch(1000,5,quarantined=True)
        self.batch(250,3)
        self.assertEqual(self.product.get_available_quantity(),2)

    def test_cooking_fefo_and_idempotence(self):
        expired=self.batch(500,-1)
        first=self.batch(70,1)
        second=self.batch(100,3)
        order=self.order()
        url=f'/api/admin/orders/{order.id}/'
        self.assertEqual(self.client.patch(url,{'status':'cooked'}).status_code,200)
        self.assertEqual(self.client.patch(url,{'status':'cooked'}).status_code,200)
        first.refresh_from_db();second.refresh_from_db();expired.refresh_from_db()
        self.assertEqual(first.quantity,0)
        self.assertEqual(second.quantity,70)
        self.assertEqual(expired.quantity,500)
        self.assertEqual(InventoryLog.objects.count(),2)

    def test_shortage_rolls_back_every_deduction(self):
        batch=self.batch(50,3);order=self.order()
        response=self.client.patch(f'/api/admin/orders/{order.id}/',{'status':'cooked'})
        self.assertEqual(response.status_code,400)
        batch.refresh_from_db();order.refresh_from_db()
        self.assertEqual(batch.quantity,50)
        self.assertEqual(order.status,'processing')
        self.assertFalse(InventoryLog.objects.exists())

    def test_invalid_transition(self):
        order=self.order()
        self.assertEqual(self.client.patch(f'/api/admin/orders/{order.id}/',{'status':'delivered'}).status_code,400)

    def checkout(self, delivery=None):
        self.client.force_authenticate(self.user)
        CartItem.objects.get_or_create(user=self.user,product=self.product,defaults={'quantity':1})
        return self.client.post('/api/orders/place/',{'address_id':self.address.id,'payment':'cod','delivery_at':(delivery or self.delivery).isoformat()},format='json')

    def test_preorder_does_not_deduct(self):
        batch=self.batch(200,6)
        self.assertEqual(self.checkout().status_code,201)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity,200)
        self.assertFalse(InventoryLog.objects.exists())

    def test_early_delivery_rejected(self):
        self.assertEqual(self.checkout(timezone.now()+timedelta(hours=1)).status_code,400)
        self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.exists())

    def test_capacity_enforced(self):
        self.product.daily_capacity=1;self.product.save()
        self.order()
        self.assertEqual(self.checkout().status_code,400)

    def test_bulk_discount(self):
        Storefront.objects.create(pk=1,bulk_minimum=1,bulk_discount_percent=10)
        self.assertEqual(self.checkout().status_code,201)
        order=Order.objects.get()
        self.assertEqual(order.discount_amount,Decimal('1.20'))
        self.assertEqual(order.total_amount,Decimal('10.80'))
        self.assertEqual(order.shipping_fee,Decimal('5.00'))

    def test_private_inventory(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/admin/inventory-items/').status_code,403)
        self.assertEqual(self.client.get('/api/admin/planning/').status_code,403)

    def test_verified_reviews(self):
        self.client.force_authenticate(self.user)
        url=f'/api/products/{self.product.id}/reviews/'
        self.assertEqual(self.client.post(url,{'rating':5,'comment':'Lovely'}).status_code,403)
        order=self.order();order.status='delivered';order.save()
        self.assertEqual(self.client.post(url,{'rating':6,'comment':'Lovely'}).status_code,400)
        self.assertEqual(self.client.post(url,{'rating':5,'comment':'Lovely'}).status_code,200)
        self.assertEqual(self.client.post(url,{'rating':5,'comment':'Again'}).status_code,400)

    def test_shopping_does_not_double_allocate(self):
        self.batch(100,6)
        self.order();second=self.order()
        result=self.client.get('/api/admin/planning/').json()
        self.assertEqual(len(result['shopping']),1)
        self.assertEqual(result['shopping'][0]['order'],second.id)
        self.assertEqual(Decimal(result['shopping'][0]['quantity']),100)

    def test_recipe_validation(self):
        data={'ingredients':[{'raw_material':self.material.id,'quantity_required':'0'}]}
        self.assertEqual(self.client.patch(f'/api/products/{self.product.id}/',data,format='json').status_code,400)

    def test_settings_permission_and_discount_bounds(self):
        self.assertEqual(self.client.patch('/api/storefront/',{'bulk_discount_percent':99}).status_code,400)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.patch('/api/storefront/',{'name':'Other'}).status_code,403)

    def test_reminders_preview_and_deduplication(self):
        from django.core.management import call_command
        from django.test import override_settings
        from unittest.mock import patch
        from io import StringIO
        from .models import OrderReminder
        order=self.order();order.preparation_at=timezone.now()+timedelta(hours=2);order.save()
        output=StringIO()
        call_command('send_order_reminders',stdout=output)
        self.assertIn('PREVIEW',output.getvalue())
        self.assertFalse(OrderReminder.objects.exists())
        with override_settings(OWNER_NOTIFICATION_EMAIL='owner@example.test',EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'):
            with patch('myapp.management.commands.send_order_reminders.send_mail',return_value=1) as send:
                call_command('send_order_reminders',send=True,stdout=StringIO())
                call_command('send_order_reminders',send=True,stdout=StringIO())
                self.assertEqual(send.call_count,1)

    def test_recommendation_cold_start(self):
        self.batch(200,3)
        self.client.force_authenticate(self.user)
        response=self.client.get('/api/recommendation/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()[0]['product_id'],self.product.id)

    def test_used_material_unit_and_delete_protected(self):
        url=f'/api/admin/raw-materials/{self.material.id}/'
        self.assertEqual(self.client.patch(url,{'unit':'kg'}).status_code,400)
        self.assertEqual(self.client.delete(url).status_code,400)


class BrowserCartTests(TestCase):
    def test_authenticated_cart_from_vite_loopback_origin(self):
        user=User.objects.create_user('browser-user',password='test-browser-password')
        product=Product.objects.create(name='Meal',price='10.00')
        client=APIClient(enforce_csrf_checks=True)
        response=client.post('/api/login/',{'username':user.username,'password':'test-browser-password'},HTTP_HOST='127.0.0.1:8000')
        self.assertEqual(response.status_code,200)
        token=client.cookies['csrftoken'].value
        response=client.post('/api/cart/',{'product_id':product.id,'quantity':1},HTTP_X_CSRFTOKEN=token,HTTP_ORIGIN='http://127.0.0.1:5173',HTTP_HOST='127.0.0.1:8000')
        self.assertEqual(response.status_code,201,response.data)

    def test_untrusted_origin_still_rejected(self):
        user=User.objects.create_user('csrf-user',password='test-browser-password')
        product=Product.objects.create(name='Meal',price='10.00')
        client=APIClient(enforce_csrf_checks=True)
        client.post('/api/login/',{'username':user.username,'password':'test-browser-password'},HTTP_HOST='127.0.0.1:8000')
        response=client.post('/api/cart/',{'product_id':product.id},HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value,HTTP_ORIGIN='https://untrusted.example',HTTP_HOST='127.0.0.1:8000')
        self.assertEqual(response.status_code,403)

    def test_bootstrap_sets_csrf_cookie(self):
        client=APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.get('/api/check-auth/').status_code,200)
        self.assertIn('csrftoken',client.cookies)

    def test_business_story_roundtrip(self):
        owner=User.objects.create_user('story-owner',is_staff=True)
        client=APIClient();client.force_authenticate(owner)
        response=client.patch('/api/storefront/',{'founder_name':'Test owner','founding_story':'A real story supplied by the owner.','service_area':'Confirmed area','whatsapp_number':'60123456789'})
        self.assertEqual(response.status_code,200)
        client.force_authenticate(None)
        self.assertEqual(client.get('/api/storefront/').json()['founder_name'],'Test owner')

    def test_public_routes_resolve_to_spa(self):
        from django.urls import resolve
        for path in ['/', '/menu', '/story', '/how-it-works', '/contact', '/admin/planner']:
            self.assertEqual(resolve(path).kwargs.get('template_name'),None)
            self.assertEqual(resolve(path).func.view_initkwargs['template_name'],'index.html')
