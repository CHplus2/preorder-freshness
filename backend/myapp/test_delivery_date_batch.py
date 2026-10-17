from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from .models import Order, OrderItem, OrderAmendment, Product, Storefront, PaymentEvent


class DemoDeliveryDateBatchTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('batch-owner',is_staff=True)
        self.buyer=User.objects.create_user('batch-buyer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.store=Storefront.objects.create(pk=1,delivery_buffer_minutes=90)
        self.menu=Product.objects.create(name='Nasi Ayam Black Pepper',price=10,lead_hours=24,daily_capacity=4)
        self.url='/api/admin/orders/missing-delivery-dates/'

    def order(self,product=None,**values):
        order=Order.objects.create(user=self.buyer,total_amount=20,**values)
        product=product or self.menu
        OrderItem.objects.create(order=order,product=product,product_name=product.name,quantity=2,unit_price=10,subtotal=20)
        return order

    def preview(self):return self.client.post(self.url,{},format='json')
    def apply(self,preview,**extra):return self.client.post(self.url,{'confirm':preview.data['confirm'],'confirm_fictional':True,**extra},format='json')

    def test_preview_is_read_only_and_eleven_dates_apply_without_changing_payment_stock_or_history(self):
        orders=[self.order(payment_status='paid' if i%2 else 'unpaid') for i in range(11)]
        historical=self.order(status='delivered',payment_status='paid',delivery_at=timezone.now()-timedelta(days=10))
        before={order.pk:order.payment_status for order in orders}
        item_before=list(OrderItem.objects.order_by('pk').values('id','preparation_snapshot','recipe_source'))
        preview=self.preview();self.assertEqual(preview.status_code,200,preview.data)
        proposals=preview.data['proposed_dates'];self.assertEqual(len(proposals),11)
        self.assertEqual(len({row['delivery_at'] for row in proposals}),11)
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertTrue(all(order.delivery_at is None for order in Order.objects.filter(pk__in=before)))
        for row in proposals:
            target=parse_datetime(row['delivery_at']);self.assertGreater(target,timezone.now()+timedelta(hours=24))
            self.assertEqual(timezone.localtime(target).hour,18)
        result=self.apply(preview);self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['remaining_missing_dates'],0)
        for order in Order.objects.filter(pk__in=before):
            self.assertEqual(order.payment_status,before[order.pk]);self.assertEqual(order.status,'pending')
            self.assertIsNotNone(order.delivery_at);self.assertIsNone(order.preparation_at)
            self.assertIsNone(order.preparation_end_at);self.assertFalse(order.inventory_deducted)
            self.assertTrue(order.preparation_plan['needs_review']);self.assertEqual(order.preparation_plan['tasks'],[])
        self.assertEqual(list(OrderItem.objects.order_by('pk').values('id','preparation_snapshot','recipe_source')),item_before)
        self.assertEqual(OrderAmendment.objects.count(),11);self.assertFalse(PaymentEvent.objects.exists())
        historical.refresh_from_db();self.assertEqual(historical.status,'delivered')
        self.assertEqual(historical.delivery_at.date(),(timezone.now()-timedelta(days=10)).date())
        history=self.client.get(f'/api/orders/{orders[0].pk}/reschedule/').data['history']
        self.assertIsNone(history[0]['previous_delivery']);self.assertEqual(history[0]['by'],'owner')

    def test_staff_and_explicit_fictional_confirmation_are_required(self):
        order=self.order();preview=self.preview()
        for value in [False,None,'true']:
            self.assertEqual(self.apply(preview,confirm_fictional=value).status_code,400)
        self.client.force_authenticate(self.buyer);self.assertEqual(self.preview().status_code,403)
        self.client.force_authenticate(None);self.assertIn(self.preview().status_code,[401,403])
        order.refresh_from_db();self.assertIsNone(order.delivery_at)

    def test_skips_started_refunded_reserved_missing_and_archived_requests(self):
        rows=[self.order(status='processing'),self.order(payment_status='refunded'),self.order(inventory_deducted=True),
              self.order(preparation_at=timezone.now()),self.order(preparation_plan={'tasks':[{'name':'Reserved'}]})]
        archived=Product.objects.create(name='Old rice',price=5,selling_status='archived')
        rows.append(self.order(archived))
        unlinked=self.order();unlinked.items.update(product=None);rows.append(unlinked)
        eligible=self.order()
        data=self.preview().data
        self.assertEqual([row['order_id'] for row in data['proposed_dates']],[eligible.pk])
        self.assertEqual({row['order_id'] for row in data['skipped']},{row.pk for row in rows})

    def test_notice_weekdays_and_existing_capacity_are_respected(self):
        self.menu.lead_hours=72;self.menu.delivery_weekdays=[0];self.menu.save()
        order=self.order()
        target=parse_datetime(self.preview().data['proposed_dates'][0]['delivery_at'])
        self.assertEqual(timezone.localtime(target).weekday(),0)
        self.assertGreater(target,timezone.now()+timedelta(hours=72,minutes=90))
        booked=self.order(delivery_at=target)
        booked.items.update(quantity=4)
        later=parse_datetime(self.preview().data['proposed_dates'][0]['delivery_at'])
        self.assertGreater(later,target)
        order.refresh_from_db();self.assertIsNone(order.delivery_at)

    def test_incompatible_menu_days_are_reported_without_changing_other_orders(self):
        self.menu.delivery_weekdays=[0];self.menu.save()
        tuesday=Product.objects.create(name='Tuesday dish',price=10,delivery_weekdays=[1])
        mixed=self.order()
        OrderItem.objects.create(order=mixed,product=tuesday,product_name=tuesday.name,quantity=1,unit_price=10,subtotal=10)
        eligible=self.order()
        preview=self.preview();self.assertEqual(preview.status_code,200,preview.data)
        self.assertEqual([row['order_id'] for row in preview.data['proposed_dates']],[eligible.pk])
        self.assertEqual(preview.data['skipped'][0]['order_id'],mixed.pk)
        self.assertIn('No compatible',preview.data['skipped'][0]['reason'])

    def test_stale_order_menu_store_or_capacity_needs_a_new_preview(self):
        order=self.order()
        for change in [lambda:Order.objects.filter(pk=order.pk).update(total_amount=21,updated_at=timezone.now()),
                       lambda:Product.objects.filter(pk=self.menu.pk).update(daily_capacity=5),
                       lambda:Storefront.objects.filter(pk=1).update(delivery_buffer_minutes=120),
                       lambda:self.order(delivery_at=parse_datetime(self.preview().data['proposed_dates'][0]['delivery_at']))]:
            preview=self.preview();change()
            self.assertEqual(self.apply(preview).status_code,409)
            order.refresh_from_db();self.assertIsNone(order.delivery_at)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_confirmation_is_idempotent_and_does_not_restore_a_later_changed_date(self):
        order=self.order();preview=self.preview();self.assertEqual(self.apply(preview).status_code,200)
        order.refresh_from_db();later=order.delivery_at+timedelta(days=1)
        Order.objects.filter(pk=order.pk).update(delivery_at=later)
        retry=self.apply(preview)
        self.assertEqual(retry.status_code,200);self.assertTrue(retry.data['already_applied'])
        order.refresh_from_db();self.assertEqual(order.delivery_at,later);self.assertEqual(OrderAmendment.objects.count(),1)

    def test_actor_bound_expired_or_tampered_previews_cannot_apply(self):
        self.order();preview=self.preview()
        other=User.objects.create_user('other-owner',is_staff=True)
        self.client.force_authenticate(other);self.assertEqual(self.apply(preview).status_code,400)
        self.client.force_authenticate(self.owner)
        with patch('django.core.signing.time.time',return_value=timezone.now().timestamp()+601):
            self.assertEqual(self.apply(preview).status_code,400)
        self.assertEqual(self.apply(preview,confirm=preview.data['confirm']+'bad').status_code,400)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_a_later_failure_rolls_back_the_whole_batch(self):
        orders=[self.order(),self.order()];preview=self.preview()
        from .services.initial_delivery import initial_delivery_plan
        calls=0
        def interrupted(*args,**kwargs):
            nonlocal calls
            calls+=1
            if calls==2:raise ValidationError('Revalidation failed')
            return initial_delivery_plan(*args,**kwargs)
        with patch('myapp.views.delivery_date_batch.initial_delivery_plan',side_effect=interrupted):
            self.assertEqual(self.apply(preview).status_code,400)
        self.assertTrue(all(order.delivery_at is None for order in Order.objects.filter(pk__in=[o.pk for o in orders])))
        self.assertFalse(OrderAmendment.objects.exists())
