"""Full phone validation and staff contact storage, without changing sign-in."""
from django.contrib.auth.models import User
from django.test import TestCase
from django.test import override_settings
from django.core import mail
from urllib.parse import urlsplit, parse_qs
from rest_framework.test import APIClient
from .models import CustomerAccount
from .services.guest_ordering import CustomerInput


class CheckoutContactTests(TestCase):
    def setUp(self):
        self.staff=User.objects.create_user('contact-owner',password='Private-fixture-password!2026',is_staff=True,
                                          first_name='Kitchen',last_name='Owner')
        self.other=User.objects.create_user('another-contact-owner',is_staff=True)
        self.client=APIClient();self.client.force_login(self.staff)

    def test_supported_phone_formats_normalise_and_prefix_only_is_rejected(self):
        for phone in ('01112345678','011 1234 5678','+60 11 1234 5678','601112345678'):
            form=CustomerInput(data={'name':'Owner','phone':phone})
            self.assertTrue(form.is_valid(),form.errors)
            self.assertEqual(form.validated_data['phone'],'+601112345678')
        form=CustomerInput(data={'name':'Owner','phone':'011'})
        self.assertFalse(form.is_valid());self.assertIn('full phone number',str(form.errors))

    def test_staff_profile_phone_is_private_normalised_and_does_not_change_credentials(self):
        original=self.staff.password
        self.assertEqual(self.client.get('/api/account/').data['phone'],'')
        result=self.client.patch('/api/account/',{'phone':'011 1234 5678','id':self.other.pk,
            'username':'attempted-change','is_staff':False},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['phone'],'+601112345678')
        self.staff.refresh_from_db();self.assertEqual(self.staff.password,original)
        self.assertEqual(self.staff.username,'contact-owner');self.assertTrue(self.staff.is_staff)
        self.assertFalse(CustomerAccount.objects.filter(user=self.other).exists())
        self.assertTrue(self.client.get('/api/check-auth/').data['is_admin'])

    def test_invalid_phone_does_not_partly_save_name(self):
        result=self.client.patch('/api/account/',{'first_name':'Changed','phone':'011'},format='json')
        self.assertEqual(result.status_code,400,result.data)
        self.staff.refresh_from_db();self.assertEqual(self.staff.first_name,'Kitchen')
        self.assertFalse(CustomerAccount.objects.filter(user=self.staff).exists())


@override_settings(PUBLIC_APP_URL='https://kitchen.example', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class RecoveryRoundtripTests(TestCase):
    def test_staff_recovery_email_link_resets_password_once_and_new_password_signs_in(self):
        old='Private-old-password!2026';new='Private-updated-password!2026'
        user=User.objects.create_user('recovery-contact-owner',password=old,is_staff=True,email='owner@example.test')
        client=APIClient()
        result=client.post('/api/auth/recovery/',{'email':user.email},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(len(mail.outbox),1);self.assertEqual(mail.outbox[0].to,[user.email])
        link=next(line for line in mail.outbox[0].body.splitlines() if line.startswith('https://'))
        fields=parse_qs(urlsplit(link).fragment)
        payload={'uid':fields['uid'][0],'token':fields['token'][0],'password':new}
        result=client.post('/api/auth/recovery/confirm/',payload,format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(client.post('/api/auth/recovery/confirm/',payload,format='json').status_code,400)
        user.refresh_from_db();self.assertTrue(user.check_password(new));self.assertFalse(user.check_password(old))
        self.assertEqual(client.post('/api/login/',{'identifier':user.email,'password':new},format='json').status_code,200)

    def test_passwordless_customer_is_not_recovered_by_email_or_phone(self):
        user=User.objects.create_user('passkey-only-contact',email='passkey@example.test')
        user.set_unusable_password();user.save()
        CustomerAccount.objects.create(user=user,name='Customer',phone='+601112345678')
        client=APIClient()
        result=client.post('/api/auth/recovery/',{'email':user.email},format='json')
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(mail.outbox),0)
        user.refresh_from_db();self.assertFalse(user.has_usable_password())
