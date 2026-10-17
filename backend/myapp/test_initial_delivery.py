"""First-date repair is an owner request, independent of paid/delivered history."""
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderAmendment, OrderItem, Product, Storefront, PaymentEvent


class InitialDeliveryTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('date-owner',is_staff=True)
        self.buyer=User.objects.create_user('date-buyer')
        self.client=APIClient()
        self.client.force_authenticate(self.owner)
        Storefront.objects.create(pk=1)
        self.menu=Product.objects.create(name='Nasi Lemak Telur',price=7,lead_hours=24,daily_capacity=10)
        self.order=Order.objects.create(user=self.buyer,total_amount=14,shipping_fee=5)
        self.item=OrderItem.objects.create(order=self.order,product=self.menu,product_name=self.menu.name,
            quantity=2,unit_price=7,subtotal=14,preparation_snapshot={})
        # Creation snapshots current settings automatically; emulate a migrated legacy record.
        OrderItem.objects.filter(pk=self.item.pk).update(preparation_snapshot={})
        self.target=(timezone.localtime()+timedelta(days=5)).replace(hour=16,minute=0,second=0,microsecond=0)
        self.url=f'/api/orders/{self.order.pk}/reschedule/'

    def preview(self,target=None):
        return self.client.post(self.url,{'delivery_at':(target or self.target).isoformat(),'reason':'Agreed future request'},format='json')

    def confirm(self,preview):
        return self.client.post(self.url,{'confirm':preview.data['confirm']},format='json')

    def test_owner_previews_then_sets_first_date_without_fabricating_a_sale_or_accepted_plan(self):
        policy=self.client.get(self.url)
        self.assertEqual(policy.status_code,200)
        self.assertTrue(policy.data['eligible'])
        self.assertTrue(policy.data['initial_delivery'])
        self.assertIsNone(policy.data['cutoff'])
        preview=self.preview()
        self.assertEqual(preview.status_code,200,preview.data)
        self.assertIsNone(preview.data['preview']['previous_delivery'])
        self.assertTrue(preview.data['preview']['needs_review'])
        self.order.refresh_from_db();self.assertIsNone(self.order.delivery_at)
        self.assertFalse(OrderAmendment.objects.exists())
        result=self.confirm(preview)
        self.assertEqual(result.status_code,200,result.data)
        self.order.refresh_from_db();self.item.refresh_from_db()
        self.assertEqual(self.order.delivery_at,self.target)
        self.assertEqual(self.order.status,'pending')
        self.assertEqual(self.order.payment_status,'unpaid')
        self.assertEqual(self.order.total_amount,14)
        self.assertEqual(self.order.shipping_fee,5)
        self.assertFalse(self.order.inventory_deducted)
        self.assertIsNone(self.order.preparation_at)
        self.assertIsNone(self.order.preparation_end_at)
        self.assertEqual(self.order.preparation_plan['tasks'],[])
        self.assertTrue(self.order.preparation_plan['needs_review'])
        self.assertEqual(self.item.preparation_snapshot,{})
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertIsNone(OrderAmendment.objects.get().before['delivery_at'])
        history=self.client.get(self.url).data['history']
        self.assertIsNone(history[0]['previous_delivery'])
        self.assertEqual(history[0]['by'],'owner')
        self.assertTrue(self.confirm(preview).data['already_applied'])
        self.assertEqual(OrderAmendment.objects.count(),1)

    def test_customer_cannot_initialize_dates_or_use_owner_preview(self):
        preview=self.preview()
        self.client.force_authenticate(self.buyer)
        self.assertFalse(self.client.get(self.url).data['eligible'])
        self.assertEqual(self.preview().status_code,400)
        self.assertEqual(self.confirm(preview).status_code,400)
        self.order.refresh_from_db();self.assertIsNone(self.order.delivery_at)

    def test_first_date_checks_horizon_notice_delivery_hours_and_capacity(self):
        for target in [timezone.now()-timedelta(days=1),timezone.now()+timedelta(hours=2),
                       self.target.replace(hour=23),self.target+timedelta(days=100)]:
            self.assertEqual(self.preview(target).status_code,400)
        self.menu.daily_capacity=1;self.menu.save()
        self.assertEqual(self.preview().status_code,400)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_closed_started_refunded_or_stock_deducted_orders_cannot_be_initialized(self):
        for status in ['processing','cooked','shipped','delivered','cancelled']:
            self.order.status=status;self.order.save()
            self.assertFalse(self.client.get(self.url).data['eligible'])
            self.assertEqual(self.preview().status_code,400)
        self.order.status='pending';self.order.payment_status='refunded';self.order.save()
        self.assertEqual(self.preview().status_code,400)
        self.order.payment_status='unpaid';self.order.inventory_deducted=True;self.order.save()
        self.assertEqual(self.preview().status_code,400)

    def test_missing_or_archived_menu_links_require_review_instead_of_new_bookings(self):
        self.menu.selling_status='archived';self.menu.save()
        policy=self.client.get(self.url).data
        self.assertFalse(policy['eligible']);self.assertIn('archived menus',policy['reason'])
        self.assertEqual(self.preview().status_code,400)
        self.item.product=None;self.item.save()
        policy=self.client.get(self.url).data
        self.assertFalse(policy['eligible']);self.assertIn('Menu links are missing',policy['reason'])
        self.assertEqual(self.preview().status_code,400)
        self.item.delete()
        self.assertFalse(self.client.get(self.url).data['eligible'])

    def test_existing_preparation_reservations_are_not_erased(self):
        self.order.preparation_plan={'tasks':[{'name':'Already reserved'}]};self.order.save()
        self.assertFalse(self.client.get(self.url).data['eligible'])
        self.assertEqual(self.preview().status_code,400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.preparation_plan['tasks'],[{'name':'Already reserved'}])

    def test_stale_or_now_unavailable_preview_cannot_change_the_order(self):
        preview=self.preview()
        self.order.save()
        self.assertEqual(self.confirm(preview).status_code,409)
        preview=self.preview()
        self.menu.daily_capacity=1;self.menu.save()
        self.assertEqual(self.confirm(preview).status_code,400)
        self.order.refresh_from_db();self.assertIsNone(self.order.delivery_at)
        self.assertFalse(OrderAmendment.objects.exists())
