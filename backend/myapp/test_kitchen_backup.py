import gzip
import hashlib
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from .models import Order, OrderItem, Product, ProductIngredient, RawMaterial, InventoryItem


class KitchenBackupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('backup-owner', password='example-not-a-real-secret', is_staff=True)
        self.menu = Product.objects.create(name='Nasi Lemak', price=8)
        self.material = RawMaterial.objects.create(name='Rice', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=self.material, quantity_required=150)
        self.batch = InventoryItem.objects.create(raw_material=self.material, quantity=1200,
            received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=10))
        group = Group.objects.create(name='Kitchen managers')
        group.permissions.add(Permission.objects.get(codename='view_product', content_type__app_label='myapp'))
        self.user.groups.add(group)
        self.order = Order.objects.create(user=self.user, payment_status='paid', status='delivered',
            preparation_plan={'fictional_timing': {'label': 'Demo timing'}})
        OrderItem.objects.create(order=self.order, product=self.menu, product_name=self.menu.name,
            quantity=3, unit_price=8, subtotal=24)

    def backup(self, path):
        output = io.StringIO()
        call_command('backup_freshcast_kitchen', output=path, stdout=output)
        return json.loads(output.getvalue())

    def test_read_only_export_and_logical_restore_preserve_ids_relations_and_provenance(self):
        with TemporaryDirectory() as folder:
            path = Path(folder)/'backup'
            with patch.dict(os.environ, {'FRESHCAST_BUNDLE_TOKEN': 'do-not-export-this-token'}):
                report = self.backup(path)
            self.order.refresh_from_db()
            self.assertEqual(self.order.status, 'delivered')
            self.assertEqual(self.order.items.get().quantity, 3)
            manifest = json.loads((path/'manifest.json').read_text())
            self.assertEqual(report['record_count'], manifest['record_count'])
            self.assertEqual(manifest['files']['kitchen.json.gz']['sha256'],
                hashlib.sha256((path/'kitchen.json.gz').read_bytes()).hexdigest())
            with gzip.open(path/'kitchen.json.gz', 'rt') as stream:
                text = stream.read();records = json.loads(text)
            self.assertNotIn('do-not-export-this-token', text)
            self.assertEqual(len(records), manifest['record_count'])
            self.assertEqual(manifest['model_counts']['myapp.orderitem'], 1)
            if os.name != 'nt':
                self.assertEqual((path/'kitchen.json.gz').stat().st_mode & 0o777, 0o600)
            order_id = self.order.pk
            self.order.delete();self.menu.name = 'Changed';self.menu.save()
            self.batch.quantity = 1;self.batch.save()
            call_command('loaddata', str(path/'kitchen.json.gz'), verbosity=0)
            restored = Order.objects.get(pk=order_id)
            self.assertEqual(restored.user_id, self.user.pk)
            self.assertEqual(restored.items.get().quantity, 3)
            self.assertEqual(restored.items.get().product.name, 'Nasi Lemak')
            self.assertEqual(restored.preparation_plan['fictional_timing']['label'], 'Demo timing')
            self.assertEqual(restored.items.get().accepted_ingredients.get().material_name, 'Rice')
            self.batch.refresh_from_db();self.assertEqual(self.batch.quantity, 1200)
            self.assertTrue(restored.user.groups.get().permissions.filter(codename='view_product').exists())

    def test_refuses_existing_directory_and_repository_destination(self):
        with TemporaryDirectory() as folder:
            with self.assertRaisesMessage(CommandError, 'never overwritten'):
                self.backup(Path(folder))
        from .management.commands.backup_freshcast_kitchen import ROOT
        with self.assertRaisesMessage(CommandError, 'outside the repository'):
            self.backup(ROOT/'must-not-create-backup')
        self.assertFalse((ROOT/'must-not-create-backup').exists())

    def test_failed_export_removes_partial_files_without_emitting_private_error(self):
        with TemporaryDirectory() as folder:
            path = Path(folder)/'failed'
            with patch('myapp.management.commands.backup_freshcast_kitchen.call_command',
                       side_effect=RuntimeError('private-connection-string')):
                with self.assertRaisesMessage(CommandError, 'partial files were removed') as error:
                    self.backup(path)
            self.assertNotIn('private-connection-string', str(error.exception))
            self.assertFalse(path.exists())
