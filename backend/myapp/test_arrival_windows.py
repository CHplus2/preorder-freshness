"""Arrival ranges preserve dated capacity, accepted terms and notification consent."""
from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient
from .models import Product, ProductIngredient, RawMaterial, Storefront, Address, CartItem, Order, OrderReminder
from .services.reminders import send_due_reminders


@override_settings(EMAIL_HOST='smtp.example.test', EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
                   PUBLIC_APP_URL='https://kitchen.example', OWNER_NOTIFICATION_EMAIL='')
class ArrivalWindowTests(TestCase):
    def setUp(self):
        self.now=timezone.make_aware(datetime(2030,1,7,9))
        timer=patch('django.utils.timezone.now',return_value=self.now);timer.start();self.addCleanup(timer.stop)
        self.user=User.objects.create_user('window-buyer',email='buyer@example.test')
        self.owner=User.objects.create_user('window-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.store=Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1,pickup_enabled=True,pickup_location='Fixture counter')
        self.product=Product.objects.create(name='Window meal',price=12,lead_hours=1,batch_size=10,
            preparation_tasks=[dict(name='Cook',minutes=30,resource='stove'),dict(name='Pack',minutes=10,resource='packing_area')])
        material=RawMaterial.objects.create(name='Fixture rice',unit='g')
        ProductIngredient.objects.create(product=self.product,raw_material=material,quantity_required=100)
        self.address=Address.objects.create(user=self.user,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0123456789')
        CartItem.objects.create(user=self.user,product=self.product,quantity=1)
        self.target=(self.now+timedelta(days=3)).replace(hour=15)

    def payload(self,**extra):
        return dict(address_id=self.address.pk,payment='manual',delivery_at=self.target.isoformat(),arrival_window_minutes=60,**extra)

    def place(self,**extra):
        result=self.client.post('/api/orders/place/',self.payload(**extra),format='json')
        self.assertEqual(result.status_code,201,result.data)
        return Order.objects.get(pk=result.data['order_id'])

    def test_quote_and_checkout_use_the_latest_arrival_as_the_preparation_and_payment_deadline(self):
        quote=self.client.post('/api/orders/quote/',self.payload(),format='json')
        self.assertEqual(quote.status_code,200,quote.data)
        self.assertEqual(parse_datetime(quote.data['arrival_window']['start']),self.target-timedelta(hours=1))
        order=self.place();self.assertEqual(order.delivery_at,self.target)
        self.assertLessEqual(order.preparation_end_at,self.target-timedelta(minutes=self.store.delivery_buffer_minutes))
        row=self.client.get('/api/orders/').data['results'][0]
        self.assertEqual(row['arrival_window']['minutes'],60)
        self.assertEqual(parse_datetime(row['dispatch_by']),self.target-timedelta(minutes=90))
        self.assertEqual(order.payment_status,'unpaid');self.assertFalse(order.inventory_deducted)

    def test_suggestions_echo_only_windows_wholly_inside_delivery_hours(self):
        result=self.client.post('/api/orders/slots/',{'date':self.target.date().isoformat(),'arrival_window_minutes':60},format='json')
        self.assertEqual(result.status_code,200,result.data);self.assertTrue(result.data['slots'])
        self.assertEqual(result.data['arrival_window_minutes'],60)
        for slot in result.data['slots']:
            value=slot['arrival_window'];first,last=parse_datetime(value['start']),parse_datetime(value['end'])
            self.assertEqual(last-first,timedelta(hours=1));self.assertGreaterEqual(timezone.localtime(first).hour,9)
            self.assertEqual(first.date(),last.date());self.assertEqual(parse_datetime(slot['delivery_at']),last)

    def test_invalid_durations_collection_windows_and_out_of_hours_starts_are_rejected(self):
        for minutes in [15,-30,120,True]:
            body=self.payload();body['arrival_window_minutes']=minutes
            self.assertEqual(self.client.post('/api/orders/quote/',body,format='json').status_code,400)
        body=self.payload();body.update(delivery_method='pickup')
        self.assertEqual(self.client.post('/api/orders/quote/',body,format='json').status_code,400)
        body=self.payload();body['delivery_at']=self.target.replace(hour=9).isoformat()
        self.assertEqual(self.client.post('/api/orders/quote/',body,format='json').status_code,400)

    def test_window_cannot_cross_midnight_or_begin_in_the_past(self):
        self.store.delivery_open_hour=0;self.store.delivery_close_hour=23;self.store.save()
        body=self.payload();body['delivery_at']=self.target.replace(hour=0,minute=30).isoformat()
        self.assertEqual(self.client.post('/api/orders/quote/',body,format='json').status_code,400)
        self.store.delivery_open_hour=9;self.store.save()
        body=self.payload();body['delivery_at']=(self.now+timedelta(minutes=30)).isoformat()
        self.assertEqual(self.client.post('/api/orders/quote/',body,format='json').status_code,400)

    def test_point_times_remain_supported_and_collection_uses_zero_delivery_buffer(self):
        body=self.payload();body.update(delivery_method='pickup',arrival_window_minutes=0)
        result=self.client.post('/api/orders/place/',body,format='json');self.assertEqual(result.status_code,201,result.data)
        order=Order.objects.get(pk=result.data['order_id']);self.assertEqual(order.fulfilment_snapshot['buffer_minutes'],0)
        row=self.client.get('/api/orders/').data['results'][0];self.assertIsNone(row['arrival_window']);self.assertIsNone(row['dispatch_by'])

    def test_delivery_days_and_daily_capacity_still_apply_to_windows(self):
        self.product.delivery_weekdays=[(self.target.weekday()+1)%7];self.product.save()
        self.assertEqual(self.client.post('/api/orders/quote/',self.payload(),format='json').status_code,400)
        self.product.delivery_weekdays=[];self.product.daily_capacity=1;self.product.save()
        order=self.place()
        CartItem.objects.create(user=self.user,product=self.product,quantity=1)
        quote=self.client.post('/api/orders/quote/',self.payload(),format='json')
        self.assertTrue(quote.data['needs_review']);self.assertEqual(Order.objects.count(),1)
        self.assertEqual(order.items.get().quantity,1)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_reminders_follow_window_start_and_include_the_whole_range(self,mail):
        order=self.place(email_reminder=True)
        order.delivery_at=self.now+timedelta(hours=3);order.save(update_fields=['delivery_at'])
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],1)
        self.assertIn('food delivery reminder',mail.call_args.args[0]);self.assertIn('scheduled for delivery',mail.call_args.args[1]);
        self.assertIn('11:00 AM',mail.call_args.args[1]);self.assertIn('12:00 PM',mail.call_args.args[1])
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],0)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_no_advance_reminder_after_a_window_has_started(self,mail):
        order=self.place(email_reminder=True)
        order.delivery_at=self.now+timedelta(minutes=30);order.save(update_fields=['delivery_at'])
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],0);mail.assert_not_called()

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_signed_window_only_change_preserves_prices_and_queues_separately_opted_time_update(self,mail):
        order=self.place(email_reminder=True,email_time_updates=True)
        url=f'/api/orders/{order.pk}/reschedule/'
        response=self.client.post(url,{'delivery_at':order.delivery_at.isoformat(),'arrival_window_minutes':30,'reason':'Agreed a shorter arrival window'},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['preview']['arrival_window']['minutes'],30)
        token=response.data['confirm'];applied=self.client.post(url,{'confirm':token},format='json')
        self.assertEqual(applied.status_code,200,applied.data)
        order.refresh_from_db();self.assertEqual(order.delivery_at,self.target);self.assertEqual(order.fulfilment_snapshot['arrival_window_minutes'],30)
        self.assertEqual(order.total_amount,12);self.assertFalse(order.inventory_deducted)
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],1);self.assertIn('Updated order time',mail.call_args.args[0])
        self.assertNotIn('time_notice',self.client.get('/api/orders/').data['results'][0]['fulfilment_snapshot'])
        again=self.client.post(url,{'confirm':token},format='json');self.assertTrue(again.data['already_applied'])
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],0)
        history=self.client.get(url).data['history'][0];self.assertEqual(history['previous_window']['minutes'],60)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_old_reminder_consent_does_not_subscribe_to_time_changes(self,mail):
        order=self.place(email_reminder=True)
        url=f'/api/orders/{order.pk}/reschedule/'
        preview=self.client.post(url,{'delivery_at':(self.target+timedelta(days=1)).isoformat(),'reason':'Customer arrangement'},format='json')
        self.assertEqual(preview.status_code,200,preview.data)
        self.assertEqual(self.client.post(url,{'confirm':preview.data['confirm']},format='json').status_code,200)
        order.refresh_from_db();self.assertNotIn('time_notice',order.fulfilment_snapshot)
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],0);mail.assert_not_called()

    def test_escrow_invoice_cannot_silently_change_its_window_even_at_the_same_deadline(self):
        order=self.place();order.payment_method='escrow';order.payment_instructions={'escrow_sepolia':{'invoice':'fixture'}};order.save()
        result=self.client.post(f'/api/orders/{order.pk}/reschedule/',{'delivery_at':order.delivery_at.isoformat(),'arrival_window_minutes':30,'reason':'Try shorter'},format='json')
        self.assertEqual(result.status_code,400);self.assertIn('escrow',str(result.data).lower())
        order.refresh_from_db();self.assertEqual(order.fulfilment_snapshot['arrival_window_minutes'],60)

    def test_owner_signed_replanning_carries_window_and_requires_fresh_agreement_for_a_change(self):
        order=self.place();self.client.force_authenticate(self.owner)
        url=f'/api/admin/orders/{order.pk}/preparation-plan/'
        body={'arrival_window_minutes':30,'delivery_at':order.delivery_at.isoformat(),'order_version':order.updated_at.isoformat()}
        self.assertEqual(self.client.post(url,body,format='json').status_code,400)
        body['reason']='New window agreed with customer'
        preview=self.client.post(url,body,format='json');self.assertEqual(preview.status_code,200,preview.data)
        applied=self.client.post(url,{'confirm':preview.data['confirm']},format='json');self.assertEqual(applied.status_code,200,applied.data)
        self.assertEqual(applied.data['order']['arrival_window']['minutes'],30)

    @patch('myapp.services.reminders.send_mail',side_effect=[RuntimeError('SMTP unavailable'),1])
    def test_time_notice_retries_without_receipt_and_stops_after_success(self,mail):
        from .services.reminders import queue_time_notice
        order=self.place(email_reminder=True,email_time_updates=True)
        queue_time_notice(order);order.save(update_fields=['fulfilment_snapshot'])
        self.assertEqual(send_due_reminders(include_owner=False),{'sent':0,'failed':1})
        self.assertFalse(OrderReminder.objects.filter(order=order).exists())
        self.assertEqual(send_due_reminders(include_owner=False),{'sent':1,'failed':0})
        self.assertEqual(send_due_reminders(include_owner=False),{'sent':0,'failed':0})
        self.assertEqual(mail.call_count,2)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_time_notice_rechecks_account_recipient_consent_status_and_age(self,mail):
        from .services.reminders import queue_time_notice,time_due
        order=self.place(email_reminder=True,email_time_updates=True)
        queue_time_notice(order);order.save(update_fields=['fulfilment_snapshot'])
        self.assertTrue(time_due().filter(pk=order.pk).exists())
        self.user.email='changed@example.test';self.user.save()
        self.assertFalse(time_due().filter(pk=order.pk).exists())
        self.user.email='buyer@example.test';self.user.is_active=False;self.user.save()
        self.assertFalse(time_due().filter(pk=order.pk).exists())
        self.user.is_active=True;self.user.save()
        order.fulfilment_snapshot['customer_reminder']['time_updates']=False;order.save()
        self.assertFalse(time_due().filter(pk=order.pk).exists())
        order.fulfilment_snapshot['customer_reminder']['time_updates']=True
        order.status='delivered';order.save()
        self.assertFalse(time_due().filter(pk=order.pk).exists())
        order.status='pending';order.fulfilment_snapshot['time_notice']['created_at']=(self.now-timedelta(hours=25)).isoformat();order.save()
        self.assertEqual(send_due_reminders(include_owner=False)['sent'],0);mail.assert_not_called()
