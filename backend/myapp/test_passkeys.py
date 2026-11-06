"""Real locally generated ES256 signatures; no external authentication service."""
import hashlib
import json
import secrets
import struct
import uuid
from datetime import timedelta
import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from django.contrib.auth.models import User
from django.test import TestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from webauthn.helpers import bytes_to_base64url as b64,base64url_to_bytes as unb64
from .models import CustomerAccount,CustomerPasskey,PasskeyCeremony,GuestCustomer,Storefront,CartItem,Product,Order

BASE='/api/account/passkeys/'
ORIGIN='https://kitchen.example'


class Authenticator:
    def __init__(self):
        self.key=ec.generate_private_key(ec.SECP256R1())
        self.id=secrets.token_bytes(32)
        pub=self.key.public_key().public_numbers()
        self.public=cbor2.dumps({1:2,3:-7,-1:1,-2:pub.x.to_bytes(32,'big'),-3:pub.y.to_bytes(32,'big')})
        self.counter=0

    def response(self,options,register=False,origin=ORIGIN,uv=True,challenge=None,handle=None,backup=False):
        opts=options['options']
        rp=opts['rp']['id'] if register else opts['rpId']
        client=json.dumps(dict(type='webauthn.create' if register else 'webauthn.get',
            challenge=challenge or opts['challenge'],origin=origin,crossOrigin=False)).encode()
        flag=1+(4 if uv else 0)+(64 if register else 0)+(8 if backup else 0)
        auth=hashlib.sha256(rp.encode()).digest()+bytes([flag])+struct.pack('>I',self.counter)
        response={'clientDataJSON':b64(client)}
        if register:
            self.handle=opts['user']['id']
            auth+=bytes(16)+struct.pack('>H',len(self.id))+self.id+self.public
            response['attestationObject']=b64(cbor2.dumps({'fmt':'none','attStmt':{},'authData':auth}))
        else:
            response.update(authenticatorData=b64(auth),signature=b64(self.key.sign(auth+hashlib.sha256(client).digest(),ec.ECDSA(hashes.SHA256()))),
                userHandle=handle or self.handle)
        return {'ceremony_id':options['ceremony_id'],'credential':dict(id=b64(self.id),rawId=b64(self.id),type='public-key',response=response,clientExtensionResults={})}


