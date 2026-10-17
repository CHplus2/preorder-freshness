import io,json,os
from pathlib import Path
from tempfile import TemporaryDirectory
from django.contrib.auth.models import User
from django.core.management import call_command,CommandError
from django.test import TestCase
from .models import Product,Order,OrderItem,Storefront,OrderAmendment


class DemoDateCommandTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('date-command-owner',is_staff=True)
        Storefront.objects.create(pk=1)
        self.menu=Product.objects.create(name='Nasi Telur Kicap',price=10)
        self.order=Order.objects.create(user=self.owner,total_amount=10)
        OrderItem.objects.create(order=self.order,product=self.menu,product_name=self.menu.name,quantity=1,unit_price=10,subtotal=10)

    def command(self,*args):
        output=io.StringIO()
        call_command('assign_freshcast_demo_dates','--actor-id',str(self.owner.pk),*args,stdout=output)
        return json.loads(output.getvalue())

    def test_preview_then_backed_up_apply_and_idempotent_retry(self):
        for _ in range(10):
            order=Order.objects.create(user=self.owner,total_amount=10)
            OrderItem.objects.create(order=order,product=self.menu,product_name=self.menu.name,quantity=1,unit_price=10,subtotal=10)
        ids=list(Order.objects.order_by('pk').values_list('pk',flat=True))
        preview=self.command();self.assertEqual(preview['mode'],'preview')
        self.assertEqual(len(preview['proposed_dates']),11)
        self.order.refresh_from_db();self.assertIsNone(self.order.delivery_at)
        with TemporaryDirectory() as folder:
            backup=Path(folder)/'private'/'before.json'
            args=['--apply','--confirm-fictional','--confirm',preview['confirm'],'--backup',str(backup)]
            result=self.command(*args)
            snapshot=json.loads(backup.read_text())
            self.assertIsNone(next(row for row in snapshot['records'] if row['model']=='myapp.order')['fields']['delivery_at'])
            if os.name!='nt':self.assertEqual(backup.stat().st_mode & 0o777,0o600)
            self.assertEqual(result['updated_order_ids'],ids)
            self.assertEqual(len(snapshot['records']),22)
            self.assertTrue(self.command(*args)['already_applied'])
        self.order.refresh_from_db();self.assertIsNotNone(self.order.delivery_at)
        self.assertEqual(self.order.payment_status,'unpaid');self.assertEqual(self.order.status,'pending')
        self.assertEqual(OrderAmendment.objects.count(),11)

    def test_confirmation_staleness_and_backup_failure_prevent_changes(self):
        preview=self.command()
        with self.assertRaises(CommandError):self.command('--apply')
        with self.assertRaises(CommandError):self.command('--apply','--confirm-fictional','--confirm','bad','--backup','/tmp/not-created.json')
        with TemporaryDirectory() as folder:
            path=Path(folder)/'existing.json';path.write_text('keep')
            args=['--apply','--confirm-fictional','--confirm',preview['confirm'],'--backup',str(path)]
            with self.assertRaises(CommandError):self.command(*args)
            self.assertEqual(path.read_text(),'keep')
            self.menu.daily_capacity=5;self.menu.save()
            path.unlink()
            with self.assertRaises(CommandError):self.command(*args)
            self.assertFalse(path.exists())
        self.order.refresh_from_db();self.assertIsNone(self.order.delivery_at)
        self.assertFalse(OrderAmendment.objects.exists())
