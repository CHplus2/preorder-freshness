"""Recorded bearer-worker activity is evidence of calls, never a cron guarantee."""
from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AuthAttempt, Order, Storefront, Product, RawMaterial, ProductIngredient, InventoryItem, Address, CartItem
from .services import reminder_activity

SECRET='fixture-worker-secret-at-least-32-characters'
MAIL=dict(EMAIL_HOST='smtp.example.test', EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend', PUBLIC_APP_URL='https://kitchen.example', OWNER_NOTIFICATION_EMAIL='', CRON_SECRET=SECRET)

@override_settings(**MAIL)
class ReminderActivityTests(TestCase):
    def setUp(self):
        self.client=APIClient();self.owner=User.objects.create_user('activity-owner',is_staff=True);self.user=User.objects.create_user('activity-buyer')
        self.url='/api/reminders/run/';self.status='/api/admin/reminder-status/'

    def call(self):return self.client.get(self.url,HTTP_AUTHORIZATION='Bearer '+SECRET)

    def test_unauthorized_requests_do_not_create_activity(self):
        for header in ['', 'Bearer incorrect', 'Bearer é-wrong']:
            self.assertEqual(self.client.get(self.url,HTTP_AUTHORIZATION=header).status_code,401)
        self.assertEqual(AuthAttempt.objects.count(),0)

    def test_status_is_read_only_and_staff_only(self):
        self.assertEqual(self.client.get(self.status).status_code,403)
        self.client.force_authenticate(self.user);self.assertEqual(self.client.get(self.status).status_code,403)
        self.client.force_authenticate(self.owner)
        with patch('myapp.views.reminders.send_due_reminders') as send:
            response=self.client.get(self.status)
        self.assertEqual(response.status_code,200);self.assertFalse(response.data['scheduler_activity_verified'])
        self.assertEqual(response.data['worker_activity']['authenticated_runs_24h'],0);send.assert_not_called();self.assertEqual(AuthAttempt.objects.count(),0)

    @patch('myapp.views.reminders.send_due_reminders',return_value={'sent':0,'failed':0})
    def test_quiet_completed_run_is_observed_without_claiming_scheduler_enabled(self,send):
        self.assertEqual(self.call().data,{'sent':0,'failed':0});send.assert_called_once()
        activity=reminder_activity.history();self.assertEqual(activity['authenticated_runs_24h'],1)
        row=activity['recent_runs'][0];self.assertEqual(row['outcome'],'completed');self.assertEqual(row['sent'],0);self.assertIsNotNone(row['completed_at'])
        self.client.force_authenticate(self.owner);response=self.client.get(self.status)
        self.assertFalse(response.data['scheduler_activity_verified']);self.assertEqual(response.data['worker_activity']['recent_runs'][0]['outcome'],'completed')
        self.assertNotIn(SECRET,str(response.data));self.assertNotIn(self.user.username,str(response.data))

    @patch('myapp.views.reminders.send_due_reminders',return_value={'sent':2,'failed':1})
    def test_failed_attempts_preserve_counts_and_mark_partial_send(self,send):
        response=self.call();self.assertEqual(response.status_code,503);self.assertEqual(response.data,{'sent':2,'failed':1})
        row=reminder_activity.history()['recent_runs'][0];self.assertEqual((row['outcome'],row['sent'],row['failed']),('send_failed',2,1))

    @override_settings(EMAIL_HOST='')
    @patch('myapp.views.reminders.send_due_reminders')
    def test_valid_call_with_missing_configuration_records_no_send(self,send):
        self.assertEqual(self.call().status_code,503);send.assert_not_called()
        row=reminder_activity.history()['recent_runs'][0];self.assertEqual(row['outcome'],'not_configured');self.assertIsNone(row['sent'])

    @patch('myapp.views.reminders.send_due_reminders',side_effect=RuntimeError('private-smtp-password-recipient-fixture'))
    def test_unexpected_failure_records_outcome_without_exposing_private_exception(self,send):
        with self.assertLogs('myapp.views.reminders',level='WARNING') as logs:response=self.call()
        self.assertEqual(response.status_code,503);self.assertNotIn('private-smtp-password-recipient-fixture',str(response.data)+' '.join(logs.output))
        self.assertEqual(reminder_activity.history()['recent_runs'][0]['outcome'],'worker_error')

    @patch('myapp.views.reminders.send_due_reminders',return_value={'sent':1,'failed':0})
    def test_monitoring_failure_cannot_turn_a_successful_send_into_retryable_failure(self,send):
        with patch('myapp.services.reminder_activity.AuthAttempt.objects.create',side_effect=RuntimeError('fixture event-store error')):
            with self.assertLogs('myapp.services.reminder_activity',level='WARNING'):
                response=self.call()
        self.assertEqual(response.status_code,200);self.assertEqual(response.data['sent'],1);send.assert_called_once()
        self.assertEqual(reminder_activity.history()['recent_runs'],[])

    @patch('myapp.views.reminders.send_due_reminders',return_value={'sent':1,'failed':0})
    def test_lost_completion_marker_does_not_reclassify_an_accepted_send(self,send):
        create=AuthAttempt.objects.create
        def write(**values):
            if values['key']==reminder_activity.START:
                return create(**values)
            raise RuntimeError('private completion-event failure')
        with patch('myapp.services.reminder_activity.AuthAttempt.objects.create',side_effect=write):
            with self.assertLogs('myapp.services.reminder_activity',level='WARNING'):
                response=self.call()
        self.assertEqual(response.status_code,200);self.assertEqual(response.data,{'sent':1,'failed':0});send.assert_called_once()
        activity=reminder_activity.history();self.assertEqual(activity['recent_runs'][0]['outcome'],'running');self.assertIsNone(activity['recent_runs'][0]['sent'])

    def test_overlapping_calls_keep_each_completion_with_its_own_start(self):
        first=reminder_activity.begin();second=reminder_activity.begin()
        reminder_activity.finish(second,result={'sent':0,'failed':0});reminder_activity.finish(first,result={'sent':0,'failed':1})
        rows=reminder_activity.history()['recent_runs'];self.assertEqual([row['outcome'] for row in rows],['completed','send_failed'])

    def test_started_but_unfinished_call_is_reported_without_assuming_send_failure(self):
        marker=reminder_activity.begin();row=reminder_activity.history()['recent_runs'][0];self.assertEqual(row['outcome'],'running')
        AuthAttempt.objects.filter(pk=marker).update(created_at=timezone.now()-timedelta(minutes=3))
        row=reminder_activity.history()['recent_runs'][0];self.assertEqual(row['outcome'],'incomplete');self.assertIsNone(row['failed'])

    def test_retention_does_not_delete_auth_limits_or_mailbox_confirmation_records(self):
        unrelated=AuthAttempt.objects.create(key='unrelated-auth-event')
        old=reminder_activity.begin();AuthAttempt.objects.filter(pk__in=[unrelated.pk,old]).update(created_at=timezone.now()-timedelta(hours=25))
        reminder_activity.begin();self.assertTrue(AuthAttempt.objects.filter(pk=unrelated.pk).exists());self.assertFalse(AuthAttempt.objects.filter(pk=old).exists())
        self.assertEqual(reminder_activity.history()['authenticated_runs_24h'],1)

    def test_reads_remain_bounded_and_malformed_counts_are_not_reported_as_success(self):
        starts=AuthAttempt.objects.bulk_create([AuthAttempt(key=reminder_activity.START) for _ in range(40)])
        for start in starts:reminder_activity.finish(start.pk,result={'sent':1,'failed':0})
        with CaptureQueriesContext(connection) as queries:activity=reminder_activity.history()
        self.assertLessEqual(len(queries),3);self.assertEqual(len(activity['recent_runs']),10);self.assertEqual(activity['authenticated_runs_24h'],40)
        new=reminder_activity.begin();AuthAttempt.objects.create(key=f'{reminder_activity.PREFIX}finish:{new}:counts:99:0')
        self.assertEqual(reminder_activity.history()['recent_runs'][0]['outcome'],'running')


@override_settings(**MAIL)
class DeliveryCommunicationJourneyTests(TestCase):
    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_checkout_reschedule_dispatch_and_closed_order_share_one_bounded_worker(self,send):
        now=timezone.make_aware(datetime(2030,1,7,9))
        with patch('django.utils.timezone.now',return_value=now) as clock:
            buyer=User.objects.create_user('journey-buyer',email='buyer@example.test');owner=User.objects.create_user('journey-owner',is_staff=True)
            Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1)
            product=Product.objects.create(name='Journey rice box',price=12,lead_hours=1,batch_size=10,max_early_minutes=120,preparation_tasks=[dict(name='Cook and pack',minutes=30,resource='prep_table')])
            material=RawMaterial.objects.create(name='Fixture rice',unit='g')
            ProductIngredient.objects.create(product=product,raw_material=material,quantity_required=100)
            stock=InventoryItem.objects.create(raw_material=material,quantity=1000,received_date=now.date(),expiry_date=now.date()+timedelta(days=14),unit_cost='.01')
            address=Address.objects.create(user=buyer,line1='Fixture street',city='KL',state='Kuala Lumpur',postal_code='50000',phone='0123456789')
            CartItem.objects.create(user=buyer,product=product,quantity=1)
            client=APIClient();client.force_authenticate(buyer);delivery=(now+timedelta(days=3)).replace(hour=15)
            placed=client.post('/api/orders/place/',dict(address_id=address.pk,payment='manual',delivery_at=delivery.isoformat(),arrival_window_minutes=60,email_reminder=True,email_dispatch_updates=True,email_time_updates=True),format='json')
            self.assertEqual(placed.status_code,201,placed.data);order=Order.objects.get(pk=placed.data['order_id']);self.assertFalse(order.preparation_plan.get('needs_review'))
            changed=client.post(f'/api/orders/{order.pk}/reschedule/',dict(delivery_at=(delivery+timedelta(days=1,hours=1)).isoformat(),reason='Agreed later arrival window'),format='json')
            self.assertEqual(changed.status_code,200,changed.data)
            applied=client.post(f'/api/orders/{order.pk}/reschedule/',dict(confirm=changed.data['confirm']),format='json');self.assertEqual(applied.status_code,200,applied.data)
            first=client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+SECRET);self.assertEqual(first.data,{'sent':1,'failed':0});self.assertIn('Updated order time',send.call_args.args[0])
            order.refresh_from_db();clock.return_value=order.preparation_end_at
            client.force_authenticate(owner)
            ready=client.patch(f'/api/admin/orders/{order.pk}/',dict(status='cooked'),format='json');self.assertEqual(ready.status_code,200,ready.data)
            dispatched=client.patch(f'/api/admin/orders/{order.pk}/',dict(status='shipped'),format='json');self.assertEqual(dispatched.status_code,200,dispatched.data)
            second=client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+SECRET);self.assertEqual(second.data,{'sent':1,'failed':0});self.assertIn('out for delivery',send.call_args.args[0])
            delivered=client.patch(f'/api/admin/orders/{order.pk}/',dict(status='delivered'),format='json');self.assertEqual(delivered.status_code,200,delivered.data)
            third=client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+SECRET);self.assertEqual(third.data,{'sent':0,'failed':0});self.assertEqual(send.call_count,2)
            order.refresh_from_db();stock.refresh_from_db();self.assertTrue(order.inventory_deducted);self.assertEqual(stock.quantity,900);self.assertEqual(order.payment_status,'unpaid')
            status=client.get('/api/admin/reminder-status/').data;self.assertEqual(status['worker_activity']['authenticated_runs_24h'],2);self.assertFalse(status['scheduler_activity_verified'])
            self.assertEqual(status['worker_activity']['recent_runs'][0]['outcome'],'completed')
