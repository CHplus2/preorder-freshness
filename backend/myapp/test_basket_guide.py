"""Whole-order budget, mixed quantity, atomic basket writes and real scheduler checks."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from django.contrib.auth.models import User
from django.db import IntegrityError, close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Category,Product,ProductIngredient,RawMaterial,Storefront,CartItem,Order,InventoryItem,RecommendationSession


class BasketGuideTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('mixed-buyer');self.other=User.objects.create_user('other-mixed-buyer')
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.store=Storefront.objects.create(pk=1,delivery_fee_myr=5,free_delivery_minimum_myr=None,bulk_minimum=10,bulk_discount_percent=10)
        self.category=Category.objects.create(name='Fixture meals');raw=RawMaterial.objects.create(name='Fixture rice',unit='g')
        self.menus=[]
        for index,price in enumerate(['12.00','8.50','10.00']):
            menu=Product.objects.create(name=f'Mixed menu {index}',price=price,category=self.category,lead_hours=1,daily_capacity=20,batch_size=10,max_early_minutes=120,preparation_tasks=[dict(name='Prepare',minutes=10,worker=True,resource='prep_table')])
            ProductIngredient.objects.create(product=menu,raw_material=raw,quantity_required=10);self.menus.append(menu)
        self.stock=InventoryItem.objects.create(raw_material=raw,quantity=1000,received_date=timezone.localdate(),expiry_date=timezone.localdate()+timedelta(days=30),storage_location='Fixture shelf')
        self.day=timezone.localdate()+timedelta(days=3);self.url='/api/menu/basket-guide/'
        self.slot=dict(delivery_at=str(self.day)+'T15:00:00+08:00')

    def guide(self,**changes):
        body={**dict(date=str(self.day),quantity=3,budget='100.00'),**changes}
        with patch('myapp.views.basket_guide.slots',return_value=[self.slot]):
            result=self.client.post(self.url,body,format='json')
        self.assertEqual(result.status_code,200,result.data);return result.data

    def body(self,data,plan=None):
        return dict(session=data['session'],plan=(plan or data['plans'][0])['id'],delivery_at=self.slot['delivery_at'])

    def one_menu(self,price='12.00'):
        Product.objects.exclude(pk=self.menus[0].pk).update(selling_status='paused')
        self.menus[0].price=price;self.menus[0].save();return self.menus[0]

    def test_three_means_three_total_mixed_items_not_three_of_each_menu(self):
        data=self.guide();plan=data['plans'][0]
        self.assertEqual(len(plan['items']),3);self.assertEqual(sum(item['quantity'] for item in plan['items']),3)
        self.assertTrue(all(item['quantity']==1 for item in plan['items']))
        self.assertEqual(plan['totals'],dict(subtotal='30.50',discount='0.00',shipping='5.00',total='35.50',quantity=3))
        self.assertEqual(data['budget']['basis'],'whole_order_after_discount_and_delivery')
        self.assertEqual(CartItem.objects.count(),0);self.assertEqual(Order.objects.count(),0)
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)

    def test_existing_item_counts_toward_target_and_is_preserved(self):
        CartItem.objects.create(user=self.user,product=self.menus[0],quantity=1)
        data=self.guide();plan=data['plans'][0]
        self.assertEqual(data['current_quantity'],1);self.assertEqual(sum(item['add_quantity'] for item in plan['items']),2)
        kept=next(item for item in plan['items'] if item['id']==self.menus[0].pk)
        self.assertEqual(kept['existing_quantity'],1);self.assertGreaterEqual(kept['quantity'],1)
        result=self.client.post(self.url+'add/',self.body(data),format='json');self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(sum(CartItem.objects.filter(user=self.user).values_list('quantity',flat=True)),3)

    def test_whole_order_budget_includes_existing_basket_and_delivery(self):
        menu=self.one_menu('35.00');CartItem.objects.create(user=self.user,product=menu,quantity=2)
        within=self.guide(budget_mode='within');self.assertEqual(within['plans'],[])
        above=self.guide(budget_mode='above');self.assertEqual(above['plans'][0]['totals']['total'],'110.00')
        self.assertEqual(above['plans'][0]['items'][0]['add_quantity'],1)

    def test_current_discount_free_delivery_and_pickup_are_quoted_before_budget_filter(self):
        self.one_menu();self.store.bulk_minimum=3;self.store.save()
        data=self.guide(budget='38.00');self.assertEqual(data['plans'][0]['totals']['total'],'37.40')
        self.store.free_delivery_minimum_myr=35;self.store.save()
        data=self.guide(budget='33.00');self.assertEqual(data['plans'][0]['totals']['total'],'32.40')
        self.store.free_delivery_minimum_myr=None;self.store.pickup_enabled=True;self.store.pickup_location='Fixture pickup';self.store.save()
        data=self.guide(budget='33.00',delivery_method='pickup');self.assertEqual(data['plans'][0]['totals']['shipping'],'0.00')

    def test_capacity_checks_receive_the_complete_basket_and_a_common_time(self):
        seen=[]
        def availability(items,*args):
            seen.append([(item.product_id,item.quantity) for item in items]);return [self.slot]
        with patch('myapp.views.basket_guide.slots',side_effect=availability):
            result=self.client.post(self.url,dict(date=str(self.day),quantity=3),format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(sum(q for _,q in seen[0]),3);self.assertEqual(len(seen[0]),3)
        self.assertTrue(all(sum(q for _,q in request)==3 for request in seen))

    def test_success_is_atomic_idempotent_and_reserves_no_kitchen_or_stock(self):
        data=self.guide();payload=self.body(data)
        first=self.client.post(self.url+'add/',payload,format='json');self.assertEqual(first.status_code,200,first.data)
        second=self.client.post(self.url+'add/',payload,format='json');self.assertEqual(second.status_code,200,second.data)
        self.assertTrue(second.data['already_applied']);self.assertEqual(CartItem.objects.count(),3)
        self.assertEqual(sum(CartItem.objects.values_list('quantity',flat=True)),3);self.assertEqual(Order.objects.count(),0)
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,1000)
        if len(data['plans'])>1:self.assertEqual(self.client.post(self.url+'add/',self.body(data,data['plans'][1]),format='json').status_code,409)

    def test_stale_basket_prices_or_delivery_terms_cannot_apply(self):
        for change in ['basket','price','delivery']:
            with self.subTest(change=change):
                CartItem.objects.all().delete();data=self.guide()
                if change=='basket':CartItem.objects.create(user=self.user,product=self.menus[0],quantity=1)
                elif change=='price':Product.objects.filter(pk=self.menus[0].pk).update(price=Decimal('99.00'))
                else:self.store.delivery_fee_myr=10;self.store.save()
                before=list(CartItem.objects.values_list('product_id','quantity'))
                result=self.client.post(self.url+'add/',self.body(data),format='json')
                self.assertEqual(result.status_code,409,result.data);self.assertEqual(list(CartItem.objects.values_list('product_id','quantity')),before)
                Product.objects.filter(pk=self.menus[0].pk).update(price=Decimal('12.00'))

    def test_changed_kitchen_availability_rejects_without_partial_addition(self):
        from rest_framework.exceptions import ValidationError
        data=self.guide()
        with patch('myapp.services.scheduling.schedule_order',side_effect=ValidationError('Fixture full kitchen')):
            result=self.client.post(self.url+'add/',self.body(data),format='json')
        self.assertEqual(result.status_code,409);self.assertFalse(CartItem.objects.exists())
        self.assertNotIn('applied',RecommendationSession.objects.get(pk=data['session']).context)

    def test_failure_during_bulk_write_rolls_back_every_item_and_the_applied_marker(self):
        data=self.guide();write=CartItem.objects.update_or_create;calls=[]
        def interrupted(*args,**kwargs):
            calls.append(kwargs)
            if len(calls)==2:raise IntegrityError('Fixture interrupted basket write')
            return write(*args,**kwargs)
        with patch.object(CartItem.objects,'update_or_create',side_effect=interrupted):
            response=self.client.post(self.url+'add/',self.body(data),format='json')
        self.assertEqual(response.status_code,409,response.data)
        self.assertEqual(len(calls),2);self.assertFalse(CartItem.objects.exists())
        self.assertNotIn('applied',RecommendationSession.objects.get(pk=data['session']).context)

    def test_actor_session_csrf_and_returned_time_are_required(self):
        data=self.guide();payload=self.body(data)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(self.url+'add/',payload,format='json').status_code,400)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url+'add/',payload,format='json').status_code,403)
        self.client.force_authenticate(self.user)
        data=self.guide();payload=self.body(data)
        bad=dict(payload,delivery_at=str(self.day)+'T16:00:00+08:00')
        self.assertEqual(self.client.post(self.url+'add/',bad,format='json').status_code,400)
        self.assertEqual(self.client.post(self.url+'add/',dict(payload,price='0.01'),format='json').status_code,400)
        self.assertFalse(CartItem.objects.exists())
        self.user.set_password('Fixture-Mixed-2026!');self.user.save()
        csrf=APIClient(enforce_csrf_checks=True);csrf.force_login(self.user)
        self.assertEqual(csrf.post(self.url+'add/',payload,format='json').status_code,403)

    def test_oversized_existing_basket_is_not_removed_and_full_target_is_review_only(self):
        CartItem.objects.create(user=self.user,product=self.menus[0],quantity=4)
        data=self.guide();self.assertEqual(data['empty_reason'],'quantity_below_basket');self.assertEqual(data['plans'],[])
        data=self.guide(quantity=4);self.assertEqual(sum(item['add_quantity'] for item in data['plans'][0]['items']),0)
        self.assertEqual(self.client.post(self.url+'add/',self.body(data),format='json').status_code,400)
        self.assertEqual(CartItem.objects.get(user=self.user).quantity,4)

    def test_unconfirmed_guest_search_cannot_apply_after_login_without_a_new_search(self):
        self.client.force_authenticate(None);data=self.guide();self.assertFalse(data['basket_known'])
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(self.url+'add/',self.body(data),format='json').status_code,400)

    def test_budget_ranges_are_partitioned_before_three_result_limit(self):
        product=self.menus[-1];product.price=60;product.save()
        data=self.guide(budget_mode='all')
        self.assertLessEqual(len(data['plans']),3);self.assertEqual({p['budget_relation'] for p in data['plans']},{'within','above'})
        within=self.guide(budget_mode='within');above=self.guide(budget_mode='above')
        self.assertTrue(all(Decimal(p['totals']['total'])<=100 for p in within['plans']))
        self.assertTrue(all(Decimal(p['totals']['total'])>100 for p in above['plans']))
        self.assertGreaterEqual(len(above['plans'][0]['items']),2)

    def test_larger_quantities_respect_menu_caps_and_keep_capacity_work_bounded(self):
        raw=self.stock.raw_material
        for number in range(9):
            menu=Product.objects.create(name=f'Large-order fixture {number}',price=10,category=self.category,daily_capacity=10)
            ProductIngredient.objects.create(product=menu,raw_material=raw,quantity_required=10)
        with patch('myapp.views.basket_guide.slots',return_value=[self.slot]) as checked:
            result=self.client.post(self.url,dict(date=str(self.day),quantity=100,budget='2000'),format='json')
        self.assertEqual(result.status_code,200,result.data);self.assertTrue(result.data['plans'])
        self.assertLessEqual(checked.call_count,30)
        caps=dict(Product.objects.values_list('pk','daily_capacity'))
        for plan in result.data['plans']:
            self.assertEqual(sum(item['quantity'] for item in plan['items']),100)
            self.assertTrue(all(item['quantity']<=caps[item['id']] for item in plan['items']))

    def test_exact_whole_order_total_is_within_and_input_ranges_are_validated(self):
        self.one_menu()
        data=self.guide(budget='41.00');self.assertEqual(data['plans'][0]['budget_relation'],'within')
        data=self.guide(budget='41.00',budget_mode='above');self.assertEqual(data['plans'],[])
        for changes in [dict(quantity=0),dict(quantity=101),dict(budget='0.00'),dict(budget_mode='invalid'),dict(date='bad')]:
            body=dict(date=str(self.day),quantity=3,**changes) if 'quantity' not in changes and 'date' not in changes else {**dict(date=str(self.day),quantity=3),**changes}
            self.assertEqual(self.client.post(self.url,body,format='json').status_code,400)

    def test_expired_suggestion_does_not_add_and_repeat_reports_later_basket_change(self):
        data=self.guide();RecommendationSession.objects.filter(pk=data['session']).update(created_at=timezone.now()-timedelta(minutes=16))
        self.assertEqual(self.client.post(self.url+'add/',self.body(data),format='json').status_code,400)
        data=self.guide();payload=self.body(data);self.assertEqual(self.client.post(self.url+'add/',payload,format='json').status_code,200)
        item=CartItem.objects.filter(user=self.user).first();item.quantity+=1;item.save()
        result=self.client.post(self.url+'add/',payload,format='json');self.assertEqual(result.status_code,200,result.data)
        self.assertTrue(result.data['already_applied']);self.assertTrue(result.data['basket_changed'])
        self.assertEqual(sum(CartItem.objects.values_list('quantity',flat=True)),4)


class BasketGuideConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update')
    def test_overlapping_confirmations_add_the_complete_basket_once(self):
        user=User.objects.create_user('parallel-basket-buyer');Storefront.objects.create(pk=1)
        raw=RawMaterial.objects.create(name='Parallel fixture rice',unit='g')
        for n in range(3):
            menu=Product.objects.create(name=f'Parallel meal {n}',price=10)
            ProductIngredient.objects.create(product=menu,raw_material=raw,quantity_required=10)
        client=APIClient();client.force_authenticate(user);day=timezone.localdate()+timedelta(days=3)
        delivery=str(day)+'T15:00:00+08:00'
        with patch('myapp.views.basket_guide.slots',return_value=[dict(delivery_at=delivery)]):
            data=client.post('/api/menu/basket-guide/',dict(date=str(day),quantity=3),format='json').data
        payload=dict(session=data['session'],plan=data['plans'][0]['id'],delivery_at=delivery)
        entered,release=Event(),Event()
        def scheduled(*args,**kwargs):
            entered.set()
            if not release.wait(5):raise RuntimeError('Fixture synchronization timeout')
            return {}
        def confirm():
            close_old_connections()
            try:
                actor=APIClient();actor.force_authenticate(user);actor.cookies=client.cookies.copy()
                return actor.post('/api/menu/basket-guide/add/',payload,format='json')
            finally:close_old_connections()
        with patch('myapp.services.scheduling.schedule_order',side_effect=scheduled) as scheduler,ThreadPoolExecutor(max_workers=2) as pool:
            first=pool.submit(confirm)
            try:
                self.assertTrue(entered.wait(5));second=pool.submit(confirm)
            finally:release.set()
            results=[first.result(timeout=10),second.result(timeout=10)]
        self.assertTrue(all(result.status_code==200 for result in results),[result.data for result in results])
        self.assertEqual(sorted(result.data['already_applied'] for result in results),[False,True])
        self.assertEqual(scheduler.call_count,1);self.assertEqual(sum(CartItem.objects.values_list('quantity',flat=True)),3)
        self.assertEqual(Order.objects.count(),0)
