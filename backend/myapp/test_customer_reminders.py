"""Customer notification consent, dated receipts and isolated mocked mail."""
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderReminder
from .services.reminders import customer_due, send_due_reminders


@override_settings(EMAIL_HOST='smtp.example.test', EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
                   PUBLIC_APP_URL='https://kitchen.example', OWNER_NOTIFICATION_EMAIL='', CRON_SECRET='x'*32)
class CustomerReminderTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('customer-email', password='Fixture-Password-123!', email='buyer@example.test')
        self.client=APIClient();self.client.force_authenticate(self.user)
        now=timezone.now()
        self.order=Order.objects.create(user=self.user, delivery_at=now+timedelta(hours=1),
            preparation_at=now-timedelta(hours=1), preparation_end_at=now,
            preparation_plan={'needs_review':False}, fulfilment_snapshot={'customer_reminder':{'enabled':True,'email':self.user.email}})

    def send(self, **kwargs):
        return send_due_reminders(include_owner=False, **kwargs)

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_dated_recipient_receipts_deduplicate_and_reschedule_without_stock_or_payment_changes(self, mail):
        self.assertEqual(self.send(), {'sent':1,'failed':0})
        self.assertEqual(self.send(), {'sent':0,'failed':0})
        self.order.delivery_at+=timedelta(minutes=10);self.order.save(update_fields=['delivery_at'])
        self.assertEqual(self.send()['sent'],1)
        self.assertEqual(OrderReminder.objects.count(),2)
        self.assertTrue(all(len(key)==20 for key in OrderReminder.objects.values_list('event',flat=True)))
        body=mail.call_args.args[1]
        self.assertIn('Malaysia time', body);self.assertIn('https://kitchen.example/orders',body)
        self.assertNotIn('sign-in',body);self.assertEqual(mail.call_args.args[3],[self.user.email])
        self.order.refresh_from_db();self.assertFalse(self.order.inventory_deducted);self.assertEqual(self.order.payment_status,'unpaid')

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_unconfirmed_unreserved_closed_past_and_inactive_orders_are_excluded(self, mail):
        for field,value in [('preparation_plan',{'needs_review':True}), ('preparation_at',None),
                            ('preparation_end_at',None),('status','delivered'),('status','cancelled'),
                            ('delivery_at',timezone.now()-timedelta(minutes=1)),
                            ('delivery_at',timezone.now()+timedelta(hours=3))]:
            old=getattr(self.order,field);setattr(self.order,field,value);self.order.save(update_fields=[field])
            self.assertEqual(self.send()['sent'],0,(field,value))
            setattr(self.order,field,old);self.order.save(update_fields=[field])
        self.user.is_active=False;self.user.save()
        self.assertEqual(self.send()['sent'],0);mail.assert_not_called()

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_confirmed_legacy_plan_without_review_key_is_eligible(self, mail):
        self.order.preparation_plan={};self.order.save()
        self.assertEqual(self.send()['sent'],1)

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_opt_out_and_changed_email_suppress_old_recipient_until_enabled_again(self, mail):
        url=f'/api/orders/{self.order.pk}/reminder/'
        self.assertEqual(self.client.post(url,{'enabled':False},format='json').status_code,200)
        self.assertEqual(self.send()['sent'],0)
        self.assertEqual(self.client.post(url,{'enabled':True,'email':'attacker@example.test'},format='json').status_code,200)
        self.assertEqual(self.send()['sent'],1)
        self.user.email='new@example.test';self.user.save()
        self.assertEqual(self.send()['sent'],0)
        self.assertEqual(self.client.post(url,{'enabled':True},format='json').status_code,200)
        self.assertEqual(self.send()['sent'],1)
        self.assertEqual(mail.call_args.args[3],['new@example.test'])

    @patch('myapp.services.reminders.send_mail', side_effect=RuntimeError('private SMTP details'))
    def test_failed_sends_are_bounded_and_retry_later(self, mail):
        self.assertEqual(self.send(),{'sent':0,'failed':1});self.assertEqual(mail.call_count,1)
        self.assertFalse(OrderReminder.objects.exists())
        mail.side_effect=None;mail.return_value=1
        self.assertEqual(self.send()['sent'],1)

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_shared_budget_preserves_owner_capacity_and_caps_three_attempts(self, mail):
        for _ in range(5):
            Order.objects.create(user=self.user, delivery_at=self.order.delivery_at,
                preparation_at=self.order.preparation_at, preparation_end_at=self.order.preparation_end_at,
                fulfilment_snapshot=self.order.fulfilment_snapshot, preparation_plan=self.order.preparation_plan)
        with override_settings(OWNER_NOTIFICATION_EMAIL='owner@example.test'):
            self.assertEqual(send_due_reminders()['sent'],3)
        self.assertEqual(mail.call_count,3)
        self.assertEqual(sum(call.args[3]==['owner@example.test'] for call in mail.call_args_list),1)

    @patch('myapp.services.reminders.send_mail', return_value=1)
    def test_customer_only_configuration_runs_from_same_authenticated_cron(self, mail):
        self.assertEqual(self.client.get('/api/reminders/run/').status_code,401)
        response=self.client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+'x'*32)
        self.assertEqual(response.status_code,200);self.assertEqual(response.data['sent'],1)
        self.assertEqual(self.client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+'x'*32).data['sent'],0)

    @patch('myapp.services.reminders.send_mail')
    def test_untrusted_public_origin_and_console_backend_cannot_enable_customer_sends(self, mail):
        for origin,backend in [('https://user:pass@kitchen.example','django.core.mail.backends.smtp.EmailBackend'),
                               ('https://kitchen.example','django.core.mail.backends.console.EmailBackend')]:
            with override_settings(PUBLIC_APP_URL=origin,EMAIL_BACKEND=backend):
                self.assertEqual(self.send()['sent'],0)
        mail.assert_not_called()

    def test_preference_is_private_and_does_not_enable_completed_or_past_orders(self):
        url=f'/api/orders/{self.order.pk}/reminder/'
        self.client.force_authenticate(User.objects.create_user('another'))
        self.assertEqual(self.client.post(url,{'enabled':True},format='json').status_code,404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(url,[],format='json').status_code,400)
        self.order.status='delivered';self.order.save()
        self.assertEqual(self.client.post(url,{'enabled':True},format='json').status_code,400)
        self.assertEqual(self.client.post(url,{'enabled':False},format='json').status_code,200)

    def test_account_email_change_requires_password_and_leaves_existing_order_opt_in_untransferred(self):
        url='/api/account/order-email/'
        self.assertEqual(self.client.get(url).data['email'],self.user.email)
        for body in [{'email':'new@example.test'}, {'email':'invalid','current_password':'Fixture-Password-123!'},
                     {'email':'new@example.test','current_password':'wrong'}]:
            self.assertEqual(self.client.patch(url,body,format='json').status_code,400)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'buyer@example.test')
        result=self.client.patch(url,{'email':'NEW@example.test','current_password':'Fixture-Password-123!'},format='json')
        self.assertEqual(result.status_code,200);self.assertEqual(result.data['email'],'new@example.test')
        self.assertFalse(customer_due().exists())

    def test_email_change_password_attempts_are_rate_limited(self):
        for _ in range(5):
            self.assertEqual(self.client.patch('/api/account/order-email/',{'email':'new@example.test','current_password':'wrong'},format='json').status_code,400)
        self.assertEqual(self.client.patch('/api/account/order-email/',{'email':'new@example.test','current_password':'wrong'},format='json').status_code,429)


    def test_checkout_snapshots_consent_and_rejects_missing_email_without_creating_an_order(self):
        from .models import Address, Product, CartItem, Storefront
        Storefront.objects.update_or_create(pk=1, defaults=dict(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details'))
        address=Address.objects.create(user=self.user,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0123456789')
        menu=Product.objects.create(name='Fixture meal',price=12)
        CartItem.objects.create(user=self.user,product=menu,quantity=1)
        payload={'payment':'manual','address_id':address.pk,'delivery_at':(timezone.localtime()+timedelta(days=5)).replace(hour=15,minute=0,second=0,microsecond=0).isoformat(),'email_reminder':True}
        result=self.client.post('/api/orders/place/',payload,format='json')
        self.assertEqual(result.status_code,201,result.data)
        saved=Order.objects.get(pk=result.data['order_id'])
        self.assertEqual(saved.fulfilment_snapshot['customer_reminder'],{'enabled':True,'email':self.user.email})
        CartItem.objects.create(user=self.user,product=menu,quantity=1)
        self.user.email='';self.user.save()
        before=Order.objects.count()
        result=self.client.post('/api/orders/place/',payload,format='json')
        self.assertEqual(result.status_code,400,result.data)
        self.assertEqual(Order.objects.count(),before);self.assertTrue(CartItem.objects.exists())


from concurrent.futures import ThreadPoolExecutor
from threading import Event
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature


@override_settings(EMAIL_HOST='smtp.example.test', EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
                   PUBLIC_APP_URL='https://kitchen.example', OWNER_NOTIFICATION_EMAIL='')
class ReminderConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update_skip_locked')
    def test_overlapping_workers_do_not_send_the_same_customer_event(self):
        user=User.objects.create_user('concurrent-email',email='buyer@example.test')
        now=timezone.now()
        Order.objects.create(user=user,delivery_at=now+timedelta(hours=1),preparation_at=now-timedelta(hours=1),preparation_end_at=now,
            preparation_plan={'needs_review':False},fulfilment_snapshot={'customer_reminder':{'enabled':True,'email':user.email}})
        sending,release=Event(),Event()
        def mail(*args,**kwargs):
            sending.set()
            if not release.wait(5):raise RuntimeError('Test synchronization timeout')
            return 1
        def worker():
            close_old_connections()
            try:return send_due_reminders(include_owner=False)
            finally:close_old_connections()
        with patch('myapp.services.reminders.send_mail',side_effect=mail) as send, ThreadPoolExecutor(max_workers=1) as pool:
            first=pool.submit(worker)
            try:
                self.assertTrue(sending.wait(5))
                self.assertEqual(worker(),{'sent':0,'failed':0})
            finally:release.set()
            self.assertEqual(first.result(timeout=5),{'sent':1,'failed':0})
            self.assertEqual(send.call_count,1)
        self.assertEqual(OrderReminder.objects.count(),1)
