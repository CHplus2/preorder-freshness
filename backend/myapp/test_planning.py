from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from django.db import connection, OperationalError
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from .models import Product, Storefront, Order, OrderItem, CartItem, Address, KitchenBlock
from .services.scheduling import schedule_order, preparation_work, plan_snapshot
from .services.forecast import estimate
from .serializers import ProductSerializer

class PlanningTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('owner',is_staff=True)
        self.user=User.objects.create_user('buyer')
        self.store=Storefront.objects.create(pk=1)
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.now=timezone.localtime().replace(hour=8,minute=0,second=0,microsecond=0)
        self.delivery=(self.now+timedelta(days=7)).replace(hour=16)
        self.address=Address.objects.create(user=self.user,line1='A',city='KL',state='KL',postal_code='50000',phone='0123456789')
    def product(self,name='Food',**kw):
        return Product.objects.create(name=name,price=10,**kw)
    def item(self,p,qty=1):
        return SimpleNamespace(product=p,product_id=p.id,quantity=qty)
    def task(self,name='Bake',resource='oven',worker=False,minutes=40,**kw):
        return dict(name=name,resource=resource,worker=worker,minutes=minutes,additional_batch_minutes=0,max_wait_minutes=0,overnight=False,**kw)
    def book(self,p,plan):
        o=Order.objects.create(user=self.user,delivery_at=self.delivery,preparation_at=plan['start'],preparation_end_at=plan['end'],preparation_plan=plan_snapshot(plan))
        OrderItem.objects.create(order=o,product=p,product_name=p.name,unit_price=10,quantity=1,subtotal=10)
        return o
    def test_bulk_duration(self):
        p=self.product(batch_size=10,preparation_minutes=45,additional_batch_minutes=30)
        lines,total=preparation_work([self.item(p,25)])
        self.assertEqual(total,130);self.assertEqual(lines[0]['batches'],3)
    def test_distinct_unattended_resources_overlap(self):
        p=self.product(preparation_tasks=[self.task()]);a=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,a)
        q=self.product('Rice',preparation_tasks=[self.task(resource='rice_cooker')]);b=schedule_order([self.item(q)],self.delivery,self.store,now=self.now)
        self.assertEqual(a['start'],b['start'])
    def test_same_equipment_cannot_overlap(self):
        p=self.product(preparation_tasks=[self.task()]);a=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,a)
        q=self.product('Cake',preparation_tasks=[self.task()]);b=schedule_order([self.item(q)],self.delivery,self.store,now=self.now)
        self.assertLessEqual(b['end'],a['start'])
    def test_worker_cannot_overlap_different_equipment(self):
        p=self.product(preparation_tasks=[self.task(worker=True)]);a=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,a)
        q=self.product('Rice',preparation_tasks=[self.task(resource='stove',worker=True)]);b=schedule_order([self.item(q)],self.delivery,self.store,now=self.now)
        self.assertLessEqual(b['end'],a['start'])
    def test_multiday_rest_dependencies(self):
        rest=self.task(name='Chill',resource='fridge',minutes=5*1440);rest['overnight']=True
        p=self.product(preparation_tasks=[self.task(name='Prep',resource='prep_table',worker=True,minutes=15),rest,self.task(worker=True)])
        plan=schedule_order([self.item(p)],self.delivery,self.store,now=self.now)
        self.assertGreaterEqual((plan['end']-plan['start']).days,5)
        tasks=sorted(plan['tasks'],key=lambda t:t['sequence'])
        self.assertEqual(tasks[0]['end'],tasks[1]['start']);self.assertEqual(tasks[1]['end'],tasks[2]['start'])
    def test_block_rejects_booking_without_cancelling(self):
        p=self.product();KitchenBlock.objects.create(start_at=self.delivery-timedelta(days=1),end_at=self.delivery,reason='Closed')
        with self.assertRaises(ValidationError):schedule_order([self.item(p)],self.delivery,self.store,now=self.now)
        self.assertEqual(Order.objects.count(),0)
    def test_quote_capacity(self):
        p=self.product(daily_capacity=1);plan=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,plan);CartItem.objects.create(user=self.user,product=p,quantity=1)
        r=self.client.post('/api/orders/quote/',{'delivery_at':self.delivery.isoformat()},format='json')
        self.assertEqual(r.status_code,400);self.assertIn('capacity',str(r.data))
    def test_block_protected_by_permission_and_existing_order(self):
        p=self.product();plan=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,plan)
        data={'start_at':plan['start'].isoformat(),'end_at':plan['end'].isoformat(),'reason':'Break'}
        self.assertEqual(self.client.post('/api/admin/kitchen-blocks/',data).status_code,403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post('/api/admin/kitchen-blocks/',data).status_code,400)
        self.assertEqual(KitchenBlock.objects.count(),0)
    def test_task_validation(self):
        for tasks in [[self.task() | {'resource':[]}], 'bad',[{'name':'X','minutes':-1}],[self.task(worker=True,minutes=60) | {'overnight':True}]]:
            serializer=ProductSerializer(data={'name':'Bad','price':10,'preparation_tasks':tasks})
            self.assertFalse(serializer.is_valid())
    def test_invalid_ids_and_dates_are_client_errors(self):
        self.assertEqual(self.client.post('/api/cart/',{'product_id':'invalid'}).status_code,400)
        self.assertEqual(self.client.post('/api/orders/place/',{'address_id':'invalid'}).status_code,400)
        self.assertEqual(self.client.post('/api/orders/quote/',{'delivery_at':'bad'}).status_code,400)
    def test_database_failure_does_not_leak_details(self):
        with patch('myapp.services.scheduling.schedule_order',side_effect=OperationalError('private database password')):
            with self.assertLogs('myapp.exceptions',level='ERROR'):
                r=self.client.post('/api/orders/quote/',{'delivery_at':self.delivery.isoformat()})
        self.assertEqual(r.status_code,503);self.assertNotIn('password',str(r.data));self.assertIn('reference',r.data)
    def test_planner_queries_do_not_grow_per_order(self):
        self.client.force_authenticate(self.owner)
        p=self.product();plan=schedule_order([self.item(p)],self.delivery,self.store,now=self.now);self.book(p,plan)
        with CaptureQueriesContext(connection) as first:self.client.get('/api/admin/planning/')
        for _ in range(12):self.book(p,plan)
        with CaptureQueriesContext(connection) as second:r=self.client.get('/api/admin/planning/')
        self.assertEqual(r.status_code,200);self.assertEqual(len(r.data['orders']),13)
        self.assertLessEqual(len(second),len(first)+1)
    def test_review_eligibility(self):
        p=self.product();url=f'/api/products/{p.pk}/review-access/'
        self.assertFalse(self.client.get(url).data['eligible'])
        o=self.book(p,schedule_order([self.item(p)],self.delivery,self.store,now=self.now));o.status='delivered';o.save()
        self.assertTrue(self.client.get(url).data['eligible'])
        self.assertEqual(self.client.post(f'/api/products/{p.pk}/reviews/',{'rating':5,'comment':'Good'}).status_code,200)
        self.assertFalse(self.client.get(url).data['eligible'])
    def test_forecast_sparse_and_trend(self):
        self.assertIsNone(estimate([])['next_7_days_portions'])
        self.assertIsNone(estimate([2,0])['validation_mae'])
        result=estimate(list(range(1,57)))
        self.assertIn('Linear',result['method']);self.assertEqual(result['validation_mae'],0)
        self.assertEqual(result['next_7_days_portions'],sum(range(57,64)))

    def test_quote_is_advisory_and_snapshot_is_immutable(self):
        p=self.product(preparation_tasks=[self.task()])
        CartItem.objects.create(user=self.user,product=p,quantity=1)
        data={'delivery_at':self.delivery.isoformat(),'address_id':self.address.id,'payment':'cod'}
        self.assertEqual(self.client.post('/api/orders/quote/',data).status_code,200)
        self.assertEqual(Order.objects.count(),0)
        self.assertEqual(self.client.post('/api/orders/place/',data).status_code,201)
        o=Order.objects.get();snapshot=o.preparation_plan
        p.preparation_tasks=[self.task(minutes=120)];p.save()
        o.refresh_from_db();self.assertEqual(o.preparation_plan,snapshot)
        self.assertEqual(self.client.post('/api/orders/place/',data).status_code,400)
        self.assertEqual(Order.objects.count(),1)

    def test_shortages_exclude_batch_expiring_during_multiday_preparation(self):
        from .models import RawMaterial, ProductIngredient, InventoryItem
        material=RawMaterial.objects.create(name='Ingredient',unit='g')
        p=self.product();ProductIngredient.objects.create(product=p,raw_material=material,quantity_required=100)
        InventoryItem.objects.create(raw_material=material,quantity=100,received_date=timezone.localdate(),expiry_date=timezone.localdate()+timedelta(days=2),storage_location='Fridge')
        plan=schedule_order([self.item(p)],self.delivery,self.store,now=self.now)
        o=self.book(p,plan);o.preparation_at=self.now+timedelta(days=1);o.save()
        self.client.force_authenticate(self.owner)
        r=self.client.get('/api/admin/planning/')
        self.assertEqual(len(r.data['shopping']),1)
        self.assertEqual(r.data['allocations'],[])
