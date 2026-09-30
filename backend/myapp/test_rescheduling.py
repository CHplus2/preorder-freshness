from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderItem, OrderAmendment, Product, Storefront, KitchenBlock
from .views.rescheduling import SALT


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ReschedulingTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('buyer')
        self.other = User.objects.create_user('other')
        self.owner = User.objects.create_user('owner', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.buyer)
        Storefront.objects.create(pk=1)
        self.product = Product.objects.create(name='Lunch', price=12, lead_hours=1, daily_capacity=1)
        self.delivery = (timezone.localtime()+timedelta(days=4)).replace(hour=16, minute=0, second=0, microsecond=0)
        self.target = self.delivery+timedelta(days=1)
        self.order = Order.objects.create(user=self.buyer, delivery_at=self.delivery,
            preparation_at=self.delivery-timedelta(hours=3), total_amount=12, shipping_fee=5,
            payment_status='paid', payment_method='cod')
        self.item = OrderItem.objects.create(order=self.order, product=self.product,
            product_name='Lunch', unit_price=12, subtotal=12, quantity=1)
        self.url = f'/api/orders/{self.order.pk}/reschedule/'

    def preview(self, target=None):
        return self.client.post(self.url, {'delivery_at':(target or self.target).isoformat(),
            'reason':'Work hours changed'}, format='json')

    def confirm(self, preview):
        return self.client.post(self.url, {'confirm':preview.data['confirm']}, format='json')

    def test_preview_has_no_mutation_and_confirm_preserves_terms(self):
        self.product.price=99
        self.product.preparation_minutes=200
        self.product.save()
        before=self.item.preparation_snapshot.copy()
        preview=self.preview()
        self.assertEqual(preview.status_code,200,preview.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivery_at,self.delivery)
        self.assertFalse(OrderAmendment.objects.exists())
        result=self.confirm(preview)
        self.assertEqual(result.status_code,200,result.data)
        self.order.refresh_from_db();self.item.refresh_from_db()
        self.assertEqual(self.order.delivery_at,self.target)
        self.assertEqual(self.order.total_amount,12)
        self.assertEqual(self.order.shipping_fee,5)
        self.assertEqual(self.order.payment_status,'paid')
        self.assertEqual(self.item.preparation_snapshot,before)
        self.assertEqual(self.order.preparation_plan['minutes'],61)
        self.assertEqual(OrderAmendment.objects.count(),1)
        history=self.client.get(self.url).data['history']
        self.assertEqual(history[0]['reason'],'Work hours changed')
        self.assertEqual(history[0]['by'],'customer')
        self.assertNotIn('plan',history[0])
        self.client.force_authenticate(self.owner)
        recipe=self.client.get(f'/api/admin/orders/{self.order.pk}/accepted-recipe/')
        self.assertEqual(recipe.status_code,200)
        self.assertEqual(recipe.data['amendments'],[])

    def test_retry_returns_current_order_without_second_change(self):
        preview=self.preview();self.confirm(preview)
        second=self.preview(self.target+timedelta(days=1));self.confirm(second)
        result=self.confirm(preview)
        self.assertEqual(result.status_code,200)
        self.assertTrue(result.data['already_applied'])
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivery_at,self.target+timedelta(days=1))
        self.assertEqual(OrderAmendment.objects.count(),2)

    def test_private_to_customer_or_owner(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).status_code,404)
        self.assertEqual(self.preview().status_code,404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code,[401,403])
        self.client.force_authenticate(self.owner)
        preview=self.preview();self.assertEqual(self.confirm(preview).status_code,200)
        self.assertEqual(self.client.get(self.url).data['history'][0]['by'],'owner')

    def test_preview_bound_to_actor(self):
        preview=self.preview()
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.confirm(preview).status_code,400)

    def test_stale_order_does_not_apply(self):
        preview=self.preview()
        self.order.save()
        self.assertEqual(self.confirm(preview).status_code,409)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_expired_and_tampered_preview(self):
        preview=self.preview()
        with patch('django.core.signing.time.time',return_value=timezone.now().timestamp()+601):
            self.assertEqual(self.confirm(preview).status_code,400)
        self.assertEqual(self.client.post(self.url,{'confirm':preview.data['confirm']+'bad'},format='json').status_code,400)

    def test_exact_cutoff_and_later_are_blocked(self):
        cutoff=self.order.preparation_at-timedelta(hours=24)
        with patch('myapp.views.rescheduling.timezone.now',return_value=cutoff):
            self.assertFalse(self.client.get(self.url).data['eligible'])
            self.assertEqual(self.preview().status_code,400)

    def test_status_and_refund_guards(self):
        for status in ['processing','cooked','shipped','delivered','cancelled']:
            self.order.status=status;self.order.save()
            self.assertEqual(self.preview().status_code,400)
        self.order.status='pending';self.order.payment_status='refunded';self.order.save()
        self.assertEqual(self.preview().status_code,400)

    def test_capacity_is_rechecked_on_confirm(self):
        preview=self.preview()
        other=Order.objects.create(user=self.other,delivery_at=self.target)
        OrderItem.objects.create(order=other,product=self.product,product_name='Lunch',quantity=1,unit_price=12,subtotal=12)
        self.assertEqual(self.confirm(preview).status_code,400)
        self.order.refresh_from_db();self.assertEqual(self.order.delivery_at,self.delivery)

    def test_changed_task_availability_needs_new_preview(self):
        preview=self.preview()
        data=signing.loads(preview.data['confirm'],salt=SALT)
        from django.utils.dateparse import parse_datetime
        end=parse_datetime(data['preparation_end_at'])
        KitchenBlock.objects.create(start_at=end-timedelta(minutes=10),end_at=end,reason='Kitchen break')
        self.assertEqual(self.confirm(preview).status_code,409)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_same_day_excludes_own_daily_capacity(self):
        self.assertEqual(self.preview(self.delivery+timedelta(hours=1)).status_code,200)

    def test_invalid_dates_reasons_and_removed_menu(self):
        for payload in [{'delivery_at':'bad','reason':'x'},
                        {'delivery_at':self.target.isoformat(),'reason':'  '},
                        {'delivery_at':self.target.isoformat(),'reason':'x'*301}]:
            self.assertEqual(self.client.post(self.url,payload,format='json').status_code,400)
        self.assertEqual(self.preview(self.delivery).status_code,400)
        self.assertEqual(self.preview(self.target+timedelta(days=100)).status_code,400)
        self.product.delete()
        self.assertEqual(self.preview().status_code,400)

    def test_new_preparation_also_requires_cutoff(self):
        now=self.target-timedelta(hours=20)
        self.order.preparation_at=self.target+timedelta(days=3)
        self.order.save()
        with patch('myapp.views.rescheduling.timezone.now',return_value=now):
            self.assertEqual(self.preview().status_code,400)

    def test_original_preview_cannot_overwrite_started_order(self):
        preview=self.preview()
        self.order.status='processing';self.order.save()
        self.assertEqual(self.confirm(preview).status_code,400)
        self.assertFalse(OrderAmendment.objects.exists())
