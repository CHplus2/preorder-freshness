from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, Storefront, KitchenBlock


class ManualPlanTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('owner',is_staff=True)
        self.buyer=User.objects.create_user('buyer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        Storefront.objects.create(pk=1)
        self.start=(timezone.localtime()+timedelta(days=4)).replace(hour=10,minute=0,second=0,microsecond=0)
        self.end=self.start+timedelta(hours=2)
        self.order=Order.objects.create(user=self.buyer,delivery_at=self.start.replace(hour=17),preparation_plan={'needs_review':True,'tasks':[]})
        self.url=f'/api/admin/orders/{self.order.pk}/manual-plan/'
        self.body={'start':self.start.isoformat(),'end':self.end.isoformat(),'reason':'Owner reviewed the recipe and workload'}

    def preview(self):
        response=self.client.post(self.url,self.body,format='json')
        self.assertEqual(response.status_code,200,response.data)
        return response.data

    def test_preview_confirm_audit_retry_and_start_preparation(self):
        preview=self.preview()
        self.order.refresh_from_db();self.assertIsNone(self.order.preparation_at)
        result=self.client.post(self.url,{'confirm':preview['confirm']},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.order.refresh_from_db()
        self.assertFalse(self.order.preparation_plan['needs_review'])
        self.assertEqual(self.order.preparation_at,self.start)
        self.assertEqual(self.order.preparation_plan['tasks'][0]['resource'],'all')
        self.assertEqual(self.order.payment_status,'unpaid')
        retry=self.client.post(self.url,{'confirm':preview['confirm']},format='json')
        self.assertTrue(retry.data['already_applied'])
        self.assertEqual(self.order.amendments.count(),1)
        self.assertEqual(len(self.client.get(self.url).data['history']),1)
        status=self.client.patch(f'/api/admin/orders/{self.order.pk}/',{'status':'processing'},format='json')
        self.assertEqual(status.status_code,200,status.data)

    def test_overlap_and_closure_are_disclosed_and_changed_warning_invalidates_preview(self):
        Order.objects.create(user=self.buyer,delivery_at=self.order.delivery_at,preparation_at=self.start,preparation_end_at=self.end)
        preview=self.preview()
        self.assertTrue(any('Overlaps preparation' in w for w in preview['preview']['warnings']))
        KitchenBlock.objects.create(start_at=self.start,end_at=self.end,reason='Unavailable')
        response=self.client.post(self.url,{'confirm':preview['confirm']},format='json')
        self.assertEqual(response.status_code,409)
        self.order.refresh_from_db();self.assertIsNone(self.order.preparation_at)

    def test_customer_cannot_view_or_edit_owner_plan(self):
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.get(self.url).status_code,403)
        self.assertEqual(self.client.post(self.url,self.body,format='json').status_code,403)

    def test_invalid_dates_and_tampered_confirmation_are_rejected(self):
        for start,end in [(self.end,self.start),(timezone.now()-timedelta(days=1),self.end),(self.start,self.order.delivery_at)]:
            response=self.client.post(self.url,dict(self.body,start=start.isoformat(),end=end.isoformat()),format='json')
            self.assertEqual(response.status_code,400,response.data)
        self.assertEqual(self.client.post(self.url,{'confirm':'bad-token'},format='json').status_code,400)

    def test_replaces_generated_tasks_but_preserves_them_in_history(self):
        old={'tasks':[{'name':'Bake','start':self.start.isoformat(),'end':self.end.isoformat(),'worker':True,'resource':'oven'}]}
        self.order.preparation_plan=old;self.order.preparation_at=self.start;self.order.preparation_end_at=self.end;self.order.save()
        preview=self.preview()
        self.assertEqual(self.client.post(self.url,{'confirm':preview['confirm']},format='json').status_code,200)
        self.assertEqual(self.order.amendments.get().before['plan'],old)

    def test_order_changes_invalidate_preview_and_started_orders_cannot_be_edited(self):
        preview=self.preview()
        self.order.status='cancelled';self.order.save()
        self.assertEqual(self.client.post(self.url,{'confirm':preview['confirm']},format='json').status_code,400)

    def test_cross_day_window_discloses_continuous_reservation(self):
        self.body['start']=(self.start-timedelta(days=1)).replace(hour=19).isoformat()
        self.assertTrue(any('entire window' in w for w in self.preview()['preview']['warnings']))


class StepPlanTests(TestCase):
    def setUp(self):
        ManualPlanTests.setUp(self)
        self.tasks=[dict(name='Bake',menu='Test dish',product_id=1,batch_number=None,sequence=1,
            start=self.start.isoformat(),end=(self.start+timedelta(hours=1)).isoformat(),
            resource='oven',worker=False,overnight=False,minutes=60,max_wait_minutes=30),
            dict(name='Pack',menu='Test dish',product_id=1,batch_number=None,sequence=2,
            start=(self.start+timedelta(hours=1)).isoformat(),end=(self.start+timedelta(minutes=75)).isoformat(),
            resource='packing_area',worker=True,overnight=False,minutes=15,max_wait_minutes=0)]
        self.order.preparation_plan={'tasks':self.tasks,'minutes':75,'hands_on_minutes':15,
            'lines':[dict(product_id=1,max_early_minutes=120,max_preparation_days=2)]}
        self.order.preparation_at=self.start;self.order.preparation_end_at=self.start+timedelta(minutes=75);self.order.save()
        self.body=dict(mode='steps',reason='Reviewed individual timings',steps=[dict(index=i,start=t['start']) for i,t in enumerate(self.tasks)])

    def preview(self):
        return ManualPlanTests.preview(self)

    def test_step_edits_preserve_recipe_durations_resources_and_audit(self):
        self.body['steps'][0].update(start=(self.start+timedelta(hours=1)).isoformat(),resource='none',minutes=1)
        self.body['steps'][1]['start']=(self.start+timedelta(hours=2)).isoformat()
        preview=self.preview()
        self.assertEqual(len(preview['preview']['task_times']),2)
        result=self.client.post(self.url,{'confirm':preview['confirm']},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.order.refresh_from_db()
        plan=self.order.preparation_plan
        self.assertEqual(plan['mode'],'manual_tasks')
        self.assertEqual(plan['tasks'][0]['resource'],'oven')
        self.assertEqual(plan['tasks'][0]['minutes'],60)
        self.assertEqual(plan['hands_on_minutes'],15)
        self.assertEqual(self.order.amendments.get().before['plan']['tasks'],self.tasks)
        self.assertTrue(self.client.post(self.url,{'confirm':preview['confirm']},format='json').data['already_applied'])

    def test_dropped_duplicate_or_reordered_recipe_steps_are_rejected(self):
        for changes in [self.body['steps'][:1],[self.body['steps'][0]]*2,
                [dict(index=0,start=self.tasks[1]['start']),dict(index=1,start=self.tasks[0]['start'])]]:
            response=self.client.post(self.url,dict(self.body,steps=changes),format='json')
            self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(self.order.amendments.exists())

    def test_cross_day_step_gap_warns_without_reserving_the_gap(self):
        self.body['steps'][0]['start']=(self.start-timedelta(days=1)).isoformat()
        preview=self.preview()
        self.assertTrue(any('waiting limit' in w for w in preview['preview']['warnings']))
        self.assertEqual(self.client.post(self.url,{'confirm':preview['confirm']},format='json').status_code,200)
        self.order.refresh_from_db()
        self.assertEqual(len(self.order.preparation_plan['tasks']),2)
        self.assertEqual(self.order.preparation_plan['hands_on_minutes'],15)

    def test_equipment_aware_overlap_and_no_false_gap_closure_warning(self):
        other=Order.objects.create(user=self.buyer,delivery_at=self.order.delivery_at,preparation_at=self.start,
            preparation_end_at=self.start+timedelta(hours=1),preparation_plan={'tasks':[dict(self.tasks[0],resource='stove')]})
        self.assertFalse(any('Overlaps preparation' in w for w in self.preview()['preview']['warnings']))
        other.preparation_plan={'tasks':[self.tasks[0]]};other.save()
        self.assertTrue(any('Overlaps preparation' in w for w in self.preview()['preview']['warnings']))

    def test_window_plan_has_no_individual_recipe_steps_to_edit(self):
        self.order.preparation_plan['mode']='manual_window';self.order.save()
        self.assertEqual(self.client.post(self.url,self.body,format='json').status_code,400)

    def test_conflicting_step_within_order_is_disclosed(self):
        self.order.preparation_plan['tasks'][1].update(product_id=2,sequence=1,resource='oven')
        self.order.save()
        self.body['steps'][1]['start']=self.start.isoformat()
        self.assertTrue(any('Within this order' in w for w in self.preview()['preview']['warnings']))
