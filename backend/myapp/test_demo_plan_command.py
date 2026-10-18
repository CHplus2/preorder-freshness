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
        self.order.preparation_plan = {'tasks': [{'name': 'Accepted',
            'start':(self.date-timedelta(hours=3)).isoformat(),'end':(self.date-timedelta(hours=2)).isoformat()}]}; self.order.save()
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

    def test_apply_uses_reviewed_request_dates_not_new_suggestions(self):
        self.order.status='processing'; self.order.delivery_at=None; self.order.save()
        args=['--repair-unstarted-requests']
        preview=self.command(*args)
        reviewed=preview['proposed_request_repairs'][0]['delivery_at']
        with TemporaryDirectory() as folder:
            with patch('myapp.management.commands.plan_freshcast_demo_orders.propose_dates',
                       side_effect=AssertionError('Apply must validate reviewed dates instead of suggesting new ones')):
                self.apply(preview,folder,*args)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivery_at,timezone.datetime.fromisoformat(reviewed))

    def test_explanatory_note_changes_do_not_invalidate_unchanged_request(self):
        self.order.status='processing'; self.order.delivery_at=None; self.order.save()
        args=['--repair-unstarted-requests']
        from .services.initial_delivery import initial_delivery_plan
        target='myapp.management.commands.plan_freshcast_demo_orders.initial_delivery_plan'
        def describe(note):
            def run(*args,**kwargs):
                return dict(initial_delivery_plan(*args,**kwargs),review_reason=note)
            return run
        with patch(target,side_effect=describe('Preview explanation')):
            preview=self.command(*args)
        with TemporaryDirectory() as folder:
            with patch(target,side_effect=describe('Rechecked explanation')):
                self.apply(preview,folder,*args)
        self.order.refresh_from_db();self.assertTrue(self.order.preparation_plan['tasks'])

    def test_changed_task_timing_without_record_changes_still_rejects_before_backup(self):
        preview=self.command()
        from .services.scheduling import schedule_order
        def different_plan(*args,**kwargs):
            plan=schedule_order(*args,**kwargs)
            plan['start']-=timedelta(minutes=1)
            return plan
        with TemporaryDirectory() as folder:
            with patch('myapp.management.commands.plan_freshcast_demo_orders.schedule_order',side_effect=different_plan):
                with self.assertRaisesMessage(CommandError,f'Task timings or preparation settings changed for orders: #{self.order.pk}'):
                    self.apply(preview,folder)
            self.assertFalse((Path(folder)/'private'/'before.json').exists())
        self.order.refresh_from_db();self.assertFalse(self.order.preparation_plan)

    def test_reviewed_date_crossing_notice_cutoff_is_rejected_without_writes(self):
        self.order.status='processing';self.order.delivery_at=None;self.order.save()
        now=timezone.localtime().replace(hour=16,minute=29,second=0,microsecond=0)
        args=['--repair-unstarted-requests']
        with patch('django.utils.timezone.now',return_value=now):
            preview=self.command(*args)
        with TemporaryDirectory() as folder:
            with patch('django.utils.timezone.now',return_value=now+timedelta(minutes=2)):
                with self.assertRaisesMessage(CommandError,'now too close'):
                    self.apply(preview,folder,*args)
            self.assertFalse((Path(folder)/'private'/'before.json').exists())
        self.order.refresh_from_db();self.assertEqual(self.order.status,'processing');self.assertIsNone(self.order.delivery_at)

    def test_three_feasible_and_eight_blocked_plans_with_two_date_repairs(self):
        self.order_for(delivery_at=self.date+timedelta(days=1))
        self.order_for(delivery_at=self.date+timedelta(days=2))
        self.menu.max_early_minutes=0;self.menu.save()
        other=Product.objects.create(name='Second packed menu',price=10,lead_hours=0,
            max_early_minutes=0,preparation_tasks=self.menu.preparation_tasks)
        for index in range(8):
            order=self.order_for(delivery_at=None if index<2 else self.date+timedelta(days=3+index),
                status='processing' if index<2 else 'pending')
            OrderItem.objects.create(order=order,product=other,product_name=other.name,quantity=1,unit_price=10,subtotal=10)
        args=['--repair-unstarted-requests','--use-current-preparation']
        preview=self.command(*args)
        self.assertEqual(len(preview['proposed_plans']),3)
        self.assertEqual(len(preview['blocked_plans']),8)
        self.assertEqual(len(preview['proposed_request_repairs']),2)
        with TemporaryDirectory() as folder:result=self.apply(preview,folder,*args)
        self.assertEqual(len(result['planned_order_ids']),3)
        self.assertEqual(len(result['repaired_request_ids']),2)
        self.assertEqual(OrderAmendment.objects.count(),5)
        self.assertFalse(Order.objects.filter(delivery_at__isnull=True).exists())

    def test_labelled_demo_allowance_fixes_eight_orders_without_changing_catalogue(self):
        self.order.delete()
        self.menu.max_early_minutes=0;self.menu.save()
        other=Product.objects.create(name='Second menu',price=10,lead_hours=0,max_early_minutes=0,
            preparation_tasks=self.menu.preparation_tasks)
        for day in range(8):
            order=self.order_for(delivery_at=self.date+timedelta(days=day))
            OrderItem.objects.create(order=order,product=other,product_name=other.name,quantity=1,unit_price=10,subtotal=10)
        original_items=list(OrderItem.objects.values())
        self.assertEqual(len(self.command()['blocked_plans']),8)
        args=['--use-current-preparation','--demo-finish-allowance']
        preview=self.command(*args)
        self.assertEqual(len(preview['proposed_plans']),8)
        self.assertFalse(preview['blocked_plans'])
        self.assertEqual(list(OrderItem.objects.values()),original_items)
        for row in preview['proposed_plans']:
            self.assertTrue(row['fictional_timing']['allowances'])
            self.assertTrue(all(change['after']['max_early_minutes']==30 for change in row['preparation_changes']))
            self.assertTrue(all(change['after']['preparation_tasks']==change['before']['preparation_tasks'] for change in row['preparation_changes']))
        with TemporaryDirectory() as folder:result=self.apply(preview,folder,*args)
        self.assertEqual(len(result['planned_order_ids']),8)
        self.menu.refresh_from_db();other.refresh_from_db()
        self.assertEqual(self.menu.max_early_minutes,0);self.assertEqual(other.max_early_minutes,0)
        self.assertFalse(PaymentEvent.objects.exists());self.assertFalse(IngredientConsumption.objects.exists())
        from rest_framework.test import APIClient
        client=APIClient();client.force_authenticate(self.owner)
        order=Order.objects.first();url=f'/api/admin/orders/{order.pk}/preparation-plan/'
        response=client.post(url,{},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertIn('fictional_timing',response.data['preview']['plan'])
        saved=client.post(url,{'confirm':response.data['confirm']},format='json')
        self.assertEqual(saved.status_code,200,saved.data)
        order.refresh_from_db();self.assertIn('fictional_timing',order.preparation_plan)
        manual_url=f'/api/admin/orders/{order.pk}/manual-plan/'
        manual=client.post(manual_url,{'mode':'window','start':order.preparation_at.isoformat(),
            'end':order.preparation_end_at.isoformat(),'reason':'Fictional owner-reviewed test window'},format='json')
        self.assertEqual(manual.status_code,200,manual.data)
        confirmed=client.post(manual_url,{'confirm':manual.data['confirm']},format='json')
        self.assertEqual(confirmed.status_code,200,confirmed.data)
        order.refresh_from_db();self.assertIn('fictional_timing',order.preparation_plan)

    def test_demo_allowance_does_not_move_work_before_order_or_override_closures(self):
        self.menu.max_early_minutes=0;self.menu.save()
        other=Product.objects.create(name='Another menu',price=10,lead_hours=0,max_early_minutes=0,
            preparation_tasks=self.menu.preparation_tasks)
        OrderItem.objects.create(order=self.order,product=other,product_name=other.name,quantity=1,unit_price=10,subtotal=10)
        KitchenBlock.objects.create(start_at=self.date-timedelta(days=30),end_at=self.date,reason='Closed')
        args=['--use-current-preparation','--demo-finish-allowance']
        preview=self.command(*args)
        self.assertFalse(preview['proposed_plans']);self.assertEqual(len(preview['blocked_plans']),1)
        self.order.refresh_from_db();self.assertFalse(self.order.preparation_plan)
        with self.assertRaises(CommandError):self.command('--demo-finish-allowance')

    def test_pre_order_or_missed_saved_plan_is_replanned_for_pending_request(self):
        start=self.order.created_at-timedelta(days=1)
        self.order.preparation_at=start;self.order.preparation_end_at=start+timedelta(minutes=20)
        self.order.preparation_plan={'tasks':[{'name':'Old saved task','start':start.isoformat(),'end':(start+timedelta(minutes=20)).isoformat()}]}
        self.order.save()
        now=timezone.now()
        preview=self.command()
        self.assertEqual(len(preview['proposed_plans']),1)
        start=timezone.datetime.fromisoformat(preview['proposed_plans'][0]['preparation_start'])
        self.assertGreaterEqual(start,now);self.assertGreaterEqual(start,self.order.created_at)
