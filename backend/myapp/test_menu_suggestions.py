import uuid
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Category, Product, ProductIngredient, RawMaterial, Order, OrderItem, RecommendationSession, RecommendationEvent


@override_settings(RECOMMENDATION_EXPERIMENT=False)
class MenuSuggestionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user('suggestion-buyer')
        self.other = User.objects.create_user('another-buyer')
        self.category = Category.objects.create(name='Rice meals')
        material = RawMaterial.objects.create(name='Rice', unit='g')
        self.menus = []
        for n in range(5):
            menu = Product.objects.create(name=f'Kitchen meal {n}', price=10+n, category=self.category)
            ProductIngredient.objects.create(product=menu, raw_material=material, quantity_required=100)
            self.menus.append(menu)

    def sale(self, user, menu, quantity=1, paid='paid', status='delivered'):
        order = Order.objects.create(user=user, status=status, payment_status=paid, delivery_at=timezone.now()-timedelta(days=1), total_amount=menu.price*quantity)
        OrderItem.objects.create(order=order, product=menu, product_name=menu.name, quantity=quantity, unit_price=menu.price, subtotal=menu.price*quantity)
        return order

    def test_guest_gets_three_active_recipe_menus_without_stock_or_a_delivery_promise(self):
        self.menus[0].selling_status='archived';self.menus[0].save()
        self.menus[1].selling_status='paused';self.menus[1].save()
        Product.objects.create(name='No recipe', price=2)
        response=self.client.post('/api/menu/suggestions/', {}, format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual([row['id'] for row in response.data['results']], [menu.pk for menu in self.menus[2:]])
        self.assertEqual(response.data['basis'],'menu')
        self.assertTrue(all('slots' not in row and row['reasons'] for row in response.data['results']))
        session=RecommendationSession.objects.get(pk=response.data['session'])
        self.assertEqual(session.context['surface'],'menu_cards')
        self.assertEqual(session.products,[menu.pk for menu in self.menus[2:]])

    def test_history_ranking_is_personal_but_guest_uses_recent_paid_popularity(self):
        self.sale(self.buyer,self.menus[4],4)
        self.sale(self.other,self.menus[2],20)
        self.sale(self.other,self.menus[3],100,paid='unpaid')
        self.sale(self.buyer,self.menus[1],100,status='cancelled')
        self.client.force_authenticate(self.buyer)
        data=self.client.post('/api/menu/suggestions/',{}).data
        self.assertEqual(data['basis'],'history')
        self.assertEqual(data['results'][0]['id'],self.menus[4].pk)
        self.assertIn('You bought this before (x4)',data['results'][0]['reasons'])
        self.client.force_authenticate(None)
        guest=self.client.post('/api/menu/suggestions/',{}).data
        self.assertEqual(guest['basis'],'popularity')
        self.assertEqual(guest['results'][0]['id'],self.menus[2].pk)
        self.assertFalse(any(reason.startswith('You ') for row in guest['results'] for reason in row['reasons']))

    def test_empty_results_are_not_an_impression_and_events_are_session_bound(self):
        data=self.client.post('/api/menu/suggestions/',{}).data
        event={'session':data['session'],'event':'impression','request_id':str(uuid.uuid4())}
        self.assertEqual(APIClient().post('/api/recommendation/events/',event).status_code,400)
        self.assertEqual(self.client.post('/api/recommendation/events/',event).status_code,200)
        self.client.post('/api/recommendation/events/',{**event,'request_id':str(uuid.uuid4())})
        self.assertEqual(RecommendationEvent.objects.filter(session_id=data['session']).count(),1)
        Product.objects.all().update(selling_status='archived')
        empty=self.client.post('/api/menu/suggestions/',{}).data
        self.assertEqual(empty['results'],[])
        result=self.client.post('/api/recommendation/events/',{**event,'session':empty['session'],'request_id':str(uuid.uuid4())})
        self.assertEqual(result.data,{'recorded':False})

    @override_settings(RECOMMENDATION_EXPERIMENT=True)
    def test_existing_popularity_assignment_is_preserved(self):
        self.sale(self.buyer,self.menus[4],1)
        self.sale(self.other,self.menus[2],25)
        session=self.client.session;session['discovery_variant']='popularity';session.save()
        self.client.force_authenticate(self.buyer)
        data=self.client.post('/api/menu/suggestions/',{}).data
        self.assertEqual(data['basis'],'popularity')
        self.assertEqual(data['results'][0]['id'],self.menus[2].pk)
        self.assertEqual(RecommendationSession.objects.get(pk=data['session']).variant,'popularity')

    def test_date_guide_distinguishes_empty_category_filters_and_kitchen_times(self):
        from unittest.mock import patch
        date=str(timezone.localdate()+timedelta(days=3))
        bakes=Category.objects.create(name='Bakes')
        unavailable=self.client.post('/api/menu/guide/',{'date':date,'portions':2,'category':bakes.pk},format='json')
        self.assertEqual(unavailable.status_code,200)
        self.assertEqual(unavailable.data['empty_reason'],'category_unavailable')
        matches=self.client.post('/api/menu/guide/',{'date':date,'budget':'0.01'},format='json')
        self.assertEqual(matches.data['empty_reason'],'no_menu_match')
        with patch('myapp.views.discovery.slots',return_value=[]):
            times=self.client.post('/api/menu/guide/',{'date':date},format='json')
        self.assertEqual(times.data['empty_reason'],'no_kitchen_times')

    def test_date_guide_rejects_invalid_ranges(self):
        date=str(timezone.localdate()+timedelta(days=3))
        bodies=[{'date':'bad'}, {'date':str(timezone.localdate()-timedelta(days=1))},
                {'date':str(timezone.localdate()+timedelta(days=91))},
                {'date':date,'portions':0}, {'date':date,'portions':101}, {'date':date,'portions':1.5},
                {'date':date,'budget':'-1'}, {'date':date,'budget':'0.001'}, {'date':date,'budget':'100000000.00'}]
        for body in bodies:
            with self.subTest(body=body):
                self.assertEqual(self.client.post('/api/menu/guide/',body,format='json').status_code,400)
