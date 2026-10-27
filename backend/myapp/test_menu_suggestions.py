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

    def test_food_budget_is_for_requested_quantity_not_unit_price(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        expensive=self.menus[0];expensive.price='35.00';expensive.save()
        Product.objects.exclude(pk=expensive.pk).update(price='33.33')
        with patch('myapp.views.discovery.slots',return_value=[{'delivery_at':str(date)+'T15:00:00+08:00'}]):
            result=self.client.post('/api/menu/guide/',{'date':str(date),'portions':3,'budget':'100.00'},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(len(result.data['results']),3)
        self.assertNotIn(expensive.pk,[row['id'] for row in result.data['results']])
        self.assertTrue(all(row['food_total']=='99.99' for row in result.data['results']))

    def test_above_budget_is_explicit_and_exact_budget_is_within(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        Product.objects.all().update(price='33.33')
        expensive=self.menus[-1];expensive.price='35.00';expensive.save()
        payload={'date':str(date),'portions':3,'budget':'99.99'}
        with patch('myapp.views.discovery.slots',return_value=[{'delivery_at':str(date)+'T15:00:00+08:00'}]):
            within=self.client.post('/api/menu/guide/',payload,format='json')
            above=self.client.post('/api/menu/guide/',dict(payload,budget_mode='above'),format='json')
        self.assertEqual(within.status_code,200,within.data)
        self.assertTrue(all(row['budget_relation']=='within' and row['budget_difference']=='0.00' for row in within.data['results']))
        self.assertEqual([row['id'] for row in above.data['results']],[expensive.pk])
        row=above.data['results'][0]
        self.assertEqual(row['food_total'],'105.00');self.assertEqual(row['budget_relation'],'above');self.assertEqual(row['budget_difference'],'5.01')
        self.assertNotIn('Within your',str(row['reasons']))
        self.assertEqual(above.data['budget']['mode'],'above')
        context=RecommendationSession.objects.get(pk=above.data['session']).context
        self.assertEqual(context['budget_mode'],'above');self.assertEqual(context['version'],'date-guide-v2')

    def test_both_budget_ranges_include_each_when_feasible_without_exceeding_three(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        Product.objects.all().update(price='30.00')
        expensive=self.menus[-1];expensive.price='35.00';expensive.save()
        with patch('myapp.views.discovery.slots',return_value=[{'delivery_at':str(date)+'T15:00:00+08:00'}]):
            result=self.client.post('/api/menu/guide/',{'date':str(date),'portions':3,'budget':'100','budget_mode':'all'},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(len(result.data['results']),3)
        self.assertEqual({row['budget_relation'] for row in result.data['results']},{'within','above'})
        self.assertIn(expensive.pk,[row['id'] for row in result.data['results']])
        self.assertEqual(RecommendationSession.objects.get(pk=result.data['session']).products,[row['id'] for row in result.data['results']])

    def test_above_or_both_require_budget_and_both_scan_is_bounded(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        for mode in ('above','all','invalid'):
            result=self.client.post('/api/menu/guide/',{'date':str(date),'budget_mode':mode},format='json')
            self.assertEqual(result.status_code,400,result.data)
        first=self.menus[0]
        for index in range(32):
            menu=Product.objects.create(name=f'Extra meal {index}',price=10,category=self.category)
            ProductIngredient.objects.create(product=menu,raw_material=first.ingredients.first().raw_material,quantity_required=10)
        available=[{'delivery_at':str(date)+'T15:00:00+08:00'}]
        with patch('myapp.views.discovery.slots',return_value=available) as scanned:
            result=self.client.post('/api/menu/guide/',{'date':str(date),'portions':3,'budget':'100','budget_mode':'all'},format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(scanned.call_count,3)  # No opposite price range exists in the bounded candidate set.
        self.assertEqual(len(result.data['results']),3)
        self.menus[0].price='35.00';self.menus[0].save()
        with patch('myapp.views.discovery.slots',side_effect=lambda items,*args: [] if items[0].product.pk==self.menus[0].pk else available) as scanned:
            result=self.client.post('/api/menu/guide/',{'date':str(date),'portions':3,'budget':'100','budget_mode':'all'},format='json')
        self.assertEqual(scanned.call_count,30)  # An opposite-range menu exists but has no feasible times.
        self.assertEqual(len(result.data['results']),3)

    def test_above_budget_never_invents_capacity_or_changes_instant_menu_discovery(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        with patch('myapp.views.discovery.slots',return_value=[]):
            result=self.client.post('/api/menu/guide/',{'date':str(date),'portions':3,'budget':'1','budget_mode':'above'},format='json')
        self.assertEqual(result.data['results'],[])
        self.assertEqual(result.data['empty_reason'],'no_kitchen_times')
        instant=self.client.post('/api/menu/suggestions/',{},format='json')
        self.assertTrue(instant.data['results']);self.assertNotIn('budget',instant.data)

    def test_above_search_uses_the_full_price_partition_before_selecting_top_three(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        expensive=self.menus[-1];expensive.price='35.00';expensive.save()
        for menu in self.menus[:3]:self.sale(self.buyer,menu,quantity=10)
        self.client.force_authenticate(self.buyer)
        instant=self.client.post('/api/menu/suggestions/',{},format='json').data
        self.assertNotIn(expensive.pk,[row['id'] for row in instant['results']])
        payload={'date':str(date),'portions':3,'budget':'100.00'}
        with patch('myapp.views.discovery.slots',return_value=[{'delivery_at':str(date)+'T15:00:00+08:00'}]):
            within=self.client.post('/api/menu/guide/',payload,format='json').data
            above=self.client.post('/api/menu/guide/',dict(payload,budget_mode='above'),format='json').data
        self.assertNotIn(expensive.pk,[row['id'] for row in within['results']])
        self.assertEqual([row['id'] for row in above['results']],[expensive.pk])
        self.assertEqual(above['results'][0]['food_total'],'105.00')
        self.assertEqual(within['budget_catalogue'],above['budget_catalogue'])
        self.assertEqual(above['budget_catalogue'],dict(scope='date_category_recipes_before_capacity',quantity=3,
            menu_count=5,within_count=4,above_count=1,minimum_food_total='30.00',maximum_food_total='105.00'))

    def test_empty_above_budget_explains_when_all_menu_totals_are_under_threshold(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        with patch('myapp.views.discovery.slots') as available:
            result=self.client.post('/api/menu/guide/',dict(date=str(date),portions=3,budget='100',budget_mode='above'),format='json')
        self.assertEqual(result.status_code,200,result.data);self.assertEqual(result.data['results'],[])
        summary=result.data['budget_catalogue'];self.assertEqual(summary['menu_count'],5)
        self.assertEqual((summary['within_count'],summary['above_count']),(5,0))
        self.assertEqual(summary['maximum_food_total'],'42.00');available.assert_not_called()

    def test_price_summary_respects_date_category_recipe_and_active_status_before_capacity(self):
        from unittest.mock import patch
        date=timezone.localdate()+timedelta(days=3)
        self.menus[0].selling_status='paused';self.menus[0].save()
        self.menus[1].ingredients.all().delete()
        self.menus[2].delivery_weekdays=[(date.weekday()+1)%7];self.menus[2].save()
        self.menus[3].category=Category.objects.create(name='Other');self.menus[3].save()
        with patch('myapp.views.discovery.slots',return_value=[]):
            result=self.client.post('/api/menu/guide/',dict(date=str(date),portions=3,budget='100',category=self.category.pk),format='json')
        self.assertEqual(result.status_code,200,result.data);self.assertEqual(result.data['empty_reason'],'no_kitchen_times')
        self.assertEqual(result.data['budget_catalogue']['menu_count'],1)
        self.assertEqual(result.data['budget_catalogue']['minimum_food_total'],'42.00')
        no_budget=self.client.post('/api/menu/guide/',dict(date=str(date),portions=3),format='json')
        self.assertIsNone(no_budget.data['budget_catalogue'])
