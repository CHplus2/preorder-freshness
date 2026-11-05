"""Reference-correction rehearsal: requires an isolated PostgreSQL database."""
import json
from datetime import timedelta
from pathlib import Path
from unittest import skipUnless
from django.db import connection,transaction
from django.test import TransactionTestCase
from django.utils import timezone
from .models import RawMaterial,InventoryItem,InventoryLog

ROOT=Path(__file__).resolve().parents[2]

@skipUnless(connection.vendor=='postgresql','PostgreSQL reference-script rehearsal required')
class SampleReferenceScriptTests(TransactionTestCase):
    def setUp(self):
        self.raw=RawMaterial.objects.create(name='Rice',unit='g');self.day=timezone.localdate()
        self.sample=self.lot('DEMO-FC-INV-3-NEAR')
        self.supplier=self.lot('Supplier-A')
        with connection.cursor() as q:q.execute('SELECT current_schema()');schema=connection.ops.quote_name(q.fetchone()[0])
        def load(name):return (ROOT/'deploy/sql'/name).read_text().replace('django_app.',schema+'.')
        self.preview=load('preview_sample_batch_references.sql');self.apply=load('standardize_sample_batch_references.sql')

    def lot(self,code):
        return InventoryItem.objects.create(raw_material=self.raw,quantity='123.456',batch_code=code,
            received_date=self.day,expiry_date=self.day+timedelta(days=2),quarantined=True,
            storage_location='Pantry shelf',unit_cost='.012')

    def run_sql(self,text):
        with connection.cursor() as q:
            q.execute(text)
            return [tuple(json.loads(value) if isinstance(value,str) and value.startswith(('[','{')) else value for value in row) for row in q.fetchall()]

    def test_preview_does_not_mutate_any_row_or_audit_log(self):
        before=list(InventoryItem.objects.values());rows=self.run_sql(self.preview)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0][1],self.sample.batch_code)
        self.assertEqual(before,list(InventoryItem.objects.values()));self.assertFalse(InventoryLog.objects.exists())

    def test_correction_preserves_stock_facts_and_original_reference_in_zero_change_log(self):
        before=InventoryItem.objects.values().get(pk=self.sample.pk)
        rows=self.run_sql(self.apply);self.assertEqual(rows[0][0],1)
        after=InventoryItem.objects.values().get(pk=self.sample.pk)
        for key in before.keys()-{'batch_code','updated_at'}:self.assertEqual(before[key],after[key],key)
        self.assertEqual(after['batch_code'],f'RCE-{self.day:%Y%m%d}-{self.sample.pk:03d}')
        event=InventoryLog.objects.get(inventory_item=self.sample);self.assertEqual(event.change,0)
        self.assertIn(before['batch_code'],event.reason);self.assertIn(after['batch_code'],event.reason)
        self.supplier.refresh_from_db();self.assertEqual(self.supplier.batch_code,'Supplier-A')

    def test_repetition_is_noop_and_destination_conflicts_are_reported_without_overwrite(self):
        target=f'RCE-{self.day:%Y%m%d}-{self.sample.pk:03d}'
        conflict=self.lot(target.lower())
        rows=self.run_sql(self.apply);self.assertEqual(rows[0][0],0);self.assertEqual(len(rows[0][2]),1)
        self.sample.refresh_from_db();self.assertEqual(self.sample.batch_code,'DEMO-FC-INV-3-NEAR')
        conflict.delete();self.assertEqual(self.run_sql(self.apply)[0][0],1)
        self.assertEqual(self.run_sql(self.apply)[0][0],0);self.assertEqual(InventoryLog.objects.count(),1)

    def test_freshcast_pattern_is_corrected_but_similar_supplier_references_are_untouched(self):
        row=self.lot('FRESHCAST-DEMO-2026-10-10-3');other=self.lot('DEMO-FC-INV-3-NEAR-supplier')
        self.assertEqual(self.run_sql(self.apply)[0][0],2)
        row.refresh_from_db();other.refresh_from_db()
        self.assertEqual(row.batch_code,f'RCE-{self.day:%Y%m%d}-{row.pk:03d}')
        self.assertEqual(other.batch_code,'DEMO-FC-INV-3-NEAR-supplier')

    def test_a_following_rls_statement_has_no_pending_fk_trigger_events(self):
        table=connection.ops.quote_name('myapp_inventorylog')
        with transaction.atomic():
            self.run_sql(self.apply)
            with connection.cursor() as q:
                q.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
                q.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
        self.assertEqual(InventoryLog.objects.count(),1)
