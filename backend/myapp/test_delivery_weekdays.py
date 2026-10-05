from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Product, Storefront
from .serializers import ProductSerializer
from .services.scheduling import schedule_order
from .services.commitments import preparation_snapshot
from types import SimpleNamespace

class DeliveryWeekdayTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(name='Saturday rice', price=12, lead_hours=1)
        self.store = Storefront.objects.create(pk=1)
        self.delivery = (timezone.localtime()+timedelta(days=8)).replace(hour=16,minute=0,second=0,microsecond=0)
        self.item = SimpleNamespace(product=self.product,product_id=self.product.pk,quantity=1)

    def test_default_keeps_flexible_preorders(self):
        self.assertEqual(self.product.delivery_weekdays, [])
        self.assertIsNotNone(schedule_order([self.item],self.delivery,self.store))

    def test_allowed_and_disallowed_delivery_day(self):
        self.product.delivery_weekdays=[self.delivery.weekday()]
        self.assertIsNotNone(schedule_order([self.item],self.delivery,self.store))
        with self.assertRaisesMessage(ValidationError,'is delivered on'):
            schedule_order([self.item],self.delivery+timedelta(days=1),self.store)

    def test_rule_uses_malaysia_date(self):
        from datetime import timezone as dt_timezone
        self.product.delivery_weekdays=[self.delivery.weekday()]
        self.assertIsNotNone(schedule_order([self.item],self.delivery.astimezone(dt_timezone.utc),self.store))

    def test_invalid_rules_rejected(self):
        for value in [None,{},'Monday',[7],[-1],[True],[1.5],[1,1]]:
            serializer=ProductSerializer(self.product,data={'delivery_weekdays':value},partial=True)
            self.assertFalse(serializer.is_valid(),value)
        serializer=ProductSerializer(self.product,data={'delivery_weekdays':[6,0]},partial=True)
        self.assertTrue(serializer.is_valid(),serializer.errors)
        self.assertEqual(serializer.validated_data['delivery_weekdays'],[0,6])

    def test_accepted_snapshot_retains_original_weekdays(self):
        self.product.delivery_weekdays=[self.delivery.weekday()]
        snapshot=preparation_snapshot(self.product)
        self.product.delivery_weekdays=[(self.delivery.weekday()+1)%7]
        accepted=SimpleNamespace(product=SimpleNamespace(id=self.product.pk,name=self.product.name,**snapshot),product_id=self.product.pk,quantity=1)
        self.assertIsNotNone(schedule_order([accepted],self.delivery,self.store,exclude_order_id=123))
        with self.assertRaisesMessage(ValidationError,'is delivered on'):
            schedule_order([accepted],self.delivery+timedelta(days=1),self.store,exclude_order_id=123)

    def test_legacy_snapshot_keeps_flexible_dates(self):
        snapshot=preparation_snapshot(self.product)
        snapshot.pop('delivery_weekdays')
        accepted=SimpleNamespace(product=SimpleNamespace(id=self.product.pk,name=self.product.name,**snapshot),product_id=self.product.pk,quantity=1)
        self.assertIsNotNone(schedule_order([accepted],self.delivery,self.store,exclude_order_id=123))

    def test_mixed_basket_requires_a_shared_delivery_day(self):
        other = Product.objects.create(name='Weekend curry', price=15, lead_hours=1)
        day = self.delivery.weekday()
        self.product.delivery_weekdays = [day, (day+1)%7]
        other.delivery_weekdays = [day, (day+2)%7]
        items = [self.item, SimpleNamespace(product=other, product_id=other.pk, quantity=1)]
        self.assertIsNotNone(schedule_order(items, self.delivery, self.store))
        for offset in [1, 2]:
            with self.assertRaisesMessage(ValidationError, 'is delivered on'):
                schedule_order(items, self.delivery+timedelta(days=offset), self.store)

    def test_slot_api_uses_current_rules_for_an_existing_basket(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from .models import CartItem
        client = APIClient()
        buyer = User.objects.create_user('weekday-buyer')
        client.force_authenticate(buyer)
        other = Product.objects.create(name='Curry', price=15, lead_hours=1)
        for product in [self.product, other]:
            CartItem.objects.create(user=buyer, product=product, quantity=1)
        payload = {'date': self.delivery.date().isoformat()}
        response = client.post('/api/orders/slots/', payload)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['slots'])
        other.delivery_weekdays = [(self.delivery.weekday()+1)%7]
        other.save()
        self.assertEqual(client.post('/api/orders/slots/', payload).data['slots'], [])
        other.delivery_weekdays = []
        other.selling_status = 'paused'
        other.save()
        self.assertEqual(client.post('/api/orders/slots/', payload).data['slots'], [])
        other.selling_status = 'active'
        other.save()
        self.assertTrue(client.post('/api/orders/slots/', payload).data['slots'])
