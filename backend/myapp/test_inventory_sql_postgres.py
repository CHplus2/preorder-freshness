"""Reproduce deferred audit FK / following RLS alteration on real PostgreSQL."""
from pathlib import Path
from datetime import timedelta
from unittest import skipUnless
from django.db import connection,transaction,DatabaseError
from django.test import TransactionTestCase
from django.utils import timezone
from .models import RawMaterial,InventoryItem,InventoryLog

ROOT=Path(__file__).resolve().parents[2]


@skipUnless(connection.vendor=='postgresql','PostgreSQL deferred triggers required')
class InventoryCorrectionSQLTests(TransactionTestCase):
    def setUp(self):
        self.raw=RawMaterial.objects.create(name='Chicken boneless trimmed',unit='g')
        today=timezone.localdate()
        self.lot=InventoryItem.objects.create(raw_material=self.raw,quantity=500,
            received_date=today,expiry_date=today+timedelta(days=7),batch_code='CHK-1',
            storage_location='Fridge A - Bottom shelf')
        with connection.cursor() as q:
            q.execute('SELECT current_schema()');schema=q.fetchone()[0]
        self.schema=connection.ops.quote_name(schema)
        self.table=f'{self.schema}.myapp_inventorylog'

    def check_script(self,name):
        sql=(ROOT/'deploy'/'sql'/name).read_text().replace('django_app.',self.schema+'.')
        legacy=sql.replace('SET CONSTRAINTS ALL IMMEDIATE;','',1)
        before=list(InventoryItem.objects.values())
        # Simulate the subsequent RLS statement in the same transaction, as in
        # the reported error. This deliberate failure must roll back the label
        # or location update together with its inserted audit row.
        with self.assertRaises(DatabaseError) as failure:
            with transaction.atomic():
                with connection.cursor() as q:
                    q.execute(legacy)
                    q.execute(f'ALTER TABLE {self.table} ENABLE ROW LEVEL SECURITY')
        cause=failure.exception.__cause__
        self.assertEqual(getattr(cause,'pgcode',None),'55006')
        self.assertEqual(before,list(InventoryItem.objects.values()))
        self.assertEqual(InventoryLog.objects.count(),0)
        # The fixed complete file retains its SELECT result; the following
        # operation succeeds. Roll back the test's RLS operation too so table
        # security settings and fixtures cannot leak into another test.
        with transaction.atomic():
            with connection.cursor() as q:
                q.execute(sql);self.assertEqual(q.fetchone()[0],1)
                q.execute(f'ALTER TABLE {self.table} ENABLE ROW LEVEL SECURITY')
                q.execute(sql);self.assertEqual(q.fetchone()[0],0)
            self.assertEqual(InventoryLog.objects.count(),1)
            self.assertEqual(InventoryLog.objects.get().change,0)
            self.lot.refresh_from_db()
            self.assertEqual(self.lot.quantity,500)
            transaction.set_rollback(True)
        self.assertEqual(before,list(InventoryItem.objects.values()))
        self.assertEqual(InventoryLog.objects.count(),0)

    def test_batch_reference_correction_validates_audit_fk_before_following_rls(self):
        self.check_script('standardize_short_batch_codes.sql')

    def test_storage_location_correction_validates_audit_fk_before_following_rls(self):
        self.lot.batch_code=f'DEMO-FC-INV-{self.raw.pk}-NEAR'
        self.lot.storage_location='FICTIONAL DEMO stock - storage unverified'
        self.lot.save()
        self.check_script('refresh_sample_storage_locations.sql')
