"""Client batch 2: default simple ordering, without cooking-time gates."""
import uuid
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Storefront, Product, RawMaterial, ProductIngredient, InventoryItem, CartItem,
    Address, Order, OrderItem, IngredientConsumption, InventoryLog, KitchenBlock, PackagingItem,
    ProductPackaging, PackagingMovement, OrderAmendment)


class SimpleOrderingTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('simple-owner',is_staff=True)
        self.buyer=User.objects.create_user('simple-buyer')
        self.other=User.objects.create_user('other-buyer')
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.store=Storefront.objects.create(pk=1,manual_payment_enabled=True,bank_transfer_instructions='Local test instructions',duitnow_qr_url='https://example.com/local-qr.png',kitchen_open_hour=8,kitchen_close_hour=9)
        self.product=Product.objects.create(name='Rice meal',price=12,lead_hours=1000,daily_capacity=1,
            preparation_tasks=[dict(name='Long cooking',minutes=3000,resource='oven',worker=True)])
        self.rice=RawMaterial.objects.create(name='Rice',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=self.rice,quantity_required=100)
        today=timezone.localdate()
        self.early=InventoryItem.objects.create(raw_material=self.rice,quantity=400,received_date=today,
            expiry_date=today+timedelta(days=10),storage_location='Dry shelf',unit_cost='.01')
        self.later=InventoryItem.objects.create(raw_material=self.rice,quantity=500,received_date=today,
            expiry_date=today+timedelta(days=30),storage_location='Dry shelf',unit_cost='.02')
        self.box=PackagingItem.objects.create(name='Container',quantity=20,unit_cost='.50')
        ProductPackaging.objects.create(product=self.product,packaging_item=self.box,quantity_per_item=1)
        self.address=Address.objects.create(user=self.buyer,recipient_name='Test customer',line1='Test street',city='KL',state='KL',postal_code='50000',phone='0100000000')
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=3)
        self.delivery=(timezone.localtime()+timedelta(days=3)).replace(hour=10,minute=15,second=0,microsecond=0)
        self.body=dict(customer={'name':'Test customer','phone':'0123456789'},delivery_address={'line1':'Local test address'},payment='cod',request_id=str(uuid.uuid4()),address_id=self.address.pk,delivery_at=self.delivery.isoformat())

    def place(self):
        response=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(response.status_code,201,response.data)
        return Order.objects.get(pk=response.data['order_id'])

    def receipt(self,order,received=True,reason=''):
        self.client.force_authenticate(self.owner)
        return self.client.post('/api/admin/orders/receipts/',dict(received=received,reason=reason,
            orders=[dict(id=order.pk,version=order.updated_at.isoformat())]),format='json')

    def test_bulk_receipt_checks_every_version_before_writing(self):
        first=self.place()
        self.client.force_authenticate(self.buyer)
        CartItem.objects.create(user=self.buyer,product=self.product,quantity=3)
        self.body['request_id']=str(uuid.uuid4())
        second=self.place()
        self.client.force_authenticate(self.owner)
        payload=dict(received=True,orders=[dict(id=o.pk,version=o.updated_at.isoformat()) for o in [first,second]])
        second.save()
        result=self.client.post('/api/admin/orders/receipts/',payload,format='json')
        self.assertEqual(result.status_code,409,result.data)
        first.refresh_from_db();self.assertEqual(first.status,'pending')
        self.assertFalse(OrderAmendment.objects.exists())

    def test_unsupported_wallet_payment_does_not_debit_or_deduct_stock(self):
        from .models import Wallet,WalletTransaction,PaymentEvent
        wallet=Wallet.objects.create(user=self.buyer,balance=100,wallet_address='local-simple-stock-test')
        self.body['payment']='wallet';self.early.quantity=0;self.early.save();self.later.quantity=0;self.later.save()
        result=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(result.status_code,400,result.data)
        wallet.refresh_from_db();self.assertEqual(wallet.balance,100)
        self.assertFalse(WalletTransaction.objects.exists());self.assertFalse(PaymentEvent.objects.exists())
        self.assertFalse(Order.objects.exists());self.box.refresh_from_db();self.assertEqual(self.box.quantity,20)

    def test_default_has_no_preparation_plan_and_ignores_capacity_and_worker_closures(self):
        KitchenBlock.objects.create(start_at=timezone.now(),end_at=self.delivery+timedelta(days=1),reason='Historical closure')
        order=self.place()
        self.assertEqual(order.ordering_mode,'simple');self.assertIsNone(order.preparation_at)
        self.assertIsNone(order.preparation_end_at);self.assertEqual(order.preparation_plan['tasks'],[])
        self.assertFalse(order.preparation_plan['needs_review'])

    def test_placement_deducts_exact_accepted_ingredients_and_packaging_once(self):
        order=self.place();self.early.refresh_from_db();self.box.refresh_from_db()
        self.assertEqual(self.early.quantity,100);self.assertEqual(self.box.quantity,17)
        self.assertTrue(order.inventory_deducted)
        self.assertEqual(IngredientConsumption.objects.get().quantity,300)
        self.assertEqual(IngredientConsumption.objects.get().allocation_stage,'placement')
        retry=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(retry.data['order_id'],order.pk)
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,100)
        self.assertEqual(IngredientConsumption.objects.count(),1)

    def test_stock_estimate_changes_after_placement_without_manual_menu_count(self):
        from .serializers import ProductSerializer
        self.assertEqual(ProductSerializer(self.product).data['stock'],9)
        other=Product.objects.create(name='Shared rice meal',price=10)
        ProductIngredient.objects.create(product=other,raw_material=self.rice,quantity_required=200)
        ProductPackaging.objects.create(product=other,packaging_item=self.box,quantity_per_item=1)
        self.assertEqual(other.get_available_quantity(),4)
        order=self.place()
        self.assertEqual(ProductSerializer(self.product).data['stock'],6)
        self.assertEqual(other.get_available_quantity(),3)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,17)
        retry=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(retry.status_code,200,retry.data)
        self.assertEqual(retry.data['order_id'],order.pk)
        self.assertEqual(ProductSerializer(self.product).data['stock'],6)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,17)

    def test_future_delivery_skips_lots_expiring_before_delivery(self):
        self.early.expiry_date=timezone.localdate()+timedelta(days=1);self.early.save()
        self.place();self.early.refresh_from_db();self.later.refresh_from_db()
        self.assertEqual(self.early.quantity,400);self.assertEqual(self.later.quantity,200)

    def test_held_expired_and_future_received_stock_cannot_cover_shortage(self):
        self.early.quarantined=True;self.early.save()
        self.later.received_date=timezone.localdate()+timedelta(days=1);self.later.save()
        r=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(r.status_code,400,r.data);self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.filter(user=self.buyer).exists())
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,20)
        self.assertFalse(PackagingMovement.objects.exists());self.assertFalse(InventoryLog.objects.exists())

    def test_shared_ingredient_is_aggregated_across_different_menus(self):
        other=Product.objects.create(name='Second rice meal',price=10)
        ProductIngredient.objects.create(product=other,raw_material=self.rice,quantity_required=400)
        CartItem.objects.create(user=self.buyer,product=other,quantity=2)
        r=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(r.status_code,400,r.data);self.assertFalse(Order.objects.exists())
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,400)

    def test_missing_recipe_blocks_placement_without_consuming_any_stock(self):
        self.product.ingredients.all().delete()
        r=self.client.post('/api/orders/place/',self.body,format='json')
        self.assertEqual(r.status_code,400,r.data);self.assertFalse(Order.objects.exists())
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,20)

    def test_quote_is_read_only_and_does_not_require_cooking_times(self):
        r=self.client.post('/api/orders/quote/',self.body,format='json')
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['ordering_mode'],'simple')
        self.assertIsNone(r.data['preparation_at']);self.assertFalse(InventoryLog.objects.exists())
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,400)

    def test_shortage_quote_and_placement_agree(self):
        self.early.quantity=0;self.early.save();self.later.quantity=0;self.later.save()
        for path in ['quote','place']:
            self.assertEqual(self.client.post(f'/api/orders/{path}/',self.body,format='json').status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_restocking_one_ingredient_does_not_cover_another_and_same_quote_rechecks_stock(self):
        chicken=RawMaterial.objects.create(name='Chicken boneless trimmed',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=chicken,quantity_required=50)
        for stage in ['quote','place']:
            response=self.client.post(f'/api/orders/{stage}/',self.body,format='json')
            self.assertEqual(response.status_code,400,response.data)
            self.assertEqual(response.data['code'],'ingredient_stock_shortage')
            self.assertIn('Chicken boneless trimmed',response.data['detail'])
            self.assertIn('150 g',response.data['detail'])
            self.assertIn('0 g',response.data['detail'])
        self.early.quantity+=500;self.early.save()
        still_short=self.client.post('/api/orders/quote/',self.body,format='json')
        self.assertEqual(still_short.status_code,400)
        self.assertIn('Chicken boneless trimmed',still_short.data['detail'])
        slots=self.client.post('/api/orders/slots/',{'date':self.delivery.date().isoformat()},format='json')
        self.assertEqual(slots.status_code,200,slots.data)
        self.assertIn('Chicken boneless trimmed',slots.data['unavailable_reason'])
        self.assertEqual(slots.data['unavailable_code'],'ingredient_stock_shortage')
        InventoryItem.objects.create(raw_material=chicken,quantity=200,received_date=timezone.localdate(),
            expiry_date=self.delivery.date()+timedelta(days=1),storage_location='Local test fridge')
        ready=self.client.post('/api/orders/quote/',self.body,format='json')
        self.assertEqual(ready.status_code,200,ready.data)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(IngredientConsumption.objects.exists())

    def test_one_response_lists_all_missing_ingredients_without_stock_writes(self):
        chicken=RawMaterial.objects.create(name='Chicken boneless trimmed',unit='g')
        salt=RawMaterial.objects.create(name='Salt',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=chicken,quantity_required=60)
        ProductIngredient.objects.create(product=self.product,raw_material=salt,quantity_required=5)
        for action in ('quote','place'):
            r=self.client.post(f'/api/orders/{action}/',self.body,format='json')
            self.assertEqual(r.status_code,400,r.data)
            self.assertEqual(r.data['shortage_count'],'2')
            rows={row['name']:row for row in r.data['shortages']}
            self.assertEqual(rows['Chicken boneless trimmed']['required'],'180')
            self.assertEqual(rows['Chicken boneless trimmed']['available'],'0')
            self.assertEqual(rows['Salt']['shortfall'],'15')
        self.assertFalse(Order.objects.exists());self.assertFalse(InventoryLog.objects.exists())
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,400)

    def test_explicit_sale_dates_and_delivery_hours_still_apply(self):
        self.product.delivery_dates=[(self.delivery+timedelta(days=1)).date().isoformat()];self.product.save()
        self.assertEqual(self.client.post('/api/orders/place/',self.body,format='json').status_code,400)
        self.product.delivery_dates=[];self.product.save()
        self.body['delivery_at']=self.delivery.replace(hour=23).isoformat()
        self.assertEqual(self.client.post('/api/orders/place/',self.body,format='json').status_code,400)

    def test_request_reference_is_required_and_cannot_be_taken_from_another_buyer(self):
        body={k:v for k,v in self.body.items() if k!='request_id'}
        self.assertEqual(self.client.post('/api/orders/place/',body,format='json').status_code,400)
        order=self.place();self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post('/api/orders/place/',self.body,format='json').status_code,400)
        self.assertEqual(Order.objects.count(),1)

    def test_stock_is_not_deducted_again_when_received_or_corrected(self):
        order=self.place();r=self.receipt(order);self.assertEqual(r.status_code,200,r.data)
        order.refresh_from_db();self.assertEqual(order.status,'delivered');self.assertEqual(order.payment_status,'unpaid')
        r=self.receipt(order,False);self.assertEqual(r.status_code,400)
        r=self.receipt(order,False,'Owner corrected mistaken handover');self.assertEqual(r.status_code,200,r.data)
        order.refresh_from_db();self.assertEqual(order.status,'pending')
        self.early.refresh_from_db();self.box.refresh_from_db()
        self.assertEqual(self.early.quantity,100);self.assertEqual(self.box.quantity,17)
        self.assertEqual(IngredientConsumption.objects.count(),1);self.assertEqual(OrderAmendment.objects.count(),2)

    def test_receipt_requires_staff_and_new_orders_cannot_use_old_progress_endpoint(self):
        order=self.place()
        body=dict(received=True,orders=[dict(id=order.pk,version=order.updated_at.isoformat())])
        self.assertIn(self.client.post('/api/admin/orders/receipts/',body,format='json').status_code,[401,403])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(f'/api/admin/orders/{order.pk}/',{'status':'cooked'},format='json').status_code,400)
        self.assertEqual(self.client.post('/api/admin/orders/progress/',{'status':'delivered','orders':body['orders']},format='json').status_code,400)

    def test_unreceived_cancellation_preserves_allocations_until_owner_confirms_unused(self):
        order=self.place();self.client.force_authenticate(self.owner)
        r=self.client.post(f'/api/admin/orders/{order.pk}/cancel/',dict(version=order.updated_at.isoformat(),reason='Customer cancelled'),format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,100)
        self.assertFalse(IngredientConsumption.objects.filter(returned_at__isnull=False).exists())

    def test_owner_confirmed_return_restores_exact_batches_and_packaging_once(self):
        order=self.place();self.client.force_authenticate(self.owner)
        body=dict(version=order.updated_at.isoformat(),reason='Not prepared; customer cancelled',return_unused_stock=True)
        for _ in range(2):
            r=self.client.post(f'/api/admin/orders/{order.pk}/cancel/',body,format='json');self.assertEqual(r.status_code,200,r.data)
        self.early.refresh_from_db();self.box.refresh_from_db();self.later.refresh_from_db()
        self.assertEqual(self.early.quantity,400);self.assertEqual(self.box.quantity,20);self.assertEqual(self.later.quantity,500)
        self.assertEqual(InventoryLog.objects.filter(change__gt=0).count(),1)
        self.assertEqual(PackagingMovement.objects.filter(kind='release').count(),1)

    def test_delivery_time_can_change_without_any_preparation_plan_or_second_deduction(self):
        order=self.place()
        body=dict(version=order.updated_at.isoformat(),reason='Customer agreed later time',delivery_at=self.delivery.replace(hour=11,minute=0).isoformat())
        r=self.client.patch(f'/api/orders/{order.pk}/delivery-time/',body,format='json')
        self.assertEqual(r.status_code,200,r.data)
        order.refresh_from_db();self.assertIsNone(order.preparation_at);self.assertEqual(order.delivery_at.hour,3)
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,100)
        self.assertEqual(self.client.patch(f'/api/orders/{order.pk}/delivery-time/',body,format='json').status_code,409)

    def test_time_change_cannot_exceed_allocated_batch_deadline_or_access_another_account(self):
        order=self.place();body=dict(version=order.updated_at.isoformat(),reason='Later date',delivery_at=(self.delivery+timedelta(days=15)).isoformat())
        self.assertEqual(self.client.patch(f'/api/orders/{order.pk}/delivery-time/',body,format='json').status_code,400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/orders/{order.pk}/delivery-time/').status_code,404)

    def test_slot_search_uses_stock_without_worker_hours_or_daily_preparation_cap(self):
        r=self.client.post('/api/orders/slots/',dict(date=self.delivery.date().isoformat(),find_next=True),format='json')
        self.assertEqual(r.status_code,200,r.data);self.assertTrue(r.data['slots'])
        self.assertTrue(all(row['preparation_at'] is None for row in r.data['slots']))

    def test_new_store_setup_has_no_cooking_steps_requirement_and_mode_is_not_client_editable(self):
        self.client.force_authenticate(self.owner)
        r=self.client.get('/api/admin/setup-checklist/');self.assertEqual(r.status_code,200,r.data)
        self.assertNotIn('preparation',[s['id'] for s in r.data['steps']])
        r=self.client.patch('/api/storefront/',{'ordering_mode':'scheduled'},format='json')
        self.assertEqual(r.status_code,200);self.store.refresh_from_db();self.assertEqual(self.store.ordering_mode,'simple')

    def test_existing_opted_in_accounts_can_receive_reminders_without_cooking_plans(self):
        from .services.reminders import customer_due, time_due
        from django.core import mail
        from .services.reminders import _send_customer_reminders
        self.buyer.email='customer@example.com';self.buyer.save()
        order=self.place()
        order.delivery_at=timezone.now()+timedelta(hours=1)
        order.fulfilment_snapshot=dict(order.fulfilment_snapshot,customer_reminder={
            'enabled':True,'email':self.buyer.email,'time_updates':True})
        order.save()
        self.assertIn(order.pk,customer_due().values_list('pk',flat=True))
        with self.settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            self.assertEqual(_send_customer_reminders(1),{'sent':1,'failed':0})
            self.assertEqual(len(mail.outbox),1)
            self.assertEqual(_send_customer_reminders(1),{'sent':0,'failed':0})
        order.refresh_from_db()
        result=self.client.patch(f'/api/orders/{order.pk}/delivery-time/',dict(
            version=order.updated_at.isoformat(),reason='Agreed update',delivery_at=self.delivery.isoformat()),format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertIn(order.pk,time_due().values_list('pk',flat=True))

    def test_placement_allocations_are_not_allocated_again_by_stock_planning(self):
        from .services.local_planning import local_plan
        from .services.kitchen_decisions import decision_support
        order=self.place()
        plan=local_plan()
        self.assertFalse(plan['batch_allocations'])
        self.assertIn({'order_id':order.pk,'reason':'inventory_already_deducted'},plan['excluded_orders'])
        result=decision_support(plan)
        menu=next(m for m in result['menus'] if m['product_id']==self.product.pk)
        self.assertEqual(menu['future_committed_portions'],3)
        self.early.refresh_from_db();self.assertEqual(self.early.quantity,100)

    def test_generated_history_cannot_be_rewritten_as_customer_receipt(self):
        order=self.place()
        order.payment_instructions={'freshcast_synthetic_history':{'version':'1'}};order.save()
        result=self.receipt(order)
        self.assertEqual(result.status_code,400,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'pending')

    def test_catalogue_refresh_order_can_be_received_corrected_and_cancelled(self):
        from .models import PaymentEvent
        from .services.demo_provenance import synthetic_history,generated_sales_summary
        order=self.place()
        order.payment_instructions={'catalogue_refresh_sample':{'version':'1','operation_id':'wrap_bowl_operations_v1'}}
        order.save()
        self.assertTrue(synthetic_history(order));self.assertFalse(generated_sales_summary(order))
        stock=list(InventoryItem.objects.values());packaging=list(PackagingItem.objects.values())
        payments=list(PaymentEvent.objects.values())
        self.assertEqual(self.receipt(order).status_code,200)
        order.refresh_from_db();self.assertEqual(order.status,'delivered');self.assertEqual(order.payment_status,'unpaid')
        self.assertEqual(self.receipt(order,False).status_code,400)
        result=self.receipt(order,False,'Customer has not collected it yet')
        self.assertEqual(result.status_code,200,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'pending')
        self.assertEqual(list(InventoryItem.objects.values()),stock)
        self.assertEqual(list(PackagingItem.objects.values()),packaging)
        self.assertEqual(list(PaymentEvent.objects.values()),payments)
        result=self.client.post(f'/api/admin/orders/{order.pk}/cancel/',dict(
            version=order.updated_at.isoformat(),reason='Customer cancelled',return_unused_stock=False),format='json')
        self.assertEqual(result.status_code,200,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'cancelled')
        self.assertEqual(list(InventoryItem.objects.values()),stock)
        self.assertEqual(list(PaymentEvent.objects.values()),payments)

    def test_forecast_summary_still_cannot_be_cancelled(self):
        order=self.place()
        order.payment_instructions={'freshcast_synthetic_history':{'version':'1'}};order.save()
        self.client.force_authenticate(self.owner)
        result=self.client.post(f'/api/admin/orders/{order.pk}/cancel/',dict(
            version=order.updated_at.isoformat(),reason='Not an individual order'),format='json')
        self.assertEqual(result.status_code,400,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'pending')

    def test_customer_cancellation_preserves_stock_payment_and_history_once(self):
        from .models import PaymentEvent
        order=self.place();order.payment_status='paid';order.save()
        event=PaymentEvent.objects.create(order=order,request_id=uuid.uuid4(),kind='receipt',
            outcome='completed',amount=order.total_amount+order.shipping_fee,method='manual',
            reference='Local paid-order fixture',source='owner_verified',actor=self.owner)
        before=(self.early.quantity, self.box.quantity)
        self.early.refresh_from_db();self.box.refresh_from_db();before=(self.early.quantity,self.box.quantity)
        body=dict(version=order.updated_at.isoformat(),reason='My plans changed')
        for _ in range(2):
            result=self.client.post(f'/api/orders/{order.pk}/cancel/',body,format='json')
            self.assertEqual(result.status_code,200,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'cancelled');self.assertEqual(order.payment_status,'paid')
        self.assertIsNone(order.stock_returned_at)
        self.assertEqual(OrderAmendment.objects.filter(order=order,after__cancelled_by='customer').count(),1)
        self.assertEqual(PaymentEvent.objects.get(pk=event.pk).kind,'receipt');self.assertEqual(PaymentEvent.objects.count(),1)
        self.early.refresh_from_db();self.box.refresh_from_db();self.assertEqual((self.early.quantity,self.box.quantity),before)
        self.assertFalse(IngredientConsumption.objects.filter(returned_at__isnull=False).exists())

    def test_customer_cancellation_is_scoped_and_rejects_stock_or_status_overrides(self):
        order=self.place();body=dict(version=order.updated_at.isoformat())
        for extra in [dict(return_unused_stock=True),dict(status='delivered'),dict(payment_status='refunded')]:
            result=self.client.post(f'/api/orders/{order.pk}/cancel/',{**body,**extra},format='json')
            self.assertEqual(result.status_code,400,result.data)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/cancel/',body,format='json').status_code,404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.post(f'/api/orders/{order.pk}/cancel/',body,format='json').status_code,[401,403])
        order.refresh_from_db();self.assertEqual(order.status,'pending')

    def test_customer_cancellation_blocks_received_progress_and_stale_versions(self):
        order=self.place();body=dict(version=order.updated_at.isoformat())
        order.save()
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/cancel/',body,format='json').status_code,409)
        for status in ['delivered','cooked','shipped']:
            order.status=status;order.save();body['version']=order.updated_at.isoformat()
            result=self.client.post(f'/api/orders/{order.pk}/cancel/',body,format='json')
            self.assertEqual(result.status_code,400,result.data)
            order.refresh_from_db();self.assertEqual(order.status,status)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_customer_cancellation_requires_session_csrf(self):
        from django.test import Client
        order=self.place();browser=Client(enforce_csrf_checks=True);browser.force_login(self.buyer)
        result=browser.post(f'/api/orders/{order.pk}/cancel/',
            dict(version=order.updated_at.isoformat()),content_type='application/json')
        self.assertEqual(result.status_code,403)
        order.refresh_from_db();self.assertEqual(order.status,'pending')

    def test_owner_can_confirm_unused_stock_after_customer_cancellation_once(self):
        order=self.place()
        result=self.client.post(f'/api/orders/{order.pk}/cancel/',dict(version=order.updated_at.isoformat()),format='json')
        self.assertEqual(result.status_code,200,result.data)
        order.refresh_from_db();self.client.force_authenticate(self.owner)
        body=dict(version=order.updated_at.isoformat(),reason='Confirmed not prepared or packed',return_unused_stock=True)
        for _ in range(2):
            result=self.client.post(f'/api/admin/orders/{order.pk}/cancel/',body,format='json')
            self.assertEqual(result.status_code,200,result.data)
        order.refresh_from_db();self.assertEqual(order.status,'cancelled');self.assertIsNotNone(order.stock_returned_at)
        self.early.refresh_from_db();self.box.refresh_from_db();self.assertEqual(self.early.quantity,400);self.assertEqual(self.box.quantity,20)
        self.assertEqual(InventoryLog.objects.filter(change__gt=0).count(),1)
        self.assertEqual(PackagingMovement.objects.filter(kind='release').count(),1)
        self.assertEqual(OrderAmendment.objects.filter(after__change_type='stock_return_after_cancellation').count(),1)

    def test_time_policy_explains_actual_reserved_deadline_and_rechecks_changes(self):
        order=self.place();url=f'/api/orders/{order.pk}/delivery-time/'
        policy=self.client.get(url);self.assertEqual(policy.status_code,200,policy.data)
        self.assertEqual(policy.data['stock_latest_date'],self.early.expiry_date.isoformat())
        self.assertTrue(policy.data['eligible']);self.assertEqual(policy.data['opening_time'],'07:30')
        original=order.delivery_at
        beyond=timezone.make_aware(timezone.datetime.combine(self.early.expiry_date+timedelta(days=1),timezone.datetime.min.time())).replace(hour=10)
        body=dict(version=order.updated_at.isoformat(),reason='Later date',delivery_at=beyond.isoformat())
        response=self.client.patch(url,body,format='json');self.assertEqual(response.status_code,400,response.data)
        self.assertIn(self.early.expiry_date.strftime('%d %b %Y'),str(response.data))
        order.refresh_from_db();self.assertEqual(order.delivery_at,original)
        self.early.quarantined=True;self.early.save()
        self.assertFalse(self.client.get(url).data['eligible'])
        body['delivery_at']=self.delivery.replace(hour=11).isoformat()
        self.assertEqual(self.client.patch(url,body,format='json').status_code,400)

    def test_time_policy_closes_for_received_cancelled_and_past_agreed_times(self):
        order=self.place();url=f'/api/orders/{order.pk}/delivery-time/'
        for status in ['delivered','cancelled']:
            order.status=status;order.save();self.assertFalse(self.client.get(url).data['eligible'])
        order.status='pending';order.delivery_at=timezone.now()-timedelta(hours=1);order.save()
        policy=self.client.get(url).data;self.assertFalse(policy['eligible']);self.assertIn('passed',policy['reason'])
