"""Isolated guest sessions and private checkout evidence; no bank requests."""
import uuid
from io import BytesIO
from datetime import timedelta,time
from decimal import Decimal
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Storefront,Product,RawMaterial,ProductIngredient,InventoryItem,CartItem,
    CustomerAccount,GuestCustomer,CheckoutProof,Order,PackagingItem,ProductPackaging,IngredientConsumption,PaymentEvent)


def receipt_image(colour='red'):
    data=BytesIO();Image.new('RGB',(64,64),colour).save(data,'PNG')
    return SimpleUploadedFile('local-receipt.png',data.getvalue(),content_type='image/png')


class GuestCheckoutTests(TestCase):
    def setUp(self):
        self.store=Storefront.objects.create(pk=1,manual_payment_enabled=True,duitnow_qr_url='https://example.com/local-qr.png',
            pickup_enabled=True,pickup_location='Local test kitchen',delivery_areas=['North','South'],
            delivery_area_fees={'North':'4.50','South':'8.00'},free_delivery_minimum_myr=None)
        self.owner=User.objects.create_user('client3-owner',is_staff=True,password='Local-test-password!')
        self.product=Product.objects.create(name='Rice meal',price=12)
        raw=RawMaterial.objects.create(name='Rice',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=raw,quantity_required=100)
        self.stock=InventoryItem.objects.create(raw_material=raw,quantity=1000,received_date=timezone.localdate(),
            expiry_date=timezone.localdate()+timedelta(days=30),storage_location='Dry shelf')
        self.box=PackagingItem.objects.create(name='Container',quantity=20)
        ProductPackaging.objects.create(product=self.product,packaging_item=self.box,quantity_per_item=1)
        self.client=self.guest()
        self.delivery=(timezone.localtime()+timedelta(days=2)).replace(hour=7,minute=30,second=0,microsecond=0)
        self.select=dict(delivery_at=self.delivery.isoformat(),delivery_method='standard',delivery_area='North',arrival_window_minutes=0)
        self.body=dict(**self.select,customer={'name':'Local customer','phone':'012 345 6789'},
            delivery_address={'line1':'House 1, Test street, Kuching 93000'},payment='cod',expected_total='28.50',request_id=str(uuid.uuid4()))
        self.client.post('/api/cart/',dict(product_id=self.product.pk,quantity=2),format='json')

    def guest(self,account=True):
        client=APIClient(enforce_csrf_checks=True)
        client.get('/api/check-auth/')
        r=client.post('/api/guest-session/',{},format='json',HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        self.assertEqual(r.status_code,201,r.data)
        client.credentials(HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        if account:
            CustomerAccount.objects.create(user_id=client.get('/api/check-auth/').data['user_id'],name='Local customer',phone='+60123456789')
        return client

    def upload(self,colour='red',**changes):
        r=self.client.post('/api/checkout-proofs/',{**self.select,**changes,'image':receipt_image(colour)},format='multipart')
        self.assertEqual(r.status_code,201,r.data)
        return r.data

    def place(self,**changes):
        return self.client.post('/api/orders/place/',{**self.body,**changes},format='json')

    def test_guest_has_no_email_password_or_staff_privileges_and_start_is_repeat_safe(self):
        self.client=self.guest(account=False)
        auth=self.client.get('/api/check-auth/').data
        self.assertTrue(auth['is_guest']);self.assertFalse(auth['is_admin'])
        user=User.objects.get(pk=auth['user_id']);self.assertEqual(user.email,'');self.assertFalse(user.has_usable_password())
        count=GuestCustomer.objects.count()
        self.assertEqual(self.client.post('/api/guest-session/',{},format='json').status_code,200)
        self.assertEqual(GuestCustomer.objects.count(),count)
        self.assertIn(self.client.get('/api/admin/orders/').status_code,(401,403))

    def test_browsing_guest_cannot_place_or_upload_even_with_contact_details(self):
        self.client=self.guest(account=False)
        self.client.post('/api/cart/',dict(product_id=self.product.pk,quantity=2),format='json')
        self.assertEqual(self.place().status_code,403)
        r=self.client.post('/api/checkout-proofs/',{**self.select,'image':receipt_image()},format='multipart')
        self.assertEqual(r.status_code,403)
        self.assertFalse(Order.objects.exists());self.assertFalse(CheckoutProof.objects.exists())
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)

    def test_account_contact_changes_reject_stale_checkout(self):
        self.assertEqual(self.place(customer={'name':'Another name','phone':'0123456789'}).status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_anonymous_start_requires_csrf_and_never_looks_up_phone(self):
        c=APIClient(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/guest-session/',{},format='json').status_code,403)
        self.assertEqual(c.post('/api/guest-session/',{'phone':'0123456789'},format='json').status_code,403)
        self.assertIn(c.get('/api/orders/').status_code,(401,403))

    def test_cash_delivery_saves_name_phone_full_address_fee_and_stock(self):
        r=self.place();self.assertEqual(r.status_code,201,r.data)
        order=Order.objects.get(pk=r.data['order_id'])
        self.assertEqual(order.shipping_fee,Decimal('4.50'));self.assertEqual(order.payment_status,'unpaid')
        self.assertEqual(order.fulfilment_snapshot['customer']['phone'],'+60123456789')
        self.assertIn('Kuching',order.delivery_address['line1']);self.assertIsNone(order.address_id)
        self.stock.refresh_from_db();self.box.refresh_from_db()
        self.assertEqual(self.stock.quantity,800);self.assertEqual(self.box.quantity,18)
        self.assertFalse(PaymentEvent.objects.exists())
        repeated=self.place();self.assertEqual(repeated.data['order_id'],order.pk)
        self.assertEqual(IngredientConsumption.objects.count(),1)

    def test_name_phone_and_delivery_address_are_required_but_not_email(self):
        for change in ({'customer':{}},{'customer':{'name':'Buyer','phone':'hello'}},{'delivery_address':{}}):
            self.assertEqual(self.place(**change).status_code,400)
        self.assertEqual(self.place(email_reminder=True).status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_pickup_requires_qr_and_delivery_refuses_old_payment_tools(self):
        self.assertEqual(self.place(delivery_method='pickup',delivery_area='').status_code,400)
        for method in ('wallet','paypal','escrow','deferred'):
            self.assertEqual(self.place(payment=method).status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_delivery_window_minute_edges_and_slot_search_are_consistent(self):
        for t,valid in ((time(7,29),False),(time(7,30),True),(time(11),True),(time(11,1),False)):
            d=self.delivery.replace(hour=t.hour,minute=t.minute)
            r=self.client.post('/api/orders/quote/',{**self.select,'delivery_at':d.isoformat()},format='json')
            self.assertEqual(r.status_code,200 if valid else 400,r.data)
        r=self.client.post('/api/orders/slots/',dict(date=self.delivery.date().isoformat(),delivery_area='North'),format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(timezone.localtime(timezone.datetime.fromisoformat(r.data['slots'][0]['delivery_at'])).time(),time(7,30))

    def test_area_fee_is_authoritative_and_stale_client_total_does_not_place(self):
        self.assertEqual(self.place(delivery_area='Unknown').status_code,400)
        self.assertEqual(self.place(delivery_area='South').status_code,400)
        r=self.place(delivery_area='South',expected_total='32.00');self.assertEqual(r.status_code,201,r.data)
        order=Order.objects.get(pk=r.data['order_id']);self.assertEqual(order.shipping_fee,8)
        self.store.delivery_area_fees={'North':'15.00','South':'19.00'};self.store.save()
        order.refresh_from_db();self.assertEqual(order.shipping_fee,8)

    def test_area_crud_updates_new_quotes_and_preserves_accepted_fees(self):
        staff=APIClient();staff.force_authenticate(self.owner)
        def update(areas,fees,threshold=None):
            r=staff.patch('/api/storefront/',{'delivery_areas':areas,'delivery_area_fees':fees,
                'free_delivery_minimum_myr':threshold},format='json')
            self.assertEqual(r.status_code,200,r.data)
        update(['North','South','West'],{'North':'4.50','South':'8.00','West':'9.00'})
        self.assertIn(self.client.patch('/api/storefront/',{'delivery_area_fees':{}},format='json').status_code,(401,403))
        r=self.place(delivery_area='West',expected_total='33.00',shipping_fee='0.00')
        self.assertEqual(r.status_code,201,r.data);order=Order.objects.get(pk=r.data['order_id'])
        self.assertEqual(order.shipping_fee,9)
        update(['North','South','East'],{'North':'4.50','South':'8.00','East':'7.00'})
        self.client.post('/api/cart/',dict(product_id=self.product.pk,quantity=2),format='json')
        self.assertEqual(self.client.post('/api/orders/quote/',{**self.select,'delivery_area':'West'},format='json').status_code,400)
        quote=self.client.post('/api/orders/quote/',{**self.select,'delivery_area':'East'},format='json')
        self.assertEqual(quote.status_code,200,quote.data)
        order.refresh_from_db();self.assertEqual(order.shipping_fee,9)
        update(['North','South','East'],{'North':'4.50','South':'8.00','East':'7.00'},'20.00')
        free=self.place(delivery_area='East',expected_total='24.00',request_id=str(uuid.uuid4()))
        self.assertEqual(free.status_code,201,free.data)
        self.assertEqual(Order.objects.get(pk=free.data['order_id']).shipping_fee,0)

    def test_delivery_bank_details_without_qr_accept_image_proof_and_stay_unpaid(self):
        staff=APIClient();staff.force_authenticate(self.owner)
        changed=staff.patch('/api/storefront/',{'manual_payment_enabled':True,'duitnow_qr_url':'',
            'bank_transfer_instructions':'Fixture Bank / Local kitchen / fictional receiving details'},format='json')
        self.assertEqual(changed.status_code,200,changed.data)
        proof=self.upload();placed=self.place(payment='manual',payment_proof_id=proof['id'])
        self.assertEqual(placed.status_code,201,placed.data)
        saved=Order.objects.get(pk=placed.data['order_id']);self.assertEqual(saved.payment_status,'unpaid')
        self.assertEqual(saved.payment_method,'manual');self.assertIn('Fixture Bank',saved.payment_instructions['instructions'])
        self.assertFalse(PaymentEvent.objects.exists())

    def test_bank_only_configuration_cannot_replace_pickup_qr_rule(self):
        self.store.duitnow_qr_url='';self.store.bank_transfer_instructions='Fixture receiving bank';self.store.save()
        response=self.client.post('/api/checkout-proofs/',{**self.select,'delivery_method':'pickup','delivery_area':'','image':receipt_image()},format='multipart')
        self.assertEqual(response.status_code,400,response.data)
        self.assertEqual(self.place(payment='manual',delivery_method='pickup',delivery_area='',expected_total='24.00').status_code,400)
        self.assertFalse(Order.objects.exists());self.assertFalse(CheckoutProof.objects.exists())

    def test_changed_bank_recipient_invalidates_old_unfinished_proof_without_stock_deduction(self):
        proof=self.upload();self.store.bank_transfer_instructions='Updated fictional receiving account';self.store.save()
        response=self.place(payment='manual',payment_proof_id=proof['id'])
        self.assertEqual(response.status_code,400,response.data);self.assertFalse(Order.objects.exists())
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)

    def test_quote_returns_authoritative_area_fee_and_free_threshold_before_payment(self):
        self.store.delivery_area_fees={'North':'10.00','South':'8.00'};self.store.save()
        quote=self.client.post('/api/orders/quote/',self.select,format='json')
        self.assertEqual(quote.status_code,200,quote.data)
        self.assertEqual(quote.data['pricing'],dict(food_subtotal='24.00',discount='0.00',delivery_fee='10.00',total='34.00'))
        self.store.free_delivery_minimum_myr=20;self.store.save()
        free=self.client.post('/api/orders/quote/',self.select,format='json')
        self.assertEqual(free.data['pricing']['delivery_fee'],'0.00');self.assertEqual(free.data['pricing']['total'],'24.00')
        self.assertFalse(Order.objects.exists());self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)

    def test_valid_qr_upload_stays_unpaid_and_has_private_access_and_no_original_bytes(self):
        proof=self.upload();r=self.place(payment='manual',payment_proof_id=proof['id'])
        self.assertEqual(r.status_code,201,r.data)
        row=CheckoutProof.objects.get(pk=proof['id']);self.assertEqual(row.order_id,r.data['order_id'])
        self.assertEqual(row.order.payment_status,'unpaid');self.assertFalse(PaymentEvent.objects.exists())
        image=self.client.get(proof['url']);self.assertEqual(image.status_code,200)
        self.assertEqual(image['Content-Type'],'image/webp');self.assertIn('no-store',image['Cache-Control'])
        self.assertTrue(image.content.startswith(b'RIFF'))
        other=self.guest();self.assertEqual(other.get(proof['url']).status_code,404)
        self.assertEqual(other.get(f"/api/orders/{row.order_id}/delivery-time/").status_code,404)
        self.assertEqual(other.get('/api/orders/').data['count'],0)
        staff=APIClient();staff.force_authenticate(self.owner);self.assertEqual(staff.get(proof['url']).status_code,200)
        listing=staff.get('/api/admin/orders/');self.assertEqual(listing.data[0]['payment_proof']['id'],proof['id'])
        self.assertNotIn('content',listing.data[0]['payment_proof'])

    def test_qr_is_required_at_pickup_and_uses_zero_delivery_fee(self):
        proof=self.upload(delivery_method='pickup',delivery_area='')
        self.assertEqual(proof['amount'],'24.00')
        r=self.place(delivery_method='pickup',delivery_area='',payment='manual',expected_total='24.00',payment_proof_id=proof['id'],delivery_address={})
        self.assertEqual(r.status_code,201,r.data)
        order=Order.objects.get(pk=r.data['order_id']);self.assertEqual(order.shipping_fee,0)
        self.assertEqual(order.fulfilment_snapshot['customer']['name'],'Local customer')
        self.assertFalse(order.delivery_address)

    def test_proof_must_match_current_basket_time_and_area(self):
        proof=self.upload()
        for change in ({'delivery_area':'South','expected_total':'32.00'},
                {'delivery_at':self.delivery.replace(hour=8).isoformat()}):
            r=self.place(payment='manual',payment_proof_id=proof['id'],**change);self.assertEqual(r.status_code,400,r.data)
        self.assertFalse(Order.objects.exists());self.assertIsNone(CheckoutProof.objects.get(pk=proof['id']).order_id)

    def test_other_session_cannot_claim_proof_even_with_same_phone(self):
        proof=self.upload();self.client=self.guest()
        self.client.post('/api/cart/',dict(product_id=self.product.pk,quantity=2),format='json')
        r=self.place(payment='manual',payment_proof_id=proof['id']);self.assertEqual(r.status_code,400,r.data)
        self.assertFalse(Order.objects.exists())

    def test_failed_stock_placement_rolls_back_proof_claim_and_preserves_cart(self):
        proof=self.upload();self.stock.quantity=0;self.stock.save()
        r=self.place(payment='manual',payment_proof_id=proof['id']);self.assertEqual(r.status_code,400,r.data)
        self.assertFalse(Order.objects.exists());self.assertIsNone(CheckoutProof.objects.get(pk=proof['id']).order_id)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,20)
        self.assertTrue(CartItem.objects.exists())

    def test_receipt_image_cannot_be_reused_for_another_order(self):
        proof=self.upload();self.assertEqual(self.place(payment='manual',payment_proof_id=proof['id']).status_code,201)
        self.client.post('/api/cart/',dict(product_id=self.product.pk,quantity=2),format='json')
        r=self.client.post('/api/checkout-proofs/',{**self.select,'image':receipt_image()},format='multipart')
        self.assertEqual(r.status_code,400,r.data)
        self.assertEqual(Order.objects.count(),1)

    def test_upload_validation_refuses_executable_corrupt_oversized_and_expired_evidence(self):
        for file in (SimpleUploadedFile('receipt.svg',b'<svg onload="alert(1)"></svg>',content_type='image/svg+xml'),
                SimpleUploadedFile('receipt.jpg',b'not an image',content_type='image/jpeg'),
                SimpleUploadedFile('large.png',b'x'*(4*1024*1024+1),content_type='image/png')):
            self.assertEqual(self.client.post('/api/checkout-proofs/',{**self.select,'image':file},format='multipart').status_code,400)
        proof=self.upload();CheckoutProof.objects.filter(pk=proof['id']).update(created_at=timezone.now()-timedelta(days=2))
        self.assertEqual(self.place(payment='manual',payment_proof_id=proof['id']).status_code,400)

    def test_owner_sign_in_is_not_replaced_by_guest_start(self):
        owner=APIClient();owner.force_authenticate(self.owner)
        self.assertEqual(owner.post('/api/guest-session/',{},format='json').status_code,200)
        self.assertFalse(GuestCustomer.objects.filter(user=self.owner).exists())

    def test_staff_settings_validate_area_fees_and_minute_times(self):
        staff=APIClient();staff.force_authenticate(self.owner)
        for data in ({'delivery_area_fees':{'North':'-1'}},{'delivery_area_fees':{'Unknown':'3.00'}},
                {'delivery_start_time':'11:00','delivery_end_time':'07:30'},{'delivery_start_time':'07:30:30'}):
            self.assertEqual(staff.patch('/api/storefront/',data,format='json').status_code,400)
        r=staff.patch('/api/storefront/',{'delivery_start_time':'07:30','delivery_area_fees':{'North':'4.75','South':'8.00'}},format='json')
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['delivery_start_time'],'07:30:00')


    def test_invalid_upload_attempts_are_rate_limited_even_when_no_proof_is_saved(self):
        for _ in range(10):
            file=SimpleUploadedFile('bad.jpg',b'not a photo',content_type='image/jpeg')
            self.assertEqual(self.client.post('/api/checkout-proofs/',{**self.select,'image':file},format='multipart').status_code,400)
        result=self.client.post('/api/checkout-proofs/',{**self.select,'image':receipt_image()},format='multipart')
        self.assertEqual(result.status_code,429,result.data)
        self.assertFalse(CheckoutProof.objects.exists())


    def test_menu_budget_suggestions_include_the_selected_area_fee(self):
        query=dict(date=self.delivery.date().isoformat(),quantity=3,menu_mode='same',budget='43.00',budget_mode='within')
        r=self.client.post('/api/menu/basket-guide/',query,format='json');self.assertEqual(r.status_code,400)
        north=self.client.post('/api/menu/basket-guide/',dict(query,delivery_area='North'),format='json')
        self.assertEqual(north.status_code,200,north.data);self.assertTrue(north.data['plans'])
        south=self.client.post('/api/menu/basket-guide/',dict(query,delivery_area='South'),format='json')
        self.assertEqual(south.status_code,200,south.data);self.assertFalse(south.data['plans'])


    def test_help_describes_current_payment_and_order_rules_without_legacy_capacity_claims(self):
        from django.core.cache import cache
        cache.clear()
        for lang in ('en','ms','zh'):
            result=self.client.post('/api/help/',dict(topic='payment',language=lang),format='json')
            self.assertEqual(result.status_code,200,result.data)
            self.assertNotIn('PayPal',result.data['answer']);self.assertIn('QR',result.data['answer'])
        answer=self.client.post('/api/help/',dict(topic='preorder'),format='json').data['answer']
        self.assertIn('07:30',answer);self.assertIn('11:00',answer);self.assertIn('no email or password',answer)
