from datetime import timedelta
from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import Address, CartItem, KitchenBlock, Order, Product, Storefront
from .serializers import ProductSerializer
from .services.scheduling import schedule_order, validate_tasks


class MultiDayPlanningTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('multi-owner',is_staff=True)
        self.buyer=User.objects.create_user('multi-buyer')
        self.store=Storefront.objects.create(pk=1)
        self.now=timezone.localtime().replace(hour=8,minute=0,second=0,microsecond=0)
        self.delivery=(self.now+timedelta(days=7)).replace(hour=18)
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        self.address=Address.objects.create(user=self.buyer,line1='Test',city='KL',state='KL',postal_code='50000',phone='0100000000')

    def task(self,**kwargs):
        return dict(name='Prepare ingredients',resource='prep_table',worker=True,minutes=1000,
            additional_batch_minutes=0,overnight=False,max_wait_minutes=0,
            splittable=True,max_pause_minutes=720,pause_resource='fridge',**kwargs)

    def menu(self,tasks=None,**kwargs):
        return Product.objects.create(name='Large reviewed menu',price=10,lead_hours=1,
            max_preparation_days=7,max_early_minutes=0,
            preparation_tasks=tasks or [self.task()],**kwargs)

    def plan(self,p,qty=1,**kwargs):
        return schedule_order([SimpleNamespace(product=p,product_id=p.pk,quantity=qty)],
            self.delivery,self.store,now=self.now,**kwargs)

    def test_large_opted_in_preparation_spans_two_days_with_reserved_pause(self):
        p=self.menu()
        plan=self.plan(p)
        work=[t for t in plan['tasks'] if t['worker']]
        pauses=[t for t in plan['tasks'] if t.get('segment_role')=='pause']
        self.assertEqual(plan['hands_on_minutes'],1000)
        self.assertEqual(plan['recipe_minutes'],1000)
        self.assertEqual(len(work),2);self.assertEqual(len(pauses),1)
        self.assertEqual(pauses[0]['resource'],'fridge');self.assertFalse(pauses[0]['worker'])
        self.assertEqual(pauses[0]['minutes'],720)
        self.assertEqual(sum(row['hands_on_minutes'] for row in plan['daily_work']),1000)
        self.assertEqual(plan['hands_on_days'],2)
        for task in work:
            a,b=timezone.localtime(parse_datetime(task['start'])),timezone.localtime(parse_datetime(task['end']))
            self.assertEqual(a.date(),b.date());self.assertGreaterEqual(a.hour,8);self.assertLessEqual(b.hour,20)
            self.assertGreaterEqual(a,self.now)

    def test_large_uninterrupted_cooking_is_not_silently_split(self):
        p=self.menu(tasks=[dict(self.task(),name='Cook',resource='stove',splittable=False)])
        with self.assertRaisesMessage(ValidationError,'uninterrupted minutes'):self.plan(p)
        for resource in ['stove','oven','rice_cooker','fridge']:
            with self.assertRaisesMessage(ValidationError,'must remain uninterrupted'):
                validate_tasks([dict(self.task(),resource=resource)])
        with self.assertRaises(ValidationError):validate_tasks([dict(self.task(),max_pause_minutes=0)])
        with self.assertRaises(ValidationError):validate_tasks([dict(self.task(),pause_resource='oven')])
        with self.assertRaises(ValidationError):validate_tasks([dict(self.task(),worker=False)])

    def test_pause_limit_and_preparation_span_still_bound_split_work(self):
        p=self.menu(tasks=[dict(self.task(),max_pause_minutes=719)])
        with self.assertRaisesMessage(ValidationError,'pause would exceed'):self.plan(p)
        p.preparation_tasks=[self.task()];p.max_preparation_days=1
        p.preparation_tasks[0]['minutes']=1500
        with self.assertRaises(ValidationError):self.plan(p)

    def test_pause_does_not_double_book_fridge_or_worker(self):
        p=self.menu();plan=self.plan(p)
        pause=next(t for t in plan['tasks'] if t.get('segment_role')=='pause')
        Order.objects.create(user=self.buyer,delivery_at=self.delivery,preparation_at=parse_datetime(pause['start']),
            preparation_end_at=parse_datetime(pause['end']),preparation_plan={'tasks':[pause]})
        with self.assertRaisesMessage(ValidationError,'pause storage'):self.plan(p)

    def test_split_work_keeps_recipe_order_and_separate_cooking_uninterrupted(self):
        bake=dict(name='Bake',minutes=60,additional_batch_minutes=0,resource='oven',worker=False,overnight=False,max_wait_minutes=0)
        pack=dict(bake,name='Pack',resource='packing_area',worker=True,minutes=30)
        p=self.menu(tasks=[self.task(),bake,pack]);plan=self.plan(p)
        prep=[t for t in plan['tasks'] if t['sequence']==1]
        baked=next(t for t in plan['tasks'] if t['sequence']==2)
        packed=next(t for t in plan['tasks'] if t['sequence']==3)
        self.assertEqual(prep[-1]['end'],baked['start']);self.assertEqual(baked['end'],packed['start'])
        self.assertEqual(baked['minutes'],60)
        self.assertEqual(plan['hands_on_minutes'],1030)

    def test_owner_serializer_can_save_multi_day_batch_finish_limit(self):
        serializer=ProductSerializer(data={'name':'Batch menu','price':10,'max_preparation_days':3,'max_early_minutes':4320})
        self.assertTrue(serializer.is_valid(),serializer.errors)
        p=serializer.save()
        bad=ProductSerializer(p,data={'max_preparation_days':1},partial=True)
        self.assertFalse(bad.is_valid());self.assertIn('max_early_minutes',bad.errors)
        tasks=[dict(self.task(),minutes=400,splittable=False,max_pause_minutes=0,independent_batches=True)]
        p.preparation_tasks=tasks;p.batch_size=1;p.daily_capacity=3;p.save()
        plan=self.plan(p,3)
        self.assertGreater(plan['hands_on_days'],1)

    def test_quote_and_checkout_accept_feasible_multiday_order_and_capture_policy(self):
        p=self.menu()
        CartItem.objects.create(user=self.buyer,product=p,quantity=1)
        response=self.client.post('/api/orders/quote/',{'delivery_at':self.delivery.isoformat()},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertFalse(response.data.get('needs_review'));self.assertEqual(response.data['hands_on_days'],2)
        self.assertEqual(Order.objects.count(),0)
        saved=self.client.post('/api/orders/place/',{'delivery_at':self.delivery.isoformat(),'address_id':self.address.pk,'payment':'cod'},format='json')
        self.assertEqual(saved.status_code,201,saved.data)
        order=Order.objects.get();self.assertFalse(order.preparation_plan.get('needs_review'))
        self.assertEqual(order.preparation_plan['hands_on_days'],2)
        self.assertTrue(order.items.get().preparation_snapshot['preparation_tasks'][0]['splittable'])
        self.assertGreaterEqual(order.preparation_at,order.created_at)
        p.preparation_tasks=[dict(self.task(),splittable=False)];p.save()
        order.refresh_from_db()
        self.assertTrue(order.items.get().preparation_snapshot['preparation_tasks'][0]['splittable'])
        self.assertEqual(order.preparation_plan['hands_on_days'],2)

    def test_work_sessions_avoid_worker_bookings_and_respect_full_kitchen_closures(self):
        p=self.menu();first=self.plan(p)
        work=next(t for t in first['tasks'] if t['worker'])
        start=parse_datetime(work['start'])+timedelta(minutes=30)
        end=start+timedelta(minutes=60)
        Order.objects.create(user=self.buyer,delivery_at=self.delivery,preparation_at=start,
            preparation_end_at=end,preparation_plan={'tasks':[dict(name='Other work',
                start=start.isoformat(),end=end.isoformat(),worker=True,resource='stove')]})
        plan=self.plan(p)
        self.assertEqual(plan['hands_on_minutes'],1000)
        for task in (t for t in plan['tasks'] if t['worker']):
            self.assertFalse(parse_datetime(task['start']) < end and parse_datetime(task['end']) > start)
        KitchenBlock.objects.create(start_at=start,end_at=end,reason='Full kitchen closure')
        with self.assertRaisesMessage(ValidationError,'pause storage or kitchen'):
            self.plan(p)

    def test_duplicate_menu_lines_cannot_bypass_delivery_capacity(self):
        p=self.menu(daily_capacity=3)
        items=[SimpleNamespace(product=p,product_id=p.pk,quantity=2) for _ in range(2)]
        with self.assertRaisesMessage(ValidationError,'capacity'):
            schedule_order(items,self.delivery,self.store,now=self.now)
