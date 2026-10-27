from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import RawMaterial, InventoryItem


class StorageGuidanceTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.owner=User.objects.create_user('guidance-owner',is_staff=True)
        self.client.force_authenticate(self.owner)
        self.url='/api/admin/raw-materials/'
        self.profile={'storage_type':'chilled','shelf_life_days':2,
            'source':'Fixture supplier document, not actual guidance',
            'conditions':'Fixture raw, unopened, chilled conditions'}

    def create(self, guidance=None, **changes):
        body={'name':'Fixture ingredient','unit':'g',**changes}
        if guidance is not None:body['storage_guidance']=guidance
        return self.client.post(self.url,body,format='json')

    def test_optional_and_legacy_patch_do_not_require_or_clear_guidance(self):
        result=self.create();self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['storage_guidance'],[])
        material=RawMaterial.objects.get(pk=result.data['id'])
        material.storage_guidance=[self.profile];material.save()
        result=self.client.patch(self.url+str(material.pk)+'/',{'name':'Renamed fixture'},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['storage_guidance'],[self.profile])

    def test_separate_storage_profiles_round_trip_and_can_be_removed(self):
        profiles=[self.profile,dict(self.profile,storage_type='frozen',shelf_life_days=10)]
        result=self.create(profiles);self.assertEqual(result.status_code,201,result.data)
        listed=self.client.get(self.url).data
        self.assertEqual(listed[0]['storage_guidance'],profiles)
        result=self.client.patch(self.url+str(result.data['id'])+'/',{'storage_guidance':[]},format='json')
        self.assertEqual(result.status_code,200,result.data);self.assertEqual(result.data['storage_guidance'],[])

    def test_invalid_and_ambiguous_profiles_are_rejected_without_writes(self):
        cases=[None,{},'invalid',[self.profile,self.profile],[dict(self.profile,storage_type='fridge')],
            [dict(self.profile,source=' ')],[dict(self.profile,conditions='')],[dict(self.profile,source='s'*141)],
            [dict(self.profile,conditions='c'*156)],[dict(self.profile,unexpected='ignored?')],
            [self.profile]*4]+[[dict(self.profile,shelf_life_days=value)] for value in [0,-1,1.5,True,3651,'bad']]
        for case in cases:
            with self.subTest(case=case):
                result=self.client.post(self.url,{'name':'Fixture','unit':'g','storage_guidance':case},format='json')
                self.assertEqual(result.status_code,400,result.data)
        self.assertFalse(RawMaterial.objects.exists())

    def test_guidance_is_not_automatically_applied_or_retroactive(self):
        material=RawMaterial.objects.create(name='Fixture',unit='g',storage_guidance=[self.profile])
        today=timezone.localdate();printed=today+timedelta(days=1)
        lot=InventoryItem.objects.create(raw_material=material,quantity=10,received_date=today,expiry_date=printed,original_expiry_date=printed)
        before=(lot.expiry_date,lot.original_expiry_date,lot.guidance_note,lot.shelf_life_days,lot.updated_at)
        result=self.client.patch(self.url+str(material.pk)+'/',{'storage_guidance':[dict(self.profile,shelf_life_days=30)]},format='json')
        self.assertEqual(result.status_code,200,result.data)
        lot.refresh_from_db()
        self.assertEqual((lot.expiry_date,lot.original_expiry_date,lot.guidance_note,lot.shelf_life_days,lot.updated_at),before)
        body={'raw_material':material.pk,'quantity':5,'received_date':str(today),'expiry_basis':'storage','storage_location':'Fixture fridge'}
        self.assertEqual(self.client.post('/api/admin/inventory-items/',body,format='json').status_code,400)
        body.update(shelf_life_days=self.profile['shelf_life_days'],guidance_note=self.profile['source']+'; '+self.profile['conditions'],original_expiry_date=str(printed))
        result=self.client.post('/api/admin/inventory-items/',body,format='json')
        self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['expiry_date'],str(printed))
        self.assertEqual(result.data['guidance_note'],body['guidance_note'])

    def test_customer_and_anonymous_cannot_read_or_change_guidance(self):
        for user in [None,User.objects.create_user('guidance-customer')]:
            self.client.force_authenticate(user)
            self.assertIn(self.client.get(self.url).status_code,[401,403])
            self.assertIn(self.create([self.profile]).status_code,[401,403])

    def test_whitespace_trim_and_maximum_notes_fit_batch_evidence(self):
        profile=dict(self.profile,source='  fixture source  ',conditions='  fixture conditions  ')
        result=self.create([profile]);self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['storage_guidance'][0]['source'],'fixture source')
        profile=dict(self.profile,source='s'*140,conditions='c'*155)
        result=self.create([profile],name='Maximum fixture');self.assertEqual(result.status_code,201,result.data)
        self.assertLessEqual(len(profile['source']+'; '+profile['conditions']),300)
