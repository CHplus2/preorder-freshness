"""Owner-run stock receipts on actual PostgreSQL; no production fixtures."""
import json
from datetime import timedelta
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection,connections,transaction,DatabaseError
from django.test import TransactionTestCase
from django.utils import timezone
from .models import (Storefront,RawMaterial,Product,ProductIngredient,InventoryItem,InventoryLog,
    PackagingItem,ProductPackaging,PackagingMovement,Order,PaymentEvent)

ROOT=Path(__file__).resolve().parents[2]


@skipUnless(connection.vendor=='postgresql','Actual PostgreSQL receipt script required')
class RecipeStockReceiptTests(TransactionTestCase):
    def setUp(self):
        Storefront.objects.create(pk=1)
        self.today=timezone.localdate();self.deadline=self.today+timedelta(days=30)
        self.chicken=RawMaterial.objects.create(name='Chicken boneless trimmed',unit='g')
        self.rice=RawMaterial.objects.create(name='Rice',unit='g')
        self.meal=Product.objects.create(name='Chicken rice',price=12)
        self.other=Product.objects.create(name='Second chicken meal',price=10)
        ProductIngredient.objects.create(product=self.meal,raw_material=self.chicken,quantity_required=60)
        ProductIngredient.objects.create(product=self.other,raw_material=self.chicken,quantity_required=30)
        ProductIngredient.objects.create(product=self.meal,raw_material=self.rice,quantity_required=100)
        self.draft=Product.objects.create(name='Recipe incomplete',price=10)
        self.box=PackagingItem.objects.create(name='Meal container',quantity=5)
        ProductPackaging.objects.create(product=self.meal,packaging_item=self.box,quantity_per_item=1)
        ProductPackaging.objects.create(product=self.other,packaging_item=self.box,quantity_per_item=1)
        self.inactive=PackagingItem.objects.create(name='Not offered',quantity=50,is_active=False)
        ProductPackaging.objects.create(product=self.draft,packaging_item=self.inactive,quantity_per_item=1)
        self.lot(self.chicken,100,self.deadline,'Fridge A - Bottom shelf')
        self.lot(self.chicken,400,self.deadline,'Fridge A - Hold box',quarantined=True)
        self.lot(self.chicken,200,self.today-timedelta(days=1),'Fridge A - Old stock',received=self.today-timedelta(days=7))
        self.lot(self.rice,300,self.deadline,'Pantry A - Dry shelf',storage_type='ambient')
        with connection.cursor() as q:
            q.execute('SELECT current_schema()');self.schema=connection.ops.quote_name(q.fetchone()[0])
        self.sql=(ROOT/'deploy/sql/receive_recipe_stock_20261104.sql').read_text().replace('django_app.',self.schema+'.')
        self.sql=self.sql.replace("v_received date := DATE '2026-11-04'",f"v_received date := DATE '{self.today}'")
        self.sql=self.sql.replace("v_deadline date := DATE '2027-01-31'",f"v_deadline date := DATE '{self.deadline}'")
        self.initial=list(InventoryItem.objects.values())

    def lot(self,raw,qty,deadline,location,received=None,**changes):
        return InventoryItem.objects.create(raw_material=raw,quantity=qty,received_date=received or self.today,
            expiry_date=deadline,storage_location=location,batch_code='Owner-reference',**changes)

    def run_sql(self,sql=None):
        with connection.cursor() as q:
            q.execute(sql or self.sql);payload=q.fetchone()[0]
        return json.loads(payload) if isinstance(payload,str) else payload

    def test_receipt_adds_only_deficits_and_preserves_existing_records_and_unknown_costs(self):
        result=self.run_sql()
        self.assertEqual(result['status'],'recorded')
        self.assertEqual(result['ingredient_batches_added'],2)
        received={r['ingredient']:r for r in result['ingredients']}
        self.assertEqual(received[self.chicken.name]['received_quantity'],800)
        self.assertEqual(received['Rice']['received_quantity'],700)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,20)
        self.assertEqual(result['packaging_receipts_added'],1)
        self.assertEqual([r['id'] for r in result['menus_needing_recipe_review']],[self.draft.pk])
        self.assertEqual([r['id'] for r in result['inactive_packaging_needing_review']],[self.inactive.pk])
        self.assertEqual(self.initial,list(InventoryItem.objects.filter(pk__in=[r['id'] for r in self.initial]).values()))
        self.assertEqual(InventoryLog.objects.count(),2)
        self.assertEqual(PackagingMovement.objects.get().change,15)
        for row in result['ingredients']:
            batch=InventoryItem.objects.get(pk=row['batch_id'])
            self.assertEqual(batch.expiry_date,self.deadline);self.assertEqual(batch.received_date,self.today)
            self.assertIsNone(batch.unit_cost);self.assertIsNone(batch.original_expiry_date)
            self.assertEqual(batch.expiry_basis,'storage');self.assertIn('not verified',batch.guidance_note)
            self.assertNotIn('DEMO',batch.batch_code);self.assertNotIn('demo',batch.storage_location)
        self.assertFalse(Order.objects.exists());self.assertFalse(PaymentEvent.objects.exists())

    def test_repeat_after_consumption_never_refills_or_creates_duplicate_receipts(self):
        first=self.run_sql();batch=InventoryItem.objects.get(pk=first['ingredients'][0]['batch_id'])
        batch.quantity-=10;batch.save();self.box.quantity=1;self.box.save()
        result=self.run_sql();self.assertEqual(result['status'],'already_recorded')
        batch.refresh_from_db();self.assertEqual(batch.quantity,790)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,1)
        self.assertEqual(InventoryLog.objects.count(),2);self.assertEqual(PackagingMovement.objects.count(),1)

    def test_same_reference_with_other_settings_is_rejected(self):
        self.run_sql();before=list(InventoryItem.objects.values())
        with self.assertRaises(DatabaseError):
            with transaction.atomic():self.run_sql(self.sql.replace('v_units integer := 10','v_units integer := 11'))
        self.assertEqual(before,list(InventoryItem.objects.values()))

    def test_unknown_storage_rolls_back_prior_receipt_rows_and_all_packaging(self):
        InventoryItem.objects.filter(raw_material=self.rice).delete()
        with self.assertRaises(DatabaseError):
            with transaction.atomic():self.run_sql()
        self.assertEqual(InventoryLog.objects.count(),0)
        self.assertEqual(InventoryItem.objects.filter(raw_material=self.chicken).count(),3)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,5)

    def test_new_deadline_does_not_count_stock_that_expires_before_it(self):
        InventoryItem.objects.filter(raw_material=self.rice).update(expiry_date=self.deadline-timedelta(days=1))
        result=self.run_sql();row=next(r for r in result['ingredients'] if r['ingredient']=='Rice')
        self.assertEqual(row['received_quantity'],1000)
        self.assertEqual(row['previous_eligible'],0)

    def test_expired_plan_is_rejected_before_any_receipt(self):
        text=self.sql.replace(f"v_deadline date := DATE '{self.deadline}'",f"v_deadline date := DATE '{self.today-timedelta(days=1)}'")
        with self.assertRaises(DatabaseError):
            with transaction.atomic():self.run_sql(text)
        self.assertEqual(InventoryLog.objects.count(),0);self.assertEqual(PackagingMovement.objects.count(),0)

    def test_packaging_only_receipt_is_repeat_safe(self):
        InventoryItem.objects.filter(raw_material=self.chicken,quarantined=False,expiry_date=self.deadline).update(quantity=1000)
        InventoryItem.objects.filter(raw_material=self.rice).update(quantity=1000)
        first=self.run_sql();self.assertEqual(first['ingredient_batches_added'],0)
        self.assertEqual(first['packaging_receipts_added'],1)
        self.assertEqual(self.run_sql()['status'],'already_recorded')
        self.assertEqual(PackagingMovement.objects.count(),1)

    def test_zero_shortfall_review_does_not_turn_into_refill_after_consumption(self):
        InventoryItem.objects.filter(raw_material=self.chicken,quarantined=False,expiry_date=self.deadline).update(quantity=1000)
        InventoryItem.objects.filter(raw_material=self.rice).update(quantity=1000)
        self.box.quantity=20;self.box.save()
        first=self.run_sql();self.assertEqual(first['status'],'nothing_to_receive')
        self.assertEqual(InventoryLog.objects.get().change,0)
        InventoryItem.objects.filter(raw_material=self.rice).update(quantity=100)
        self.box.quantity=1;self.box.save()
        self.assertEqual(self.run_sql()['status'],'already_recorded')
        self.assertEqual(InventoryItem.objects.get(raw_material=self.rice).quantity,100)
        self.box.refresh_from_db();self.assertEqual(self.box.quantity,1)

    def test_following_rls_statement_has_no_pending_trigger_error(self):
        with transaction.atomic():
            self.run_sql()
            with connection.cursor() as q:q.execute(f'ALTER TABLE {self.schema}.myapp_inventorylog ENABLE ROW LEVEL SECURITY')
            transaction.set_rollback(True)
        self.assertFalse(InventoryLog.objects.exists())

    def test_competing_receipt_calls_record_one_receipt(self):
        barrier=Barrier(2)
        def run(_):
            try:
                barrier.wait(timeout=10)
                with connections['default'].cursor() as q:
                    q.execute(self.sql);result=q.fetchone()[0]
                return (json.loads(result) if isinstance(result,str) else result)['status']
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(run,range(2)))
        self.assertCountEqual(statuses,['recorded','already_recorded'])
        self.assertEqual(InventoryLog.objects.count(),2);self.assertEqual(PackagingMovement.objects.count(),1)
