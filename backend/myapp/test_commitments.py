import uuid
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase, override_settings
from django.db.models.deletion import ProtectedError
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.test import APIClient
from .models import (Product, ProductIngredient, RawMaterial, InventoryItem, Order, OrderItem,
    Address, CartItem, Storefront, PaymentEvent, IngredientConsumption, Wallet,
    WalletTransaction, InventoryLog, AuthAttempt, OrderAmendment)
from .views.outcomes import contribution


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CommitmentTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner', is_staff=True)
        self.buyer = User.objects.create_user('buyer', email='buyer@example.test', password='Original-good-password!42')
        self.client = APIClient(); self.client.force_authenticate(self.owner)
        self.store = Storefront.objects.create(pk=1)
        self.material = RawMaterial.objects.create(name='Rice', unit='g')
        self.product = Product.objects.create(name='Rice meal', price=12, packaging_cost=Decimal('0.50'), lead_hours=1)
        ProductIngredient.objects.create(product=self.product, raw_material=self.material, quantity_required=100)
        self.lot = InventoryItem.objects.create(raw_material=self.material, quantity=1000,
            received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=10), unit_cost=Decimal('0.02'))
        self.delivery = (timezone.localtime()+timedelta(days=3)).replace(hour=16, minute=0, second=0, microsecond=0)
        self.address = Address.objects.create(user=self.buyer, line1='Test', city='KL', state='KL', postal_code='50000', phone='0123456789')

    def order(self, status='processing', method='cod', paid='unpaid'):
        order = Order.objects.create(user=self.buyer, status=status, payment_method=method,
            payment_status=paid, total_amount=12, shipping_fee=5, delivery_at=self.delivery,
            preparation_at=self.delivery-timedelta(hours=2), preparation_end_at=self.delivery-timedelta(minutes=90))
        OrderItem.objects.create(order=order, product=self.product, product_name=self.product.name,
            unit_price=12, subtotal=12, quantity=1)
        return order

    def cook(self, order):
        return self.client.patch(f'/api/admin/orders/{order.pk}/', {'status':'cooked'}, format='json')

    def payment(self, order, **kw):
        data = dict(request_id=str(uuid.uuid4()), kind='receipt', outcome='completed', reference='Verified bank/cash record')
        data.update(kw)
        return self.client.post(f'/api/admin/orders/{order.pk}/payments/', data, format='json')

    def test_recipe_edit_cannot_change_accepted_consumption_or_packaging(self):
        order = self.order()
        self.product.ingredients.update(quantity_required=500)
        self.product.packaging_cost=9; self.product.save()
        self.assertEqual(self.cook(order).status_code,200)
        self.lot.refresh_from_db(); self.assertEqual(self.lot.quantity,900)
        item=order.items.get();self.assertEqual(item.packaging_unit_cost,Decimal('0.50'))
        self.assertEqual(item.consumption.get().quantity,100)
        self.assertEqual(self.cook(order).status_code,200)
        self.assertEqual(IngredientConsumption.objects.count(),1)

    def test_deleted_menu_does_not_destroy_accepted_recipe(self):
        order=self.order();self.product.delete()
        self.assertEqual(self.cook(order).status_code,200)
        with self.assertRaises(ProtectedError):self.material.delete()

    def test_planning_uses_frozen_ingredients(self):
        order=self.order();self.product.ingredients.update(quantity_required=2000)
        response=self.client.get('/api/admin/planning/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data['shopping'],[])
        self.assertEqual(Decimal(response.data['allocations'][0]['quantity']),100)

    def test_shortage_rolls_back_structured_consumption(self):
        self.lot.quantity=50;self.lot.save();order=self.order()
        self.assertEqual(self.cook(order).status_code,400)
        self.assertFalse(IngredientConsumption.objects.exists())
        self.assertFalse(InventoryLog.objects.exists())
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity,50)

    def test_cost_and_trace_survive_later_batch_edits(self):
        order=self.order(paid='paid');self.cook(order)
        self.lot.unit_cost=5;self.lot.batch_code='changed';self.lot.save()
        order.status='delivered';order.save(update_fields=['status']);order.refresh_from_db()
        row=contribution(order)
        self.assertEqual(row['food_contribution'],'9.50')
        self.assertEqual(row['trace'][0]['unit_cost'],'0.020000')
        response=self.client.get(f'/api/admin/inventory-items/{self.lot.pk}/trace/')
        self.assertEqual(response.data['orders'][0]['order'],order.pk)
        self.assertEqual(self.client.delete(f'/api/admin/inventory-items/{self.lot.pk}/').status_code,400)

    def test_unknown_cost_is_not_zero_profit(self):
        self.lot.unit_cost=None;self.lot.save();order=self.order(paid='paid');self.cook(order)
        order.status='delivered';order.save(update_fields=['status']);order.refresh_from_db()
        self.assertIsNone(contribution(order)['food_contribution'])

    def test_cooked_cancellation_keeps_cost_as_loss(self):
        order=self.order();self.cook(order);order.status='cancelled';order.save(update_fields=['status']);order.refresh_from_db()
        self.assertEqual(contribution(order)['food_contribution'],'-2.50')

    def test_customer_cannot_change_roles_delete_or_read_private_reports(self):
        self.order()
        self.assertEqual(self.client.patch(f'/api/admin/customers/{self.buyer.pk}/',{'is_staff':True}).status_code,400)
        self.assertEqual(self.client.patch(f'/api/admin/customers/{self.owner.pk}/',{'is_active':False}).status_code,400)
        self.assertEqual(self.client.delete(f'/api/admin/customers/{self.buyer.pk}/').status_code,405)
        self.assertEqual(self.client.post('/api/admin/customers/',{'username':'other'}).status_code,405)
        with self.assertRaises(ProtectedError):self.buyer.delete()
        self.assertEqual(self.client.patch(f'/api/admin/customers/{self.buyer.pk}/',{'is_active':False}).status_code,200)
        self.client.force_authenticate(self.buyer)
        for url in ['/api/admin/contribution/','/api/admin/recommendation-metrics/',f'/api/admin/inventory-items/{self.lot.pk}/trace/']:
            self.assertEqual(self.client.get(url).status_code,403)

    def test_payment_requires_evidence_and_cannot_change_flag(self):
        order=self.order()
        self.assertEqual(self.client.patch(f'/api/admin/orders/{order.pk}/',{'payment_status':'paid'}).status_code,400)
        self.assertEqual(self.payment(order,reference='').status_code,400)
        self.assertEqual(self.payment(order).status_code,201)
        order.refresh_from_db();self.assertEqual(order.payment_status,'paid')
        self.assertEqual(self.payment(order).status_code,400)

    def test_refund_pending_failed_then_completed(self):
        order=self.order();self.payment(order)
        pending=self.payment(order,kind='refund',outcome='pending')
        self.assertEqual(pending.status_code,201)
        self.assertEqual(self.payment(order,kind='refund').status_code,400)
        failed=self.payment(order,kind='refund',outcome='failed',resolves=pending.data['id'])
        self.assertEqual(failed.status_code,201)
        order.refresh_from_db();self.assertEqual(order.payment_status,'paid')
        self.assertEqual(self.payment(order,kind='refund').status_code,201)
        order.refresh_from_db();self.assertEqual(order.payment_status,'refunded')

    def test_wallet_refund_exactly_once_and_mismatched_retry_rejected(self):
        order=self.order(method='wallet',paid='paid')
        wallet=Wallet.objects.create(user=self.buyer,balance=0,wallet_address='demo-test')
        rid=str(uuid.uuid4())
        self.assertEqual(self.payment(order,kind='refund',request_id=rid).status_code,201)
        self.assertEqual(self.payment(order,kind='refund',request_id=rid).status_code,200)
        wallet.refresh_from_db();self.assertEqual(wallet.balance,17)
        self.assertEqual(WalletTransaction.objects.filter(type='refund').count(),1)
        self.assertEqual(self.payment(order,kind='refund',request_id=rid,reference='changed').status_code,400)

    def test_inventory_adjustment_requires_reason_and_records_delta(self):
        url=f'/api/admin/inventory-items/{self.lot.pk}/'
        body={'updated_at':self.lot.updated_at.isoformat(),'quantity':900}
        self.assertEqual(self.client.patch(url,body,format='json').status_code,400)
        body['adjustment_reason']='Physical count correction'
        self.assertEqual(self.client.patch(url,body,format='json').status_code,200)
        self.assertEqual(InventoryLog.objects.get().change,-100)

    def test_checkout_retry_returns_original_order(self):
        self.client.force_authenticate(self.buyer)
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        body={'address_id':self.address.pk,'payment':'cod','delivery_at':self.delivery.isoformat(),'request_id':str(uuid.uuid4())}
        first=self.client.post('/api/orders/place/',body,format='json')
        second=self.client.post('/api/orders/place/',body,format='json')
        self.assertEqual(first.status_code,201,first.data)
        self.assertEqual(second.status_code,200,second.data)
        self.assertEqual(first.data['order_id'],second.data['order_id'])
        self.assertEqual(Order.objects.count(),1)

    def test_guest_guidance_uses_future_capacity_not_current_stock(self):
        self.lot.quantity=0;self.lot.save();self.client.force_authenticate(None)
        response=self.client.post('/api/menu/guide/',{'date':str(self.delivery.date()),'portions':2,'budget':'30'},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['results'][0]['id'],self.product.pk)
        self.assertEqual(response.data['results'][0]['food_total'],'24.00')
        self.assertTrue(response.data['results'][0]['slots'])

    def test_guide_respects_budget_capacity_and_invalid_date(self):
        self.client.force_authenticate(None)
        for body in [{'date':str(self.delivery.date()),'budget':'1'}, {'date':str(self.delivery.date()),'portions':100}]:
            self.assertEqual(self.client.post('/api/menu/guide/',body,format='json').data['results'],[])
        self.assertEqual(self.client.post('/api/menu/guide/',{'date':'bad'},format='json').status_code,400)

    def test_metrics_require_rendered_results_and_verified_purchase(self):
        self.client.force_authenticate(self.buyer)
        guided=self.client.post('/api/menu/guide/',{'date':str(self.delivery.date())},format='json').data
        sid=guided['session']
        stranger=APIClient()
        event={'session':sid,'event':'impression','request_id':str(uuid.uuid4())}
        self.assertEqual(stranger.post('/api/recommendation/events/',event,format='json').status_code,400)
        self.assertEqual(self.client.post('/api/recommendation/events/',event,format='json').status_code,200)
        self.client.post('/api/recommendation/events/',event,format='json')
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=1)
        placed=self.client.post('/api/orders/place/',{'address_id':self.address.pk,'payment':'cod','delivery_at':self.delivery.isoformat(),'recommendation_session':sid},format='json')
        self.assertEqual(placed.status_code,201,placed.data)
        self.client.force_authenticate(self.owner)
        rows=self.client.get('/api/admin/recommendation-metrics/').data['rows']
        self.assertEqual(rows[0]['exposed_sessions'],1)
        self.assertEqual(rows[0]['ordered_sessions'],1)
        self.assertEqual(rows[0]['paid_sessions'],0)
        self.payment(Order.objects.get(pk=placed.data['order_id']))
        self.assertEqual(self.client.get('/api/admin/recommendation-metrics/').data['rows'][0]['paid_sessions'],1)

    def test_signup_rejects_weak_password(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/signup/',{'username':'newuser','password':'123','confirmPassword':'123'},format='json').status_code,400)
        self.assertFalse(User.objects.filter(username='newuser').exists())

    @override_settings(PUBLIC_APP_URL='https://kitchen.example', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_recovery_generic_response_and_single_use_token(self):
        self.client.force_authenticate(None)
        a=self.client.post('/api/auth/recovery/',{'username':'buyer','email':'buyer@example.test'},format='json')
        b=self.client.post('/api/auth/recovery/',{'username':'missing','email':'missing@example.test'},format='json')
        self.assertEqual(a.data,b.data);self.assertEqual(len(mail.outbox),1)
        self.assertIn('https://kitchen.example/recover#uid=',mail.outbox[0].body)
        body={'uid':urlsafe_base64_encode(force_bytes(self.buyer.pk)), 'token':default_token_generator.make_token(self.buyer), 'password':'Changed-strong-password!91'}
        self.assertEqual(self.client.post('/api/auth/recovery/confirm/',body,format='json').status_code,200)
        self.assertEqual(self.client.post('/api/auth/recovery/confirm/',body,format='json').status_code,400)
        self.buyer.refresh_from_db();self.assertTrue(self.buyer.check_password(body['password']))

    def test_login_limit_shared_database(self):
        self.client.force_authenticate(None)
        for _ in range(15):
            self.assertEqual(self.client.post('/api/login/',{'username':'buyer','password':'wrong'},format='json').status_code,401)
        self.assertEqual(self.client.post('/api/login/',{'username':'buyer','password':'wrong'},format='json').status_code,429)

    def test_anonymous_login_requires_csrf(self):
        client=APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/login/',{'username':'buyer','password':'Original-good-password!42'}).status_code,403)
        client.get('/api/check-auth/')
        self.assertEqual(client.post('/api/login/',{'username':'buyer','password':'Original-good-password!42'},HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value).status_code,200)

    def test_explicit_recipe_amendment_preserves_before_and_after(self):
        self.product.preparation_tasks=[dict(name='Cook',resource='stove',worker=True,minutes=30,additional_batch_minutes=10,max_wait_minutes=0,overnight=False)]
        self.product.save()
        order=self.order(status='pending')
        self.product.ingredients.update(quantity_required=150)
        url=f'/api/admin/orders/{order.pk}/preparation-plan/'
        preview=self.client.post(url,{'adopt_current':True},format='json')
        self.assertEqual(preview.status_code,200,preview.data)
        self.assertEqual(order.items.get().accepted_ingredients.get().quantity_per_portion,100)
        confirm=self.client.post(url,{'adopt_current':True,'confirm':preview.data['confirm']},format='json')
        self.assertEqual(confirm.status_code,200,confirm.data)
        self.assertEqual(order.items.get().accepted_ingredients.get().quantity_per_portion,150)
        amendment=OrderAmendment.objects.get()
        self.assertEqual(amendment.before['items'][0]['ingredients'][0]['quantity'],'100.000')
        self.assertEqual(amendment.after['recipes'][0]['ingredients'][0]['quantity'],'150.000')
        self.assertEqual(self.client.post(url,{'adopt_current':True,'confirm':preview.data['confirm']},format='json').status_code,409)

    def test_replan_keeps_accepted_settings_despite_current_menu_edits(self):
        self.product.preparation_tasks=[dict(name='Cook',resource='stove',worker=True,minutes=30,additional_batch_minutes=0,max_wait_minutes=0,overnight=False)]
        self.product.save();order=self.order(status='pending')
        self.product.preparation_tasks[0]['minutes']=120;self.product.save()
        preview=self.client.post(f'/api/admin/orders/{order.pk}/preparation-plan/',{},format='json')
        self.assertEqual(preview.status_code,200,preview.data)
        self.assertEqual(preview.data['preview']['plan']['minutes'],30)

    def test_basket_slots_and_procurement_quote(self):
        self.client.force_authenticate(self.buyer)
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=2)
        self.lot.quantity=0;self.lot.save()
        response=self.client.post('/api/orders/slots/',{'date':str(self.delivery.date())},format='json')
        self.assertEqual(response.status_code,200,response.data)
        selected=response.data['slots'][0]['delivery_at']
        quote=self.client.post('/api/orders/quote/',{'delivery_at':selected},format='json')
        self.assertEqual(quote.status_code,200,quote.data)
        self.assertTrue(quote.data['procurement_required'])
        self.assertFalse(Order.objects.exists())
