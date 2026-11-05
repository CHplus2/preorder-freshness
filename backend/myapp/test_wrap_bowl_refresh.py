"""Actual PostgreSQL reconciliation of owner-confirmed fictional operational data."""
import json,importlib.util,uuid
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from unittest import skipUnless
from django.db import connection,transaction,DatabaseError
from django.test import TransactionTestCase,SimpleTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Storefront,Category,Product,RawMaterial,ProductIngredient,InventoryItem,InventoryLog,
 Order,OrderItem,OrderIngredient,IngredientConsumption,PackagingItem,ProductPackaging,OrderPackaging,
 PackagingMovement,PaymentEvent,OrderAmendment,CustomerAccount,CartItem)
ROOT=Path(__file__).resolve().parents[2]

class RefreshSourceTests(SimpleTestCase):
 def test_committed_refresh_sql_matches_reviewed_data(self):
  spec=importlib.util.spec_from_file_location('wb_refresh_builder',ROOT/'deploy/build_wrap_bowl_catalogue.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertEqual(m.build_refresh(),(ROOT/'deploy/sql/refresh_wrap_bowl_operations.sql').read_text())
 def test_sample_provenance_is_recognised_without_changing_the_frozen_models(self):
  from types import SimpleNamespace
  from .services.demo_provenance import synthetic_history
  self.assertTrue(synthetic_history(SimpleNamespace(payment_instructions={'catalogue_refresh_sample':{'version':'1'}})))
  self.assertFalse(synthetic_history(SimpleNamespace(payment_instructions={})))

@skipUnless(connection.vendor=='postgresql','Full operational SQL refresh requires PostgreSQL')
class WrapBowlRefreshTests(TransactionTestCase):
 def setUp(self):
  self.owner=User.objects.create_user('wb-stock-owner',is_staff=True)
  self.buyer=User.objects.create_user('wb-stock-buyer');CustomerAccount.objects.create(user=self.buyer,name='Local buyer',phone='+60123456789')
  self.store=Storefront.objects.create(pk=1,delivery_areas=['Kuala Lumpur'],delivery_area_fees={'Kuala Lumpur':'10.00'},manual_payment_enabled=True,bank_transfer_instructions='Saved receiving instructions',duitnow_qr_url='https://example.com/qr.png',pickup_enabled=True,pickup_location='Old location')
  self.oldraw=RawMaterial.objects.create(name='Earlier flour',unit='g');self.oldcat=Category.objects.create(name='Earlier bakes')
  self.old=Product.objects.create(name='Earlier cake',price=12,category=self.oldcat);ProductIngredient.objects.create(product=self.old,raw_material=self.oldraw,quantity_required=80)
  self.oldbatch=InventoryItem.objects.create(raw_material=self.oldraw,quantity=1000,received_date=timezone.localdate(),expiry_date=timezone.localdate()+timedelta(days=7),storage_location='Old shelf')
  InventoryLog.objects.create(inventory_item=self.oldbatch,change=1000,reason='Original receipt',reference='Earlier receipt')
  self.box=PackagingItem.objects.create(name='Earlier box',quantity=90);ProductPackaging.objects.create(product=self.old,packaging_item=self.box,quantity_per_item=1)
  self.orders=[]
  for n,method in enumerate(['paypal','wallet','manual','cod','paypal']):
   o=Order.objects.create(user=self.buyer,total_amount=12,payment_method=method,payment_status='paid',status='delivered' if n!=2 else 'cancelled',delivery_method='pickup' if n==0 else 'express',delivery_at=None)
   OrderItem.objects.create(order=o,product=self.old,product_name=self.old.name,unit_price=12,subtotal=12,quantity=1)
   PaymentEvent.objects.create(order=o,request_id=uuid.uuid4(),kind='receipt',outcome='completed',amount=12,method=method,reference='Original provider reference')
   self.orders.append(o)
  with connection.cursor() as q:q.execute('SELECT current_schema()');self.schema=connection.ops.quote_name(q.fetchone()[0])
  self.run_sql('apply_wrap_bowl_catalogue.sql')
 def run_sql(self,name='refresh_wrap_bowl_operations.sql',sql_override=None):
  with connection.cursor() as q:
   sql=(sql_override or (ROOT/'deploy/sql'/name).read_text()).replace('django_app.',self.schema+'.')
   q.execute(sql);value=q.fetchone()[0]
  return json.loads(value) if isinstance(value,str) else value
 def test_refresh_removes_old_types_and_rebuilds_current_history_allocations_and_stock(self):
  result=self.run_sql();self.assertEqual(result['status'],'refreshed')
  self.assertEqual(Product.objects.count(),8);self.assertEqual(Category.objects.count(),3);self.assertEqual(RawMaterial.objects.count(),25);self.assertEqual(PackagingItem.objects.count(),9)
  self.assertFalse(InventoryItem.objects.filter(raw_material__name='Earlier flour').exists());self.assertFalse(Product.objects.filter(pk=self.old.pk).exists())
  self.assertEqual(Order.objects.count(),5);self.assertEqual(OrderAmendment.objects.count(),5)
  archive=OrderAmendment.objects.get(order=self.orders[0]);self.assertEqual(archive.before['order']['payment_method'],'paypal')
  self.assertEqual(archive.before['items'][0]['product_name'],'Earlier cake');self.assertEqual(Decimal(str(archive.before['operational_backup']['batches'][0]['quantity'])),1000)
  self.store.refresh_from_db();self.assertEqual(self.store.bank_transfer_instructions,'Saved receiving instructions');self.assertEqual(self.store.duitnow_qr_url,'https://example.com/qr.png')
  self.assertNotIn('Kuala Lumpur',self.store.delivery_areas);self.assertEqual(self.store.delivery_area_fees['Petra Jaya'],'8.00');self.assertIsNone(self.store.free_delivery_minimum_myr)
  for o in Order.objects.prefetch_related('items'):
   self.assertIn(o.payment_method,['manual','cod']);self.assertEqual(o.ordering_mode,'simple');self.assertIsNone(o.preparation_at)
   local=timezone.localtime(o.delivery_at);self.assertGreaterEqual((local.hour,local.minute),(7,30));self.assertLessEqual((local.hour,local.minute),(11,0))
   self.assertIn(o.status,['pending','delivered','cancelled']);self.assertEqual(o.fulfilment_snapshot['customer_reminder']['enabled'],False)
   self.assertTrue(o.items.exists());self.assertLess(o.created_at,o.delivery_at)
   if o.delivery_method=='pickup':self.assertEqual(o.payment_method,'manual');self.assertEqual(o.shipping_fee,0)
   else:self.assertIn(o.fulfilment_snapshot['delivery_area'],self.store.delivery_areas)
   for item in o.items.all():
    self.assertEqual(item.product_name,item.product.name);self.assertEqual(item.unit_price,item.product.price)
    self.assertEqual(item.accepted_ingredients.count(),item.product.ingredients.count())
    self.assertEqual(item.accepted_packaging.count(),item.product.packaging_requirements.count())
    if item.product.name=='Sukiya Beef Rice Bowl':self.assertEqual(local.weekday(),0)
   if o.status!='cancelled':self.assertTrue(o.inventory_deducted);self.assertTrue(IngredientConsumption.objects.filter(order_item__order=o).exists())
  for raw in RawMaterial.objects.all():
   target=sum(row.quantity_required for row in raw.product_ingredients.all())*10
   self.assertEqual(sum(b.quantity for b in raw.inventory_items.all()),target)
   for batch in raw.inventory_items.all():
    self.assertRegex(batch.batch_code,r'^[A-Z]{3}-\d{8}-\d{3,}$')
    self.assertEqual(sum(row.change for row in batch.logs.all()),batch.quantity)
  for pack in PackagingItem.objects.all():
   self.assertEqual(pack.quantity,sum(r.quantity_per_item for r in pack.menu_requirements.all())*10)
   self.assertEqual(sum(row.change for row in pack.movements.all()),pack.quantity)
  refunded=Order.objects.get(pk=self.orders[2].pk)
  self.assertEqual(refunded.payment_status,'refunded');self.assertEqual(refunded.payment_events.count(),2)
 def test_repeat_never_refills_consumed_stock_or_rewrites_later_orders(self):
  self.run_sql();batch=InventoryItem.objects.filter(quantity__gt=0).first();batch.quantity-=Decimal('.1');batch.save()
  changed=list(Order.objects.values());self.assertEqual(self.run_sql()['status'],'already_applied')
  batch.refresh_from_db();self.assertEqual(list(Order.objects.values()),changed)
  self.assertEqual(OrderAmendment.objects.count(),5)
 def test_refreshed_upcoming_orders_accept_bulk_receipt_without_stock_or_payment_changes(self):
  self.run_sql();client=APIClient();client.force_authenticate(self.owner)
  upcoming=list(Order.objects.filter(status='pending').order_by('id'))
  self.assertEqual(len(upcoming),2)
  batches=list(InventoryItem.objects.values());packs=list(PackagingItem.objects.values());payments=list(PaymentEvent.objects.values())
  result=client.post('/api/admin/orders/receipts/',dict(received=True,orders=[
   dict(id=o.pk,version=o.updated_at.isoformat()) for o in upcoming]),format='json')
  self.assertEqual(result.status_code,200,result.data)
  self.assertEqual(Order.objects.count(),5)
  for o in upcoming:
   o.refresh_from_db();self.assertEqual(o.status,'delivered');self.assertEqual(o.payment_status,'unpaid')
  self.assertEqual(list(InventoryItem.objects.values()),batches);self.assertEqual(list(PackagingItem.objects.values()),packs)
  self.assertEqual(list(PaymentEvent.objects.values()),payments)
 def test_incomplete_catalogue_aborts_without_taking_a_backup_or_deleting_history(self):
  Product.objects.get(name='Chicken Grilled Salad').ingredients.all().delete()
  with self.assertRaises(DatabaseError):
   with transaction.atomic():self.run_sql()
  self.assertTrue(RawMaterial.objects.filter(pk=self.oldraw.pk).exists());self.assertEqual(Order.objects.count(),5);self.assertFalse(OrderAmendment.objects.exists())
 def test_stock_check_and_checkout_use_the_reconciled_remaining_stock(self):
  self.run_sql();client=APIClient();client.force_authenticate(self.owner)
  day=timezone.localdate()+timedelta(days=1)
  while day.weekday()>4:day+=timedelta(days=1)
  response=client.get('/api/admin/stock-readiness/',{'date':day.isoformat(),'quantity':10});self.assertEqual(response.status_code,200,response.data);self.assertEqual(response.data['state'],'covered')
  client.force_authenticate(self.buyer);p=Product.objects.get(name='Chicken Grilled Salad');CartItem.objects.create(user=self.buyer,product=p,quantity=1)
  data=dict(delivery_at=day.isoformat()+'T08:00:00+08:00',delivery_method='standard',delivery_area='Petra Jaya',arrival_window_minutes=0)
  quote=client.post('/api/orders/quote/',data,format='json');self.assertEqual(quote.status_code,200,quote.data);self.assertEqual(quote.data['pricing']['total'],'21.00')
  data.update(payment='cod',expected_total='21.00',request_id=str(uuid.uuid4()),customer={'name':'Local buyer','phone':'0123456789'},delivery_address={'line1':'Local address, Kuching'})
  placed=client.post('/api/orders/place/',data,format='json');self.assertEqual(placed.status_code,201,placed.data)
  before=list(InventoryItem.objects.values());self.assertEqual(self.run_sql()['status'],'already_applied');self.assertEqual(before,list(InventoryItem.objects.values()))
  self.assertTrue(Order.objects.filter(pk=placed.data['order_id'],payment_method='cod',payment_status='unpaid').exists())

 def test_late_failure_rolls_back_removed_stock_backups_and_rewritten_payments(self):
  with connection.cursor() as q:
   q.execute("ALTER TABLE "+self.schema+".myapp_storefront ADD CONSTRAINT wb_refresh_test_rollback CHECK (delivery_areas='[\"Kuala Lumpur\"]'::jsonb)")
  try:
   with self.assertRaises(DatabaseError):
    with transaction.atomic():self.run_sql()
  finally:
   with connection.cursor() as q:q.execute('ALTER TABLE '+self.schema+'.myapp_storefront DROP CONSTRAINT wb_refresh_test_rollback')
  self.assertFalse(OrderAmendment.objects.exists());self.assertTrue(InventoryItem.objects.filter(pk=self.oldbatch.pk,quantity=1000).exists())
  self.assertEqual(Order.objects.get(pk=self.orders[0].pk).payment_method,'paypal')
  self.assertEqual(PaymentEvent.objects.filter(reference='Original provider reference').count(),5)

 def test_original_receipt_bytes_are_retained_private_and_not_reused_as_new_evidence(self):
  from .models import CheckoutProof
  proof=CheckoutProof.objects.create(user=self.buyer,order=self.orders[0],content=b'local original receipt',digest='a'*64,scope_digest='b'*64,amount=12)
  self.run_sql();proof.refresh_from_db();self.assertIsNone(proof.order_id);self.assertEqual(bytes(proof.content),b'local original receipt');self.assertEqual(proof.amount,12)
  archive=OrderAmendment.objects.get(order=self.orders[0]);self.assertEqual(archive.before['proof_metadata'][0]['id'],str(proof.pk));self.assertNotIn('content',archive.before['proof_metadata'][0])
  other=APIClient();other.force_authenticate(User.objects.create_user('unrelated-refresh-buyer'))
  self.assertIn(other.get('/api/checkout-proofs/'+str(proof.pk)+'/').status_code,(403,404))

 def test_empty_order_and_oversized_old_lines_become_bounded_current_orders(self):
  empty=Order.objects.create(user=self.buyer,payment_method='paypal',status='delivered')
  for n in range(5):OrderItem.objects.create(order=self.orders[0],product=self.old,product_name='Earlier cake',unit_price=12,quantity=100,subtotal=1200)
  self.run_sql();self.assertEqual(empty.items.count(),1);self.assertEqual(self.orders[0].items.count(),3)
  self.assertTrue(all(i.quantity<=10 for i in self.orders[0].items.all()))
  self.assertFalse(InventoryItem.objects.filter(quantity__lt=0).exists());self.assertFalse(PackagingItem.objects.filter(quantity__lt=0).exists())

 def test_unreviewed_configuration_stops_before_any_operational_changes(self):
  draft=(ROOT/'deploy/sql/refresh_wrap_bowl_operations.sql').read_text().replace('"validated_for_apply":true','"validated_for_apply":false')
  with self.assertRaises(DatabaseError):
   with transaction.atomic():self.run_sql(sql_override=draft)
  self.assertTrue(InventoryItem.objects.filter(pk=self.oldbatch.pk).exists());self.assertFalse(OrderAmendment.objects.exists())
