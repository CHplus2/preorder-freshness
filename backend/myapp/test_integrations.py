from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront, Product, CartItem, Address, Order, OrderReminder
from .services.reminders import send_due_reminders

class IntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('buyer')
        self.owner = User.objects.create_user('owner', is_staff=True)
        self.client = APIClient()
        self.store = Storefront.objects.create(pk=1)
        self.product = Product.objects.create(name='Meal',price=12)
        self.address = Address.objects.create(user=self.user,line1='Test',city='KL',state='KL',postal_code='50000',phone='0123456789')

    def checkout(self):
        self.client.force_authenticate(self.user)
        CartItem.objects.get_or_create(user=self.user,product=self.product,defaults={'quantity':1})
        delivery=(timezone.localtime()+timedelta(days=4)).replace(hour=12,minute=0,second=0)
        return self.client.post('/api/orders/place/',dict(address_id=self.address.pk,payment='manual',delivery_at=delivery.isoformat()),format='json')

    def test_disabled_manual_payment_rejected(self):
        self.assertEqual(self.checkout().status_code,400)
        self.assertFalse(Order.objects.exists())

    def test_manual_payment_stays_unpaid_and_snapshots_details(self):
        self.store.manual_payment_enabled=True
        self.store.bank_transfer_instructions='Bank / Business recipient / account'
        self.store.save()
        self.assertEqual(self.checkout().status_code,201)
        order=Order.objects.get()
        self.assertEqual(order.payment_status,'unpaid')
        self.assertEqual(order.payment_method,'manual')
        self.store.bank_transfer_instructions='Changed'
        self.store.save()
        order.refresh_from_db()
        self.assertIn('Business recipient',order.payment_instructions['instructions'])

    def test_empty_payment_setup_rejected(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch('/api/storefront/',{'manual_payment_enabled':True},format='json').status_code,400)

    @override_settings(CRON_SECRET='x'*32)
    def test_reminder_trigger_requires_secret(self):
        self.assertEqual(self.client.get('/api/reminders/run/').status_code,401)
        self.assertEqual(self.client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer wrong').status_code,401)
        self.assertEqual(self.client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer '+'x'*32).status_code,503)

    def test_reminder_status_is_owner_only(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/admin/reminder-status/').status_code,403)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_due_reminders_deduplicated_and_bounded(self, mail):
        now=timezone.now()
        order=Order.objects.create(user=self.user,preparation_at=now+timedelta(hours=1),delivery_at=now+timedelta(hours=3))
        self.assertEqual(send_due_reminders(limit=1)['sent'],1)
        self.assertEqual(send_due_reminders()['sent'],1)
        self.assertEqual(send_due_reminders()['sent'],0)
        self.assertEqual(mail.call_count,2)
        self.assertEqual(OrderReminder.objects.filter(order=order).count(),2)

    @patch('myapp.services.reminders.send_mail',side_effect=RuntimeError('SMTP unavailable'))
    def test_failed_email_can_retry_without_false_receipt(self, mail):
        Order.objects.create(user=self.user,delivery_at=timezone.now()+timedelta(hours=1))
        self.assertEqual(send_due_reminders()['failed'],1)
        self.assertFalse(OrderReminder.objects.exists())

    @patch('myapp.services.reminders.send_mail')
    def test_stale_and_cancelled_orders_are_not_notified(self, mail):
        Order.objects.create(user=self.user,delivery_at=timezone.now()-timedelta(days=4))
        Order.objects.create(user=self.user,status='cancelled',delivery_at=timezone.now())
        self.assertEqual(send_due_reminders()['sent'],0)
        mail.assert_not_called()