@override_settings(PASSKEY_ORIGIN=ORIGIN,CSRF_TRUSTED_ORIGINS=[ORIGIN])
class PasskeyTests(TestCase):
    def setUp(self):
        Storefront.objects.create(pk=1)
        self.client=self.guest()
        self.owner=self.client.get('/api/check-auth/').data['user_id']
        self.contact={'name':'Local customer','phone':'+60123456789'}

    def guest(self):
        c=APIClient(enforce_csrf_checks=True)
        c.get('/api/check-auth/')
        c.post('/api/guest-session/',{},format='json',HTTP_X_CSRFTOKEN=c.cookies['csrftoken'].value)
        return c

    def post(self,path,data,client=None):
        c=client or self.client
        return c.post(BASE+path+'/',data,format='json',HTTP_X_CSRFTOKEN=c.cookies['csrftoken'].value,HTTP_ORIGIN=ORIGIN)

    def register(self,client=None,auth=None):
        c=client or self.client;auth=auth or Authenticator()
        r=self.post('register/options',self.contact,c);self.assertEqual(r.status_code,200,r.data)
        r=self.post('register/verify',auth.response(r.data,register=True),c);self.assertEqual(r.status_code,201,r.data)
        return auth

    def test_registration_upgrades_same_user_basket_orders_and_no_password_email(self):
        p=Product.objects.create(name='Meal',price=10)
        CartItem.objects.create(user_id=self.owner,product=p,quantity=2)
        order=Order.objects.create(user_id=self.owner,total_amount=20)
        self.register()
        auth=self.client.get('/api/check-auth/').data
        self.assertEqual(auth['user_id'],self.owner);self.assertFalse(auth['is_guest']);self.assertEqual(auth['customer_account'],self.contact)
        self.assertEqual(CartItem.objects.get(user_id=self.owner).quantity,2)
        self.assertEqual(Order.objects.get(pk=order.pk).user_id,self.owner)
        user=User.objects.get(pk=self.owner)
        self.assertEqual(user.email,'');self.assertFalse(user.has_usable_password());self.assertFalse(user.is_staff)
        profile=self.client.get('/api/account/customer/').data
        self.assertEqual(len(profile['passkeys']),1)
        self.assertNotIn('public_key',profile['passkeys'][0]);self.assertNotIn('credential_id',profile['passkeys'][0])

    def test_registration_accepts_local_phone_and_saves_international_contact(self):
        self.contact['phone']='012 345 6789'
        self.register()
        self.assertEqual(self.client.get('/api/check-auth/').data['customer_account']['phone'],'+60123456789')

    def test_registration_rejects_prefix_only_then_accepts_full_011_mobile(self):
        self.contact['phone']='011'
        result=self.post('register/options',self.contact)
        self.assertEqual(result.status_code,400,result.data)
        self.assertIn('full phone number',str(result.data))
        self.assertFalse(CustomerAccount.objects.exists());self.assertFalse(CustomerPasskey.objects.exists())
        self.contact['phone']='011 1234 5678'
        self.register()
        self.assertEqual(self.client.get('/api/check-auth/').data['customer_account']['phone'],'+601112345678')

    def test_new_device_signin_loads_original_account_not_matching_phone(self):
        key=self.register();other=self.guest()
        other_id=other.get('/api/check-auth/').data['user_id']
        options=self.post('signin/options',{},other).data
        key.counter=1
        r=self.post('signin/verify',key.response(options),other)
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(other.get('/api/check-auth/').data['user_id'],self.owner)
        self.assertNotEqual(other_id,self.owner)
        # Another verified, independently created account may share a household
        # phone. A contact number never links two users or their order history.
        third=self.guest();self.register(third)
        self.assertEqual(CustomerAccount.objects.filter(phone=self.contact['phone']).count(),2)
        self.assertNotEqual(third.get('/api/check-auth/').data['user_id'],self.owner)

    def test_challenge_single_use_wrong_origin_and_uv_rejected(self):
        for changes in ({'origin':'https://evil.example'},{'uv':False},{'challenge':b64(b'wrong')}):
            key=Authenticator();options=self.post('register/options',self.contact).data
            response=key.response(options,register=True,**changes)
            r=self.post('register/verify',response);self.assertEqual(r.status_code,400,r.data)
            self.assertIsNotNone(PasskeyCeremony.objects.get(pk=options['ceremony_id']).consumed_at)
            valid=key.response(options,register=True)
            self.assertEqual(self.post('register/verify',valid).status_code,400)
        self.assertFalse(CustomerAccount.objects.exists())

    def test_expired_wrong_session_and_wrong_action(self):
        key=Authenticator();options=self.post('register/options',self.contact).data
        response=key.response(options,register=True)
        other=self.guest()
        self.assertEqual(self.post('register/verify',response,other).status_code,400)
        self.assertIsNone(PasskeyCeremony.objects.get(pk=options['ceremony_id']).consumed_at)
        self.assertEqual(self.post('signin/verify',response).status_code,400)
        PasskeyCeremony.objects.filter(pk=options['ceremony_id']).update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.post('register/verify',response).status_code,400)

    def test_signin_signature_userhandle_disabled_user_and_counter_checked(self):
        auth=self.register()
        for mutation in ['signature','handle','counter','eligibility','disabled']:
            options=self.post('signin/options',{}).data
            auth.counter=1 if mutation!='counter' else 0
            body=auth.response(options,backup=mutation=='eligibility',handle=b64(uuid.uuid4().bytes) if mutation=='handle' else None)
            if mutation=='signature':body['credential']['response']['signature']=b64(b'bad')
            if mutation=='counter':CustomerPasskey.objects.update(sign_count=4)
            if mutation=='disabled':User.objects.filter(pk=self.owner).update(is_active=False)
            self.assertEqual(self.post('signin/verify',body).status_code,400,mutation)
            if mutation!='disabled':self.assertIsNotNone(PasskeyCeremony.objects.get(pk=options['ceremony_id']).consumed_at)
            User.objects.filter(pk=self.owner).update(is_active=True)
            CustomerPasskey.objects.update(sign_count=0)

    def test_zero_counter_synced_passkey_can_sign_in_and_replay_cannot(self):
        auth=self.register();options=self.post('signin/options',{}).data;body=auth.response(options)
        self.assertEqual(self.post('signin/verify',body).status_code,200)
        self.assertEqual(self.post('signin/verify',body).status_code,400)

    def test_security_edits_need_recent_confirmation_last_key_kept_owner_only(self):
        self.register();key=CustomerPasskey.objects.get()
        self.assertEqual(self.client.delete(BASE+str(key.pk)+'/',HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value).status_code,400)
        session=self.client.session;session['passkey_verified_at']=0;session.save()
        self.assertEqual(self.post('register/options',self.contact).status_code,403)
        r=self.client.patch('/api/account/customer/',self.contact,format='json',HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)
        self.assertEqual(r.status_code,403)
        other=self.guest();self.register(other)
        self.assertEqual(other.delete(BASE+str(key.pk)+'/',HTTP_X_CSRFTOKEN=other.cookies['csrftoken'].value).status_code,400)
        self.assertTrue(CustomerPasskey.objects.filter(pk=key.pk).exists())

    def test_reauthentication_profile_edit_backup_key_and_revocation(self):
        auth=self.register();first=CustomerPasskey.objects.get()
        options=self.post('reauth/options',{}).data
        self.assertEqual(self.post('reauth/verify',auth.response(options)).status_code,200)
        self.register()  # Add backup without changing account/contact handle.
        updated={**self.contact,'name':'New contact name'}
        r=self.client.patch('/api/account/customer/',updated,format='json',HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data['name'],'New contact name')
        # The earlier key's active session must no longer access private orders
        # after the owner removes it using their backup.
        other=self.guest();options=self.post('signin/options',{},other).data
        self.assertEqual(self.post('signin/verify',auth.response(options),other).status_code,200)
        r=self.client.delete(BASE+str(first.pk)+'/',HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)
        self.assertEqual(r.status_code,204,r.data)
        self.assertEqual(other.get('/api/check-auth/').data,{'authenticated':False})
        self.assertIn(other.get('/api/orders/').status_code,(401,403))

    def test_csrf_and_staff_separation_and_json_bounds(self):
        anon=APIClient(enforce_csrf_checks=True)
        self.assertEqual(anon.post(BASE+'signin/options/',{},format='json').status_code,403)
        staff=User.objects.create_user('staff-passkey-test',is_staff=True,password='Local-only-password!')
        c=APIClient();c.force_login(staff)
        r=c.post(BASE+'register/options/',self.contact,format='json')
        self.assertEqual(r.status_code,403)
        self.assertTrue(c.get('/api/check-auth/').data['is_admin'])
        response={'ceremony_id':str(uuid.uuid4()),'credential':{'id':'x','response':[]}}
        self.assertEqual(self.post('signin/verify',response).status_code,400)

    def test_configuration_not_controlled_by_origin_or_host(self):
        r=self.client.post(BASE+'signin/options/',{},format='json',HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value,HTTP_ORIGIN='https://evil.example')
        self.assertEqual(r.status_code,403)
        with override_settings(PASSKEY_ORIGIN='http://evil.example'):
            self.assertEqual(self.post('signin/options',{}).status_code,400)

    def test_new_begin_invalidates_old_registration_and_private_cache(self):
        options=self.post('register/options',self.contact).data
        r=self.post('register/options',self.contact)
        self.assertIn('no-store',r['Cache-Control'])
        self.assertIsNotNone(PasskeyCeremony.objects.get(pk=options['ceremony_id']).consumed_at)
        self.assertEqual(PasskeyCeremony.objects.filter(consumed_at__isnull=True).count(),1)


from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from threading import Barrier
from unittest import skipUnless
from django.db import connection,connections
from django.test import TransactionTestCase


@skipUnless(connection.vendor=='postgresql','Row-lock concurrency requires PostgreSQL')
@override_settings(PASSKEY_ORIGIN=ORIGIN,CSRF_TRUSTED_ORIGINS=[ORIGIN])
class PasskeyConcurrencyTests(TransactionTestCase):
    setUp=PasskeyTests.setUp
    guest=PasskeyTests.guest
    post=PasskeyTests.post
    register=PasskeyTests.register

    def test_concurrent_assertion_replay_authenticates_once(self):
        auth=self.register()
        options=self.post('signin/options',{}).data
        body=auth.response(options)
        cookies=deepcopy(self.client.cookies)
        barrier=Barrier(2)
        def attempt():
            client=APIClient(enforce_csrf_checks=True);client.cookies=deepcopy(cookies)
            try:
                barrier.wait(timeout=10)
                return self.post('signin/verify',body,client).status_code
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda _:attempt(),range(2)))
        self.assertEqual(sorted(statuses),[200,400])
