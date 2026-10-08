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
