"""Exact owner-authorised order #159 correction on isolated PostgreSQL."""
import json
import uuid
from datetime import datetime,timedelta
from pathlib import Path
from unittest import skipUnless
from django.db import connection,transaction,DatabaseError
from django.test import TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from .models import Order,PaymentEvent,OrderAmendment,CheckoutProof,RawMaterial,InventoryItem,PackagingItem

ROOT=Path(__file__).resolve().parents[2]


@skipUnless(connection.vendor=='postgresql','The owner-run correction requires PostgreSQL')
class RefundCorrectionTests(TransactionTestCase):
    def setUp(self):
        self.owner=User.objects.create_user(pk=2,username='refund-correction-owner',is_staff=True)
        self.order=Order.objects.create(pk=159,user=self.owner,ordering_mode='simple',payment_method='manual',
            payment_status='refunded',total_amount=23,shipping_fee=5,status='pending')
        self.receipt=self.event('receipt','2026-11-06T09:18:49.123456+08:00')
        self.refund=self.event('refund','2026-11-06T09:19:37.987654+08:00')
        self.proof=CheckoutProof.objects.create(user=self.owner,order=self.order,content=b'isolated-proof-fixture',
            digest='a'*64,scope_digest='b'*64,amount=28)
        raw=RawMaterial.objects.create(name='Correction stock fixture',unit='g')
        self.batch=InventoryItem.objects.create(raw_material=raw,quantity=123,received_date=timezone.localdate(),
            expiry_date=timezone.localdate()+timedelta(days=7),storage_location='Shelf')
        self.package=PackagingItem.objects.create(name='Correction packaging fixture',quantity=20)
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()');schema=connection.ops.quote_name(cursor.fetchone()[0])
        self.sql=(ROOT/'deploy/sql/correct_order_159_accidental_refund.sql').read_text().replace('django_app.',schema+'.')

    def event(self,kind,stamp):
        row=PaymentEvent.objects.create(order=self.order,request_id=uuid.uuid4(),kind=kind,outcome='completed',
            amount=28,method='manual',reference='1',actor=self.owner,source='owner_verified')
        PaymentEvent.objects.filter(pk=row.pk).update(created_at=datetime.fromisoformat(stamp))
        row.refresh_from_db();return row

    def run_sql(self):
        with connection.cursor() as cursor:
            cursor.execute(self.sql);result=cursor.fetchone()[0]
        return json.loads(result) if isinstance(result,str) else result

    def test_corrects_only_accidental_refund_and_preserves_receipt_proof_stock_and_other_order(self):
        original=PaymentEvent.objects.filter(pk=self.receipt.pk).values().get()
        other=Order.objects.create(pk=160,user=self.owner,payment_method='manual',payment_status='refunded',total_amount=28)
        other_event=PaymentEvent.objects.create(order=other,request_id=uuid.uuid4(),kind='refund',outcome='completed',
            amount=28,method='manual',reference='1',source='owner_verified',actor=self.owner)
        result=self.run_sql();self.assertEqual(result['status'],'corrected')
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'paid')
        self.assertFalse(PaymentEvent.objects.filter(pk=self.refund.pk).exists())
        self.assertEqual(PaymentEvent.objects.filter(pk=self.receipt.pk).values().get(),original)
        self.assertEqual(PaymentEvent.objects.filter(order=self.order).count(),1)
        amendment=OrderAmendment.objects.get(order=self.order)
        self.assertEqual(amendment.before['removed_refund']['id'],self.refund.pk)
        self.assertEqual(amendment.before['removed_refund']['outcome'],'completed')
        self.assertEqual(bytes(CheckoutProof.objects.get(pk=self.proof.pk).content),b'isolated-proof-fixture')
        self.batch.refresh_from_db();self.package.refresh_from_db()
        self.assertEqual(self.batch.quantity,123);self.assertEqual(self.package.quantity,20)
        self.assertEqual(Order.objects.count(),2);self.assertTrue(PaymentEvent.objects.filter(pk=other_event.pk).exists())
        other.refresh_from_db();self.assertEqual(other.payment_status,'refunded')

    def test_repeat_does_not_undo_any_later_refund(self):
        self.run_sql();later=self.event('refund','2026-11-07T10:00:00+08:00')
        self.order.payment_status='refunded';self.order.save()
        result=self.run_sql();self.assertEqual(result['status'],'already_corrected')
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'refunded')
        self.assertTrue(PaymentEvent.objects.filter(pk=later.pk).exists());self.assertEqual(OrderAmendment.objects.count(),1)

    def test_changed_order_amount_aborts_without_changes(self):
        self.order.shipping_fee=6;self.order.save()
        with self.assertRaisesMessage(DatabaseError,'no longer matches'):
            with transaction.atomic():self.run_sql()
        self.assertEqual(PaymentEvent.objects.filter(order=self.order).count(),2)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_additional_payment_entry_aborts_without_changes(self):
        PaymentEvent.objects.create(order=self.order,request_id=uuid.uuid4(),kind='refund',outcome='pending',amount=28,method='manual',reference='later')
        with self.assertRaisesMessage(DatabaseError,'additional or missing payment entries'):
            with transaction.atomic():self.run_sql()
        self.assertEqual(PaymentEvent.objects.filter(order=self.order).count(),3)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_wrong_receipt_details_abort_without_deleting_refund(self):
        self.receipt.reference='another';self.receipt.save()
        with self.assertRaisesMessage(DatabaseError,'receipt does not match'):
            with transaction.atomic():self.run_sql()
        self.assertTrue(PaymentEvent.objects.filter(pk=self.refund.pk).exists())
        self.assertFalse(OrderAmendment.objects.exists())

    def test_wrong_refund_time_aborts_without_changes(self):
        PaymentEvent.objects.filter(pk=self.refund.pk).update(created_at=datetime.fromisoformat('2026-11-06T09:19:38+08:00'))
        with self.assertRaisesMessage(DatabaseError,'accidental refund does not match'):
            with transaction.atomic():self.run_sql()
        self.order.refresh_from_db();self.assertEqual(self.order.payment_status,'refunded')
        self.assertEqual(PaymentEvent.objects.filter(order=self.order).count(),2)
        self.assertFalse(OrderAmendment.objects.exists())
