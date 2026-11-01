"""Actual row locking for placement, shared ingredient stock and retry identity."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from datetime import timedelta
import uuid
from django.contrib.auth.models import User
from django.db import connection,connections,close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront,Product,RawMaterial,ProductIngredient,InventoryItem,CartItem,Address,Order,IngredientConsumption


@skipUnless(connection.vendor=='postgresql','Real PostgreSQL row locks required')
class SimplePlacementLocks(TransactionTestCase):
    def setUp(self):
        Storefront.objects.create(pk=1,manual_payment_enabled=True,bank_transfer_instructions='Local test instructions')
        self.raw=RawMaterial.objects.create(name='Rice',unit='g')
        today=timezone.localdate()
        self.stock=InventoryItem.objects.create(raw_material=self.raw,quantity=500,received_date=today,
            expiry_date=today+timedelta(days=20),storage_location='Dry shelf')
        self.buyers=[]
        self.addresses=[]
        for i in range(2):
            buyer=User.objects.create_user('simple-lock-'+str(i));self.buyers.append(buyer)
            product=Product.objects.create(name='Meal '+str(i),price=10)
            ProductIngredient.objects.create(product=product,raw_material=self.raw,quantity_required=100)
            CartItem.objects.create(user=buyer,product=product,quantity=3)
            self.addresses.append(Address.objects.create(user=buyer,line1='Test',city='KL',state='KL',postal_code='50000',phone='0100000000'))
        self.delivery=(timezone.localtime()+timedelta(days=3)).replace(hour=10,minute=0,second=0,microsecond=0)

    def requests(self,rows):
        barrier=Barrier(2)
        def run(row):
            buyer,address,key=row;close_old_connections()
            try:
                c=APIClient();c.force_authenticate(buyer);barrier.wait(timeout=10)
                r=c.post('/api/orders/place/',dict(payment='manual',address_id=address.pk,request_id=key,
                    delivery_at=self.delivery.isoformat()),format='json')
                return r.status_code,dict(r.data) if isinstance(r.data,dict) else list(r.data)
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(run,rows))

    def test_different_menus_cannot_oversell_one_ingredient(self):
        results=self.requests([(self.buyers[i],self.addresses[i],str(uuid.uuid4())) for i in range(2)])
        self.assertCountEqual([r[0] for r in results],[201,400],results)
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,200)
        self.assertEqual(Order.objects.count(),1);self.assertEqual(IngredientConsumption.objects.count(),1)

    def test_same_reference_concurrent_retry_returns_one_deduction(self):
        key=str(uuid.uuid4());row=(self.buyers[0],self.addresses[0],key)
        results=self.requests([row,row]);self.assertCountEqual([r[0] for r in results],[201,200],results)
        self.assertEqual(results[0][1]['order_id'],results[1][1]['order_id'])
        self.stock.refresh_from_db();self.assertEqual(self.stock.quantity,200)
        self.assertEqual(Order.objects.count(),1);self.assertEqual(IngredientConsumption.objects.count(),1)
