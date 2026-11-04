"""Delivery-only owner reminders: local fixtures, mocked SMTP, no real messages."""
from datetime import datetime, timedelta
from io import StringIO
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from django.core.management import call_command
from django.contrib.auth.models import User
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderAmendment, OrderReminder, Storefront
from .services.reminders import send_due_reminders, owner_due, owner_queue_counts

MAIL=dict(EMAIL_HOST='smtp.example.test',EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
    PUBLIC_APP_URL='https://kitchen.example',OWNER_NOTIFICATION_EMAIL='owner@example.test',CRON_SECRET='local-owner-reminder-secret-at-least-32-characters')

@override_settings(**MAIL)
class OwnerDeliveryReminderTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('local-phone-customer')
        self.owner=User.objects.create_user('local-reminder-owner',is_staff=True)
        self.store=Storefront.objects.create(pk=1,ordering_mode='simple')
        self.now=timezone.make_aware(datetime(2030,1,7,9))
        self.clock=patch('django.utils.timezone.now',return_value=self.now);self.clock.start();self.addCleanup(self.clock.stop)
        self.order=Order.objects.create(user=self.user,ordering_mode='simple',inventory_deducted=True,
            delivery_at=self.now+timedelta(hours=1),preparation_at=self.now+timedelta(minutes=15))

    def send(self,**kwargs):return send_due_reminders(include_owner=True,include_customer=False,**kwargs)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_simple_and_historical_preparation_are_suppressed_and_delivery_is_not_a_status_update(self,mail):
        Order.objects.create(user=self.user,preparation_at=self.now+timedelta(minutes=30))
        self.assertEqual(self.send(),{'sent':1,'failed':0});self.assertEqual(self.send(),{'sent':0,'failed':0})
        self.assertIn('delivery due',mail.call_args.args[1]);self.assertNotIn('preparation',mail.call_args.args[1])
        self.assertEqual(mail.call_args.args[3],['owner@example.test'])
        self.assertIn(f'/admin/orders?order={self.order.pk}',mail.call_args.args[1])
        self.order.refresh_from_db();self.assertEqual(self.order.status,'pending');self.assertEqual(self.order.payment_status,'unpaid');self.assertTrue(self.order.inventory_deducted)
        self.assertEqual(OrderReminder.objects.count(),1)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_scheduled_kitchen_retains_legacy_prep_but_never_uses_simple_order_prep(self,mail):
        self.store.ordering_mode='scheduled';self.store.save()
        Order.objects.create(user=self.user,preparation_at=self.now+timedelta(minutes=30))
        self.assertEqual(self.send(),{'sent':2,'failed':0})
        self.assertEqual(sum('preparation due' in call.args[1] for call in mail.call_args_list),1)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_collection_label_and_time_change_receive_separate_success_receipts(self,mail):
        self.order.delivery_method='pickup';self.order.save()
        self.assertEqual(self.send()['sent'],1);self.assertIn('collection due',mail.call_args.args[1])
        self.order.delivery_at+=timedelta(hours=2);self.order.save()
        OrderAmendment.objects.create(order=self.order,actor=self.owner,before={},after={'change_type':'delivery_time'})
        self.assertEqual(self.send()['sent'],1);self.assertEqual(self.send()['sent'],0)
        self.assertEqual(OrderReminder.objects.count(),2)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_legacy_receipt_survives_upgrade_without_replay_until_audited_change(self,mail):
        receipt=OrderReminder.objects.create(order=self.order,event='delivery_at')
        self.assertEqual(self.send()['sent'],0)
        later=self.now+timedelta(minutes=5)
        with patch('django.utils.timezone.now',return_value=later):
            self.order.delivery_at+=timedelta(hours=2);self.order.save()
            OrderAmendment.objects.create(order=self.order,actor=self.owner,before={},after={'change_type':'delivery_time'})
            self.assertEqual(self.send()['sent'],1)
        self.assertTrue(OrderReminder.objects.filter(pk=receipt.pk,event='delivery_at').exists())

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_closed_missing_far_future_and_long_overdue_orders_do_not_enter_queue(self,mail):
        for change in ({'status':'delivered'},{'status':'cancelled'},{'delivery_at':None},
            {'delivery_at':self.now+timedelta(hours=24,seconds=1)}, {'delivery_at':self.now-timedelta(hours=24,seconds=1)}):
            for field,value in change.items():setattr(self.order,field,value)
            self.order.save();self.assertEqual(self.send()['sent'],0,change)
            self.order.status='pending';self.order.delivery_at=self.now+timedelta(hours=1)
        mail.assert_not_called()
        self.order.delivery_at=self.now-timedelta(hours=1);self.order.save()
        self.assertEqual(self.send()['sent'],1)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_queue_preview_and_staff_status_share_eligibility_without_sending(self,mail):
        self.assertEqual(owner_queue_counts(),{'delivery':1,'preparation':0})
        out=StringIO();call_command('send_order_reminders',stdout=out)
        self.assertIn('delivery due',out.getvalue());self.assertNotIn('preparation',out.getvalue())
        client=APIClient();client.force_authenticate(self.user)
        self.assertEqual(client.get('/api/admin/reminder-status/').status_code,403)
        client.force_authenticate(self.owner);r=client.get('/api/admin/reminder-status/')
        self.assertEqual(r.status_code,200);self.assertEqual(r.data['ordering_mode'],'simple')
        self.assertEqual(r.data['owner_delivery_due'],1);self.assertEqual(r.data['owner_preparation_due'],0)
        self.assertFalse(r.data['scheduler_activity_verified']);mail.assert_not_called();self.assertFalse(OrderReminder.objects.exists())
        self.assertEqual(self.send()['sent'],1);self.assertEqual(owner_due().count(),0)

    @patch('myapp.services.reminders.send_mail',side_effect=RuntimeError('private fixture SMTP rejection'))
    def test_failure_retries_later_with_no_false_receipt_and_shared_budget_stays_bounded(self,mail):
        for _ in range(4):Order.objects.create(user=self.user,ordering_mode='simple',delivery_at=self.order.delivery_at)
        self.assertEqual(self.send(),{'sent':0,'failed':3});self.assertEqual(mail.call_count,3)
        self.assertFalse(OrderReminder.objects.exists())
        mail.side_effect=None;mail.return_value=1
        self.assertEqual(self.send(),{'sent':3,'failed':0});self.assertEqual(owner_due().count(),2)

    def test_status_queue_does_not_create_missing_settings(self):
        self.store.delete();self.assertEqual(owner_queue_counts(),{'delivery':1,'preparation':0})
        self.assertFalse(Storefront.objects.exists())

@override_settings(**MAIL)
class OwnerReminderConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update_skip_locked')
    def test_overlapping_workers_do_not_repeat_an_owner_event(self):
        user=User.objects.create_user('local-concurrent-owner-fixture')
        Storefront.objects.create(pk=1,ordering_mode='simple')
        order=Order.objects.create(user=user,ordering_mode='simple',delivery_at=timezone.now()+timedelta(hours=1))
        sending,release=Event(),Event()
        def mail(*args,**kwargs):
            sending.set()
            if not release.wait(5):raise RuntimeError('Local synchronization timeout')
            return 1
        def worker():
            close_old_connections()
            try:return send_due_reminders(include_owner=True,include_customer=False)
            finally:close_old_connections()
        with patch('myapp.services.reminders.send_mail',side_effect=mail) as send,ThreadPoolExecutor(max_workers=1) as pool:
            first=pool.submit(worker)
            try:self.assertTrue(sending.wait(5));self.assertEqual(worker(),{'sent':0,'failed':0})
            finally:release.set()
            self.assertEqual(first.result(timeout=5),{'sent':1,'failed':0});self.assertEqual(send.call_count,1)
        self.assertEqual(OrderReminder.objects.filter(order=order).count(),1)
