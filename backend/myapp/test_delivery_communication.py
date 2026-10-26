"""Order handover and dispatch communication. All mail is mocked."""
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderReminder, OrderAmendment
from .services.reminders import send_due_reminders


@override_settings(EMAIL_HOST='smtp.example.test', EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
                   PUBLIC_APP_URL='https://kitchen.example', OWNER_NOTIFICATION_EMAIL='')
class DeliveryCommunicationTests(TestCase):
    def setUp(self):
        self.buyer=User.objects.create_user('handover-buyer',email='buyer@example.test')
        self.owner=User.objects.create_user('handover-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.buyer)
        now=timezone.now()
        self.order=Order.objects.create(user=self.buyer,delivery_at=now+timedelta(hours=1),preparation_at=now-timedelta(hours=1),
            preparation_end_at=now,preparation_plan={'needs_review':False},status='cooked',inventory_deducted=True,
            fulfilment_snapshot={'customer_reminder':{'enabled':True,'email':self.buyer.email,'dispatch_updates':True}})
        self.url=f'/api/orders/{self.order.pk}/handover/'

    def handover(self,**changes):
        return self.client.patch(self.url,{'version':self.order.updated_at.isoformat(),'handover':changes},format='json')

    def dispatch(self,**changes):
        self.client.force_authenticate(self.owner)
        return self.client.patch(f'/api/admin/orders/{self.order.pk}/',{'status':'shipped',**changes},format='json')

    def send(self):return send_due_reminders(include_owner=False)

    def test_customer_handover_normalizes_contact_and_records_authorised_place_without_scheduling_changes(self):
        result=self.handover(contact_phone='012-345 6789',contact_method='whatsapp',mode='agreed_place',location='Reception with guard',notes='Call on arrival. Do not block the driveway.')
        self.assertEqual(result.status_code,200,result.data)
        self.order.refresh_from_db();saved=self.order.fulfilment_snapshot['handover']
        self.assertEqual(saved['contact_phone'],'+60123456789');self.assertEqual(saved['location'],'Reception with guard')
        self.assertEqual(self.order.amendments.get().after['kind'],'handover_details')
        self.assertEqual(self.order.status,'cooked');self.assertTrue(self.order.inventory_deducted);self.assertEqual(self.order.payment_status,'unpaid')

    def test_no_dropoff_or_whatsapp_is_inferred_from_missing_data(self):
        self.assertEqual(self.handover().status_code,200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.fulfilment_snapshot['handover']['mode'],'in_person')
        self.assertEqual(self.order.fulfilment_snapshot['handover']['contact_method'],'phone')
        for changes in [{'mode':'agreed_place'},{'contact_method':'whatsapp'}, {'notes':'x'*501},
                        {'contact_phone':'javascript:12345678'},{'contact_phone':'1234'}, {'contact_phone':'011;1234567'}]:
            self.assertEqual(self.handover(**changes).status_code,400,changes)
        self.order.delivery_method='pickup';self.order.save()
        self.assertEqual(self.handover(mode='agreed_place',location='Gate').status_code,400)

    def test_handover_requires_ownership_current_version_and_pre_dispatch_state(self):
        self.client.force_authenticate(User.objects.create_user('different-buyer'))
        self.assertEqual(self.handover().status_code,404)
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.patch(self.url,[],format='json').status_code,400)
        self.assertEqual(self.handover().status_code,200)
        self.assertEqual(self.handover(notes='stale').status_code,409)
        for state in ['shipped','delivered','cancelled']:
            self.order.status=state;self.order.save()
            self.assertEqual(self.handover(notes='too late').status_code,400)

    def test_courier_contact_is_owner_only_and_never_marks_dispatch(self):
        self.client.force_authenticate(self.owner)
        result=self.client.post(f'/api/admin/orders/{self.order.pk}/tracking/',{'carrier':'Fixture courier','reference':'REF-123',
            'contact_phone':'+60123456789','version':self.order.updated_at.isoformat()},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['order']['fulfilment_snapshot']['courier']['contact_phone'],'+60123456789')
        self.order.refresh_from_db();self.assertEqual(self.order.status,'cooked');self.assertNotIn('dispatch_notice',self.order.fulfilment_snapshot)
        self.client.force_authenticate(self.buyer)
        courier=self.client.get('/api/orders/').data[0]['fulfilment_snapshot']['courier']
        self.assertNotIn('contact_phone',courier);self.assertEqual(courier['reference'],'REF-123')

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_real_status_transition_queues_one_dispatch_update_without_synchronous_mail_or_duplicate_reminder(self,mail):
        result=self.dispatch();self.assertEqual(result.status_code,200,result.data);mail.assert_not_called()
        self.order.refresh_from_db();notice=self.order.fulfilment_snapshot['dispatch_notice']
        self.assertEqual(len(notice['key']),20)
        self.assertEqual(self.dispatch().status_code,200)
        self.order.refresh_from_db();self.assertEqual(self.order.fulfilment_snapshot['dispatch_notice'],notice)
        self.assertEqual(self.send(),{'sent':1,'failed':0});self.assertEqual(self.send(),{'sent':0,'failed':0})
        mail.assert_called_once();self.assertIn('out for delivery',mail.call_args.args[0]);self.assertIn('not provide a live arrival estimate',mail.call_args.args[1])
        self.assertEqual(mail.call_args.args[3],[self.buyer.email]);self.assertEqual(OrderReminder.objects.count(),1)
        self.client.force_authenticate(self.buyer)
        self.assertNotIn('dispatch_notice',self.client.get('/api/orders/').data[0]['fulfilment_snapshot'])

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_legacy_reminder_consent_does_not_subscribe_to_dispatch_emails(self,mail):
        self.order.fulfilment_snapshot['customer_reminder'].pop('dispatch_updates');self.order.save()
        self.assertEqual(self.dispatch().status_code,200)
        self.order.refresh_from_db();self.assertNotIn('dispatch_notice',self.order.fulfilment_snapshot)
        self.assertEqual(self.send()['sent'],1);self.assertIn('reminder',mail.call_args.args[0])

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_failed_update_rolls_back_status_and_queue(self,mail):
        self.assertEqual(self.dispatch(payment_status='paid').status_code,400)
        self.order.refresh_from_db();self.assertEqual(self.order.status,'cooked');self.assertNotIn('dispatch_notice',self.order.fulfilment_snapshot)
        mail.assert_not_called()

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_opt_out_account_email_change_inactive_and_completed_orders_suppress_queued_dispatch(self,mail):
        self.assertEqual(self.dispatch().status_code,200);self.order.refresh_from_db()
        self.client.force_authenticate(self.buyer)
        result=self.client.post(f'/api/orders/{self.order.pk}/reminder/',{'enabled':False},format='json')
        self.assertEqual(result.status_code,200);self.assertEqual(self.send()['sent'],0)
        result=self.client.post(f'/api/orders/{self.order.pk}/reminder/',{'enabled':True,'dispatch_updates':True},format='json')
        self.assertEqual(result.status_code,200)
        self.buyer.email='new@example.test';self.buyer.save();self.assertEqual(self.send()['sent'],0)
        self.buyer.email='buyer@example.test';self.buyer.is_active=False;self.buyer.save();self.assertEqual(self.send()['sent'],0)
        self.buyer.is_active=True;self.buyer.save();self.order.refresh_from_db();self.order.status='delivered';self.order.save()
        self.assertEqual(self.send()['sent'],0);mail.assert_not_called()

    @patch('myapp.services.reminders.send_mail',side_effect=RuntimeError('SMTP unavailable'))
    def test_dispatch_retry_has_no_false_receipt_and_shared_budget_is_bounded(self,mail):
        self.assertEqual(self.dispatch().status_code,200)
        self.assertEqual(self.send(),{'sent':0,'failed':1});self.assertFalse(OrderReminder.objects.exists())
        mail.side_effect=None;mail.return_value=1
        self.assertEqual(self.send()['sent'],1);self.assertEqual(self.send()['sent'],0)

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_stale_dispatch_notice_is_not_sent_as_a_current_update(self,mail):
        self.dispatch();self.order.refresh_from_db()
        self.order.fulfilment_snapshot['dispatch_notice']['created_at']=(timezone.now()-timedelta(hours=25)).isoformat();self.order.save()
        self.assertEqual(self.send()['sent'],0);mail.assert_not_called()

    def test_checkout_saves_instructions_and_separate_dispatch_consent(self):
        from .models import Product,CartItem,Address
        product=Product.objects.create(name='Fixture meal',price=12)
        CartItem.objects.create(user=self.buyer,product=product,quantity=1)
        address=Address.objects.create(user=self.buyer,line1='Fixture',city='KL',state='KL',postal_code='50000',phone='0123456789')
        result=self.client.post('/api/orders/place/',{'address_id':address.pk,'payment':'cod','delivery_at':(timezone.localtime()+timedelta(days=4)).replace(hour=15,minute=0,second=0,microsecond=0).isoformat(),
            'email_reminder':True,'email_dispatch_updates':True,'handover':{'contact_phone':'+60123456789','contact_method':'whatsapp','notes':'Call on arrival'}},format='json')
        self.assertEqual(result.status_code,201,result.data)
        saved=Order.objects.get(pk=result.data['order_id'])
        self.assertEqual(saved.fulfilment_snapshot['handover']['notes'],'Call on arrival')
        self.assertTrue(saved.fulfilment_snapshot['customer_reminder']['dispatch_updates'])


    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_enabling_dispatch_after_handover_does_not_invent_a_notice_or_suppress_the_advance_reminder(self,mail):
        self.order.fulfilment_snapshot['customer_reminder'].pop('dispatch_updates');self.order.save()
        self.assertEqual(self.dispatch().status_code,200)
        self.client.force_authenticate(self.buyer)
        result=self.client.post(f'/api/orders/{self.order.pk}/reminder/',{'enabled':True,'dispatch_updates':True},format='json')
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.send()['sent'],1);self.assertIn('reminder',mail.call_args.args[0])

    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_customer_opt_out_remains_possible_after_the_agreed_time_passed(self,mail):
        self.dispatch();self.order.refresh_from_db();self.order.delivery_at=timezone.now()-timedelta(minutes=1);self.order.save()
        self.client.force_authenticate(self.buyer)
        result=self.client.post(f'/api/orders/{self.order.pk}/reminder/',{'enabled':False},format='json')
        self.assertEqual(result.status_code,200);self.assertEqual(self.send()['sent'],0);mail.assert_not_called()
