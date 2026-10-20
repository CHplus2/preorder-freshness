"""Reviews, recovery, cron and download boundaries; never sends real email."""
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, SimpleTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Product, Review, Order, OrderReminder
from .services.reminders import send_due_reminders


class ReviewPageTests(TestCase):
    def setUp(self):
        self.product=Product.objects.create(name='Reviewed meal',price=10)
        users=User.objects.bulk_create([User(username=f'public-review-{i}') for i in range(25)])
        self.reviews=Review.objects.bulk_create([Review(product=self.product,user=u,rating=5,comment=f'Experience {i}') for i,u in enumerate(users)])
        self.client=APIClient();self.url=f'/api/products/{self.product.pk}/reviews/'

    def test_bounded_pages_keep_the_array_contract_and_do_not_lose_older_reviews(self):
        with CaptureQueriesContext(connection) as queries:
            first=self.client.get(self.url)
        self.assertEqual(first.status_code,200)
        self.assertIsInstance(first.data,list);self.assertEqual(len(first.data),20)
        self.assertLessEqual(len(queries),2)
        cursor=first['X-Next-Review-Before']
        self.assertEqual(int(cursor),first.data[-1]['id'])
        second=self.client.get(self.url,{'before':cursor})
        self.assertEqual(second.status_code,200)
        self.assertEqual(len(second.data),5);self.assertNotIn('X-Next-Review-Before',second)
        ids=[r['id'] for r in first.data+second.data]
        self.assertEqual(ids,sorted([r.pk for r in self.reviews],reverse=True))
        for row in first.data:
            self.assertNotIn('email',row);self.assertNotIn('user_id',row)

    def test_invalid_review_cursors_return_400(self):
        for query in ['?before=0','?before=-1','?before=NaN','?before='+('9'*100),
                      '?before=4&before=5','?unexpected=1']:
            self.assertEqual(self.client.get(self.url+query).status_code,400)


class MailBoundaryTests(TestCase):
    def setUp(self):
        self.client=APIClient(enforce_csrf_checks=True)
        self.client.get('/api/check-auth/')
        self.csrf=self.client.cookies['csrftoken'].value
        self.user=User.objects.create_user('recovery-boundary',password='Fixture-strong-password!2026',email='fixture@example.test')

    def post(self,body,route='/api/auth/recovery/'):
        return self.client.post(route,body,format='json',HTTP_X_CSRFTOKEN=self.csrf)

    def test_non_object_recovery_bodies_return_400(self):
        for route in ['/api/auth/recovery/','/api/auth/recovery/confirm/']:
            for body in [[],['wrong'],'wrong']:
                self.assertEqual(self.post(body,route).status_code,400)

    @override_settings(PUBLIC_APP_URL='https://kitchen.example',EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    @patch('django.core.mail.send_mail',side_effect=RuntimeError('private-mail-credential-fixture'))
    def test_mail_failure_does_not_change_the_generic_recovery_response(self,send):
        with self.assertLogs('myapp.services.recovery_email',level='WARNING') as captured:
            known=self.post({'username':self.user.username,'email':self.user.email})
        unknown=self.post({'username':'missing-account','email':'absent@example.test'})
        self.assertEqual(known.status_code,200);self.assertEqual(known.data,unknown.data)
        text=' '.join(captured.output)
        for private in [self.user.email,'private-mail-credential-fixture','token=']:
            self.assertNotIn(private,text)
        send.assert_called_once()

    @patch('django.core.mail.send_mail')
    def test_console_and_unsafe_reset_origins_do_not_emit_tokens(self,send):
        cases=[('https://kitchen.example','django.core.mail.backends.console.EmailBackend'),
               ('http://public.example','django.core.mail.backends.locmem.EmailBackend'),
               ('https://user:pass@kitchen.example','django.core.mail.backends.locmem.EmailBackend'),
               ('https://kitchen.example/?next=elsewhere','django.core.mail.backends.locmem.EmailBackend')]
        for origin,backend in cases:
            with override_settings(PUBLIC_APP_URL=origin,EMAIL_BACKEND=backend):
                response=self.post({'username':self.user.username,'email':self.user.email})
                self.assertEqual(response.status_code,200)
        send.assert_not_called()
        from .services.recovery_email import reset_origin
        for origin in ['https://kitchen.example?','https://kitchen.example#']:
            with override_settings(PUBLIC_APP_URL=origin):self.assertIsNone(reset_origin())

    @override_settings(CRON_SECRET='fixture-cron-credential-at-least-32-characters')
    def test_non_ascii_cron_credential_is_denied_without_server_error(self):
        response=self.client.get('/api/reminders/run/',HTTP_AUTHORIZATION='Bearer é-not-the-secret')
        self.assertEqual(response.status_code,401)


class ReminderWorkTests(TestCase):
    @patch('myapp.services.reminders.send_mail',return_value=1)
    def test_already_notified_history_does_not_add_per_order_queries(self,send):
        user=User.objects.create_user('reminder-history-fixture')
        due=timezone.now()+timedelta(hours=2)
        orders=Order.objects.bulk_create([Order(user=user,delivery_at=due) for _ in range(80)])
        OrderReminder.objects.bulk_create([OrderReminder(order=o,event='delivery_at') for o in orders])
        pending=Order.objects.create(user=user,delivery_at=due)
        with CaptureQueriesContext(connection) as queries:
            result=send_due_reminders(limit=1)
        self.assertEqual(result,{'sent':1,'failed':0});send.assert_called_once()
        self.assertLessEqual(len(queries),12)
        self.assertTrue(OrderReminder.objects.filter(order=pending,event='delivery_at').exists())


class BackupConfigurationTests(SimpleTestCase):
    def test_invalid_configured_digest_returns_sanitized_unavailable(self):
        from predictive_ai.bundle_export import verified_bundle_response
        with TemporaryDirectory() as folder:
            path=Path(folder)/'runtime-bundle.tar.gz';path.write_bytes(b'fixture archive')
            for digest in ['é'*64,None,'not-a-digest']:
                with override_settings(PREDICTIVE_ARTIFACT_DIR=folder,FRESHCAST_BUNDLE_SHA256=digest):
                    response=verified_bundle_response()
                    self.assertEqual(response.status_code,503)
                    self.assertNotIn(folder,response.content.decode())
