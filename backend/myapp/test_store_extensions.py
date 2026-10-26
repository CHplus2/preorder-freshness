from datetime import datetime, timedelta
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Product, MenuPhoto, Storefront, Order, OrderItem, RawMaterial,
                     ProductIngredient, InventoryItem, IngredientConsumption, OrderAmendment)
from .services.commitments import scheduled_item
from .services.scheduling import schedule_order, booked_tasks


class StoreExtensionsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.now = timezone.make_aware(datetime(2030, 1, 7, 9))
        clock = patch('django.utils.timezone.now', return_value=self.now)
        clock.start(); self.addCleanup(clock.stop)
        self.owner = User.objects.create_user('extensions-owner', is_staff=True)
        self.buyer = User.objects.create_user('extensions-buyer')
        self.client = APIClient(); self.client.force_authenticate(self.owner)
        self.store = Storefront.objects.create(pk=1)
        self.material = RawMaterial.objects.create(name='Fixture rice', unit='g')
        self.product = Product.objects.create(name='Fixture small box', price=10, lead_hours=1, batch_size=4,
            preparation_tasks=[dict(name='Cook', minutes=30, additional_batch_minutes=10, resource='stove'),
                               dict(name='Pack', minutes=10, additional_batch_minutes=2, resource='packing_area')],
            selling_details={'unit':'box','variant_group':'Fixture meal','size_label':'Small'})
        ProductIngredient.objects.create(product=self.product, raw_material=self.material, quantity_required=100)
        self.day = self.now+timedelta(days=3)
        self.delivery = self.day.replace(hour=15)

    def photo(self, fmt='PNG', size=(80, 60)):
        out = BytesIO(); Image.new('RGB', size, '#b06136').save(out, fmt)
        return SimpleUploadedFile('customer-name.png', out.getvalue(), content_type='image/png')

    def order(self, quantity=1, product=None):
        product = product or self.product
        order = Order.objects.create(user=self.buyer, delivery_at=self.delivery, total_amount=product.price*quantity)
        item = OrderItem.objects.create(order=order, product=product, product_name=product.name,
            unit_price=product.price, quantity=quantity, subtotal=product.price*quantity)
        plan = schedule_order([scheduled_item(item)], self.delivery, self.store, now=self.now, exclude_order_id=order.pk)
        from .services.scheduling import plan_snapshot
        order.preparation_at, order.preparation_end_at = plan['start'], plan['end']
        order.preparation_plan = plan_snapshot(plan); order.save()
        return order

    def batch(self, orders, **changes):
        body = {'order_ids':[o.pk for o in orders], **changes}
        return self.client.post('/api/admin/shared-cooking/', body, format='json')

    def combine(self, orders):
        preview = self.batch(orders)
        self.assertEqual(preview.status_code, 200, preview.data)
        applied = self.batch(orders, confirm=preview.data['confirm'])
        self.assertEqual(applied.status_code, 200, applied.data)
        return preview

    def test_upload_roundtrip_persistent_relative_reference_and_cache(self):
        result = self.client.post('/api/admin/menu-photos/', {'image':self.photo()}, format='multipart')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(MenuPhoto.objects.count(), 1)
        url = result.data['image_url']; self.assertTrue(url.startswith('/api/menu-photos/'))
        saved = self.client.patch(f'/api/admin/products/{self.product.pk}/', {'image_url':url}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.client.force_authenticate(None)
        response = self.client.get(url)
        self.assertEqual(response['Content-Type'], 'image/webp')
        self.assertIn('immutable', response['Cache-Control']); self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        image = Image.open(BytesIO(response.content))
        self.assertEqual(image.size, (80,60)); self.assertFalse(image.getexif())
        self.assertEqual(self.client.get(url, HTTP_IF_NONE_MATCH=response['ETag']).status_code, 304)
        self.assertEqual(self.client.get('/api/menu-photos/not-a-hash/').status_code, 404)

    def test_upload_deduplicates_sanitized_content(self):
        for _ in range(2):
            self.assertEqual(self.client.post('/api/admin/menu-photos/', {'image':self.photo()}, format='multipart').status_code, 201)
        self.assertEqual(MenuPhoto.objects.count(), 1)

    def test_upload_rejects_missing_forged_animated_oversize_and_dimensions(self):
        inputs = [None, SimpleUploadedFile('x.png', b'<svg><script>alert(1)</script></svg>', content_type='image/png'),
                  SimpleUploadedFile('x.png', b'x'*(4*1024*1024+1), content_type='image/png'),
                  self.photo(size=(8,8)), self.photo(size=(12001,16))]
        gif = BytesIO(); Image.new('RGB',(30,30)).save(gif,'GIF'); inputs.append(SimpleUploadedFile('x.png',gif.getvalue(),content_type='image/png'))
        for photo in inputs:
            result = self.client.post('/api/admin/menu-photos/', {'image':photo} if photo else {}, format='multipart')
            self.assertEqual(result.status_code,400,result.data)
        self.assertEqual(MenuPhoto.objects.count(),0)

    def test_upload_resizes_large_photos_and_staff_boundary(self):
        result = self.client.post('/api/admin/menu-photos/', {'image':self.photo(size=(2000,1800))}, format='multipart')
        self.assertEqual(result.status_code,201); self.assertEqual(result.data['width'],1600)
        for user in [None,self.buyer]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post('/api/admin/menu-photos/', {'image':self.photo()}, format='multipart').status_code,403)

    def test_managed_photo_reference_rejects_unknown_or_other_relative_paths(self):
        for url in ['/api/menu-photos/'+'a'*64+'/', '/static/random.png', 'javascript:alert(1)']:
            response = self.client.patch(f'/api/admin/products/{self.product.pk}/', {'image_url':url}, format='json')
            self.assertEqual(response.status_code,400,response.data)
        self.assertEqual(self.client.patch(f'/api/admin/products/{self.product.pk}/', {'image_url':'https://example.com/menu.jpg'}, format='json').status_code,200)

    def test_size_options_only_include_active_same_group_without_merging_recipes(self):
        large = Product.objects.create(name='Fixture large box', price=20, selling_details={'variant_group':'Fixture meal','size_label':'Large','unit':'box'})
        Product.objects.create(name='Paused',price=15,selling_status='paused',selling_details={'variant_group':'Fixture meal'})
        Product.objects.create(name='Other',price=15,selling_details={'variant_group':'Another meal'})
        self.client.force_authenticate(None)
        response = self.client.get(f'/api/products/{self.product.pk}/variants/')
        self.assertEqual(response.status_code,200)
        self.assertEqual([row['id'] for row in response.data['results']],[self.product.pk,large.pk])
        self.assertEqual(ProductIngredient.objects.filter(product=large).count(),0)
        self.assertEqual(self.client.get(f'/api/products/{large.pk}/').data['price'],'20.00')

    def test_invalid_variant_group_is_rejected(self):
        for group in ['x'*81, ['malformed']]:
            response=self.client.patch(f'/api/admin/products/{self.product.pk}/',{'selling_details':{'variant_group':group}},format='json')
            self.assertEqual(response.status_code,400,response.data)

    def test_courier_tracking_persists_audit_and_does_not_change_order_or_payment(self):
        order=self.order();version=order.updated_at.isoformat()
        response=self.client.post(f'/api/admin/orders/{order.pk}/tracking/',dict(carrier='Fixture courier',reference='ABC-123',url='https://example.com/track/ABC-123',version=version),format='json')
        self.assertEqual(response.status_code,200,response.data);order.refresh_from_db()
        self.assertEqual((order.status,order.payment_status,order.inventory_deducted),('pending','unpaid',False))
        self.assertEqual(order.fulfilment_snapshot['courier']['reference'],'ABC-123')
        self.assertEqual(order.amendments.get().after['kind'],'courier_tracking')
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.get('/api/orders/').data[0]['fulfilment_snapshot']['courier']['carrier'],'Fixture courier')
        self.assertEqual(self.client.post(f'/api/admin/orders/{order.pk}/tracking/',{},format='json').status_code,403)

    def test_courier_tracking_rejects_unsafe_links_stale_versions_and_collection(self):
        order=self.order();body=dict(carrier='Courier',reference='ABC',version=order.updated_at.isoformat())
        for url in ['http://example.com','https://127.0.0.1/x','javascript:alert(1)','https://example.com:444/x','https://example.com:65536/x','https://user:pass@example.com']:
            self.assertEqual(self.client.post(f'/api/admin/orders/{order.pk}/tracking/',{**body,'url':url},format='json').status_code,400)
        self.assertEqual(self.client.post(f'/api/admin/orders/{order.pk}/tracking/',{**body,'version':self.now-timedelta(days=1)},format='json').status_code,409)
        order.delivery_method='pickup';order.save()
        self.assertEqual(self.client.post(f'/api/admin/orders/{order.pk}/tracking/',{**body,'version':order.updated_at.isoformat()},format='json').status_code,400)

    def test_shared_preview_no_writes_then_one_reservation_and_idempotent_confirm(self):
        a,b=self.order(),self.order(2);original=a.preparation_plan
        preview=self.batch([a,b]);self.assertEqual(preview.status_code,200,preview.data)
        a.refresh_from_db();self.assertEqual(a.preparation_plan,original)
        applied=self.batch([a,b],confirm=preview.data['confirm']);self.assertEqual(applied.status_code,200,applied.data)
        a.refresh_from_db();b.refresh_from_db()
        self.assertEqual(a.preparation_plan['shared_batch'],b.preparation_plan['shared_batch'])
        self.assertEqual(len(booked_tasks([a,b],self.store)),2)
        self.assertEqual(a.preparation_plan['hands_on_minutes'],40)
        again=self.batch([a,b],confirm=preview.data['confirm']);self.assertTrue(again.data['already_applied'])
        self.assertEqual(OrderAmendment.objects.count(),2)
        self.assertEqual((a.payment_status,b.payment_status),('unpaid','unpaid'))
        self.client.force_authenticate(self.buyer)
        row = next(o for o in self.client.get('/api/orders/').data if o['id'] == a.pk)
        self.assertNotIn('order_ids', row['preparation_plan']['shared_batch'])
        self.assertEqual(row['preparation_plan']['shared_batch']['order_count'], 2)

    def test_shared_plans_separate_without_changing_customer_delivery_or_quantities(self):
        a,b=self.order(),self.order(2);self.combine([a,b])
        preview=self.batch([a,b],mode='separate');self.assertEqual(preview.status_code,200,preview.data)
        self.assertEqual(self.batch([a,b],mode='separate',confirm=preview.data['confirm']).status_code,200)
        a.refresh_from_db();b.refresh_from_db()
        self.assertNotIn('shared_batch',a.preparation_plan)
        self.assertEqual(a.delivery_at,self.delivery);self.assertEqual(b.items.get().quantity,2)
        self.assertEqual(len(booked_tasks([a,b],self.store)),4)

    def test_shared_plan_blocks_individual_automatic_manual_and_customer_rescheduling(self):
        a,b=self.order(),self.order();self.combine([a,b])
        for endpoint in [f'/api/admin/orders/{a.pk}/preparation-plan/',f'/api/admin/orders/{a.pk}/manual-plan/']:
            response=self.client.post(endpoint,{},format='json');self.assertEqual(response.status_code,400,response.data)
            self.assertIn('shared',str(response.data).lower())
        self.client.force_authenticate(self.buyer)
        self.assertFalse(self.client.get(f'/api/orders/{a.pk}/reschedule/').data['eligible'])
        self.assertEqual(self.batch([a,b]).status_code,403)

    def test_shared_cooking_preserves_per_order_fefo_and_never_deducts_twice(self):
        a,b=self.order(),self.order(2);self.combine([a,b])
        lot=InventoryItem.objects.create(raw_material=self.material,quantity=1000,received_date=self.now.date(),expiry_date=self.delivery.date()+timedelta(days=1),storage_location='Fixture')
        for order in [a,b,a]:
            response=self.client.patch(f'/api/admin/orders/{order.pk}/',{'status':'cooked'},format='json')
            self.assertEqual(response.status_code,200,response.data)
        lot.refresh_from_db();self.assertEqual(lot.quantity,700)
        self.assertEqual(IngredientConsumption.objects.count(),2)

    def test_shared_compatibility_mismatches_capacity_and_stale_preview(self):
        a,b=self.order(),self.order()
        b.delivery_at+=timedelta(hours=1);b.save()
        self.assertEqual(self.batch([a,b]).status_code,400)
        b.delivery_at=self.delivery;b.save()
        item=b.items.get();item.accepted_ingredients.update(quantity_per_portion=110)
        self.assertEqual(self.batch([a,b]).status_code,400)
        item.accepted_ingredients.update(quantity_per_portion=100)
        self.product.daily_capacity=1;self.product.save()
        self.assertEqual(self.batch([a,b]).status_code,400)
        self.product.daily_capacity=30;self.product.save()
        preview=self.batch([a,b]);self.assertEqual(preview.status_code,200,preview.data)
        a.total_amount=11
        with patch('django.utils.timezone.now',return_value=self.now+timedelta(seconds=1)):a.save()
        self.assertEqual(self.batch([a,b],confirm=preview.data['confirm']).status_code,409)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_shared_candidate_list_and_full_selection_guard(self):
        a,b=self.order(),self.order(2)
        response=self.client.get('/api/admin/shared-cooking/',{'date':self.delivery.date().isoformat()})
        self.assertEqual(response.status_code,200,response.data);self.assertEqual(response.data['candidates'][0]['order_ids'],[a.pk,b.pk])
        self.combine([a,b]);response=self.client.get('/api/admin/shared-cooking/',{'date':self.delivery.date().isoformat()})
        self.assertEqual(response.data['candidates'],[]);self.assertEqual(len(response.data['shared']),1)
        self.assertEqual(self.batch([a,b],mode='separate',confirm='tampered').status_code,400)


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection, connections, close_old_connections
from django.test import TransactionTestCase


@skipUnless(connection.vendor == 'postgresql', 'Requires isolated PostgreSQL shared-reservation locking')
class SharedCookingConcurrencyTests(TransactionTestCase):
    setUp = StoreExtensionsTests.setUp
    order = StoreExtensionsTests.order
    batch = StoreExtensionsTests.batch

    def test_simultaneous_confirmation_saves_one_shared_reservation_once(self):
        a,b=self.order(),self.order()
        preview=self.batch([a,b]);self.assertEqual(preview.status_code,200,preview.data)
        barrier=Barrier(2)
        owner_id=self.owner.pk
        token=preview.data['confirm']
        ids=[a.pk,b.pk]
        def confirm():
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(User.objects.get(pk=owner_id))
                barrier.wait(timeout=10)
                response=client.post('/api/admin/shared-cooking/',{'order_ids':ids,'confirm':token},format='json')
                return response.status_code,response.data
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:confirm(),range(2)))
        self.assertEqual([status for status,_ in results],[200,200],results)
        self.assertEqual(sorted(data['already_applied'] for _,data in results),[False,True])
        self.assertEqual(OrderAmendment.objects.count(),2)
        self.assertEqual(len(booked_tasks(Order.objects.all(),self.store)),2)
