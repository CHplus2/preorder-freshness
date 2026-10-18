import io
import json
import os
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from .models import (IngredientConsumption, InventoryItem, KitchenBlock, Order,
                     OrderAmendment, OrderItem, PaymentEvent, Product, ProductIngredient,
                     RawMaterial, Storefront)


class DemoPlanCommandTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('plan-command-owner', is_staff=True)
        self.store = Storefront.objects.create(pk=1)
        self.menu = Product.objects.create(name='Nasi Telur Kicap', price=10, lead_hours=0,
            max_early_minutes=120, preparation_tasks=[dict(name='Cook and pack', minutes=20,
                worker=True, resource='packing_area', additional_batch_minutes=0,
                max_wait_minutes=0, overnight=False)])
        self.date = (timezone.localtime() + timedelta(days=7)).replace(hour=18, minute=0, second=0, microsecond=0)
        self.order = self.order_for()

    def order_for(self, **kwargs):
        order = Order.objects.create(user=self.owner, total_amount=10,
            **(dict(delivery_at=self.date) | kwargs))
        OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
            quantity=1, unit_price=10, subtotal=10)
        return order

    def command(self, *args, actor=None):
        output = io.StringIO()
        call_command('plan_freshcast_demo_orders', '--actor-id', str(actor or self.owner.pk), *args, stdout=output)
        return json.loads(output.getvalue())

    def apply(self, preview, folder, *args):
        return self.command(*args, '--apply', '--confirm-fictional', '--confirm', preview['confirm'],
            '--backup', str(Path(folder) / 'private' / 'before.json'))

    def test_preview_and_apply_batch_reserve_resources_without_other_changes(self):
        second = self.order_for(payment_status='paid')
        preview = self.command()
        self.assertEqual(len(preview['proposed_plans']), 2)
        first_plan, second_plan = preview['proposed_plans']
        self.assertLessEqual(second_plan['preparation_end'], first_plan['preparation_start'])
        self.assertFalse(Order.objects.exclude(preparation_plan={}).exists())
        self.assertFalse(OrderAmendment.objects.exists())
        original_items = list(OrderItem.objects.values())
        with TemporaryDirectory() as folder:
            result = self.apply(preview, folder)
            backup = Path(result['backup'])
            records = json.loads(backup.read_text())['records']
            self.assertEqual(len(records), 4)
            self.assertTrue(all(row['fields']['preparation_plan'] == {} for row in records if row['model'] == 'myapp.order'))
            if os.name != 'nt':
                self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            self.assertTrue(self.apply(preview, folder)['already_applied'])
        self.order.refresh_from_db(); second.refresh_from_db()
        self.assertTrue(self.order.preparation_plan['tasks'])
        self.assertEqual(self.order.status, 'pending')
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertEqual(second.payment_status, 'paid')
        self.assertEqual(self.order.delivery_at, self.date)
        self.assertFalse(self.order.inventory_deducted)
        self.assertEqual(list(OrderItem.objects.values()), original_items)
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertEqual(OrderAmendment.objects.count(), 2)

    def test_repair_exact_unstarted_processing_shape_preserves_payments(self):
        self.order.delete()
        a = self.order_for(delivery_at=None, status='processing', payment_status='paid')
        b = self.order_for(delivery_at=None, status='processing', payment_status='unpaid')
        args = ['--repair-unstarted-requests']
        preview = self.command(*args)
        self.assertEqual(len(preview['proposed_request_repairs']), 2)
        self.assertEqual(len(preview['proposed_plans']), 2)
        a.refresh_from_db(); self.assertEqual(a.status, 'processing'); self.assertIsNone(a.delivery_at)
        with TemporaryDirectory() as folder:
            result = self.apply(preview, folder, *args)
        self.assertEqual(result['repaired_request_ids'], [a.pk, b.pk])
        for order, payment in [(a, 'paid'), (b, 'unpaid')]:
            order.refresh_from_db()
            self.assertEqual(order.status, 'pending')
            self.assertEqual(order.payment_status, payment)
            self.assertTrue(order.delivery_at)
            self.assertTrue(order.preparation_plan['tasks'])
            self.assertFalse(order.inventory_deducted)

    def test_repair_never_restarts_work_or_reverses_consumption(self):
        self.order.delete()
        started = [self.order_for(delivery_at=None, status='processing', inventory_deducted=True),
                   self.order_for(delivery_at=None, status='processing', preparation_at=timezone.now()),
                   self.order_for(delivery_at=None, status='processing', preparation_plan={'tasks': [{'name': 'Started'}]}),
                   self.order_for(delivery_at=None, status='processing', payment_status='refunded')]
        consumed = self.order_for(delivery_at=None, status='processing')
        material = RawMaterial.objects.create(name='Egg', unit='unit')
        batch = InventoryItem.objects.create(raw_material=material, quantity=5,
            received_date=timezone.localdate(), expiry_date=timezone.localdate() + timedelta(days=30))
        IngredientConsumption.objects.create(order_item=consumed.items.first(), inventory_item=batch,
            material_name='Egg', unit='unit', quantity=1, recorded_expiry=batch.expiry_date)
        started.append(consumed)
        preview = self.command('--repair-unstarted-requests')
        self.assertEqual(preview['proposed_request_repairs'], [])
        self.assertEqual(len(preview['missing_delivery_dates']), 5)
        self.assertEqual(IngredientConsumption.objects.count(), 1)
        for order in started:
            order.refresh_from_db(); self.assertEqual(order.status, 'processing'); self.assertIsNone(order.delivery_at)

    def test_zero_finish_multi_menu_is_reported_not_relaxed(self):
        self.menu.max_early_minutes = 0; self.menu.save()
        item = self.order.items.first()
        item.preparation_snapshot['max_early_minutes'] = 0
        item.save(update_fields=['preparation_snapshot'])
        other = Product.objects.create(name='Second menu', price=10, max_early_minutes=0,
            lead_hours=0, preparation_tasks=self.menu.preparation_tasks)
        OrderItem.objects.create(order=self.order, product=other, product_name=other.name,
            quantity=1, unit_price=10, subtotal=10)
        preview = self.command()
        self.assertEqual(preview['proposed_plans'], [])
        self.assertEqual(len(preview['blocked_plans'][0]['zero_early_finish_menus']), 2)
        self.assertIn('Changing the delivery date cannot resolve', preview['blocked_plans'][0]['timing_issue'])
        self.order.refresh_from_db(); self.assertEqual(self.order.preparation_plan, {})
        self.menu.refresh_from_db(); self.assertEqual(self.menu.max_early_minutes, 0)

    def test_preparation_adoption_is_explicit_and_keeps_recipes_and_costs(self):
        material = RawMaterial.objects.create(name='Rice', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=material, quantity_required=80)
        # Accepted order is intentionally from an older preparation record.
        self.menu.preparation_tasks[0]['minutes'] = 40; self.menu.save()
        item = self.order.items.first()
        item.preparation_snapshot = {}; item.save(update_fields=['preparation_snapshot'])
        self.assertEqual(len(self.command()['blocked_plans']), 1)
        recipes = list(item.accepted_ingredients.values())
        cost = item.packaging_unit_cost
        preview = self.command('--use-current-preparation')
        self.assertTrue(preview['proposed_plans'][0]['preparation_changes'])
        with TemporaryDirectory() as folder:
            self.apply(preview, folder, '--use-current-preparation')
        item.refresh_from_db()
        self.assertEqual(item.preparation_snapshot['preparation_tasks'][0]['minutes'], 40)
        self.assertEqual(list(item.accepted_ingredients.values()), recipes)
        self.assertEqual(item.packaging_unit_cost, cost)

    def test_existing_plans_and_completed_history_preserved(self):
        self.order.preparation_plan = {'tasks': [{'name': 'Accepted'}]}; self.order.save()
        history = self.order_for(status='delivered', payment_status='paid')
        preview = self.command('--use-current-preparation')
        self.assertFalse(preview['proposed_plans'])
        self.assertEqual(len(preview['unchanged_orders']), 1)
        history.refresh_from_db(); self.assertEqual(history.preparation_plan, {})

    def test_stale_options_actor_or_availability_cannot_apply(self):
        preview = self.command()
        with TemporaryDirectory() as folder:
            with self.assertRaises(CommandError): self.apply(preview, folder, '--use-current-preparation')
            KitchenBlock.objects.create(start_at=self.date-timedelta(hours=5), end_at=self.date, reason='Booked')
            with self.assertRaises(CommandError): self.apply(preview, folder)
            self.assertFalse((Path(folder)/'private'/'before.json').exists())
        self.assertFalse(OrderAmendment.objects.exists())
        with self.assertRaises(CommandError): self.command('--apply')
        buyer = User.objects.create_user('not-staff')
        with self.assertRaises(CommandError): self.command(actor=buyer.pk)

    def test_backup_failure_and_order_filter(self):
        other = self.order_for()
        args = ['--order-id', str(self.order.pk)]
        preview = self.command(*args)
        self.assertEqual(len(preview['proposed_plans']), 1)
        with TemporaryDirectory() as folder:
            path = Path(folder)/'private'/'before.json'; path.parent.mkdir(); path.write_text('keep')
            with self.assertRaises(CommandError): self.apply(preview, folder, *args)
            self.assertEqual(path.read_text(), 'keep')
        self.order.refresh_from_db(); other.refresh_from_db()
        self.assertEqual(self.order.preparation_plan, {}); self.assertEqual(other.preparation_plan, {})

    def test_request_date_saved_honestly_when_multi_menu_plan_is_infeasible(self):
        self.order.status='processing'; self.order.delivery_at=None; self.order.save()
        self.menu.max_early_minutes=0; self.menu.save()
        self.order.items.update(preparation_snapshot={})
        other = Product.objects.create(name='Another menu', price=10, lead_hours=0,
            max_early_minutes=0, preparation_tasks=self.menu.preparation_tasks)
        OrderItem.objects.create(order=self.order, product=other, product_name=other.name,
            quantity=1, unit_price=10, subtotal=10)
        args=['--repair-unstarted-requests', '--use-current-preparation']
        preview=self.command(*args)
        self.assertEqual(len(preview['proposed_request_repairs']),1)
        self.assertEqual(len(preview['blocked_plans']),1)
        with TemporaryDirectory() as folder: result=self.apply(preview,folder,*args)
        self.assertEqual(result['planned_order_ids'],[])
        self.order.refresh_from_db()
        self.assertEqual(self.order.status,'pending'); self.assertTrue(self.order.delivery_at)
        self.assertTrue(self.order.preparation_plan['needs_review'])
        self.assertFalse(self.order.preparation_plan['tasks'])
        self.assertIsNone(self.order.preparation_at)

    def test_two_request_repairs_and_nine_dated_plans_in_one_batch(self):
        for day in range(1, 9):
            self.order_for(delivery_at=self.date + timedelta(days=day))
        repaired = [self.order_for(delivery_at=None, status='processing', payment_status=payment)
                    for payment in ['paid', 'unpaid']]
        args=['--repair-unstarted-requests', '--use-current-preparation']
        preview=self.command(*args)
        self.assertEqual(len(preview['proposed_request_repairs']),2)
        self.assertEqual(len(preview['proposed_plans']),11)
        with TemporaryDirectory() as folder: result=self.apply(preview,folder,*args)
        self.assertEqual(len(result['planned_order_ids']),11)
        self.assertEqual(len(result['repaired_request_ids']),2)
        self.assertEqual(Order.objects.filter(status='pending',delivery_at__isnull=False).count(),11)
        self.assertFalse(Order.objects.filter(inventory_deducted=True).exists())
        for order in repaired:
            order.refresh_from_db(); self.assertFalse(order.preparation_plan.get('needs_review'))

    def test_mid_apply_failure_rolls_back_all_plans_but_preserves_before_backup(self):
        self.order_for()
        preview=self.command()
        create=OrderAmendment.objects.create
        count=0
        def fail_second(*args,**kwargs):
            nonlocal count
            count+=1
            if count==2: raise RuntimeError('Simulated write failure')
            return create(*args,**kwargs)
        with TemporaryDirectory() as folder:
            with patch.object(OrderAmendment.objects,'create',side_effect=fail_second):
                with self.assertRaisesMessage(RuntimeError,'Simulated write failure'):
                    self.apply(preview,folder)
            self.assertTrue((Path(folder)/'private'/'before.json').exists())
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertFalse(Order.objects.exclude(preparation_plan={}).exists())

    def test_signed_preview_is_actor_bound_and_expires(self):
        preview=self.command()
        other=User.objects.create_user('another-plan-owner',is_staff=True)
        with TemporaryDirectory() as folder:
            with self.assertRaises(CommandError):
                self.command('--apply','--confirm-fictional','--confirm',preview['confirm'],
                    '--backup',str(Path(folder)/'before.json'),actor=other.pk)
            import time
            with patch('django.core.signing.time.time',return_value=time.time()+601):
                with self.assertRaises(CommandError): self.apply(preview,folder)
            self.assertFalse((Path(folder)/'private'/'before.json').exists())
