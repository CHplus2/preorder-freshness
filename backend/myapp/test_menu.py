from django.test import TestCase
from rest_framework.test import APIClient
from .models import Product, Category

class MenuPaginationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = Category.objects.create(name='Meals')
        for n in range(26):
            Product.objects.create(name=f'Meal {n:02}', price='10.00', category=cls.category)
        Product.objects.create(name='Unique cake', price='20.00')

    def test_pages_are_bounded_stable_and_complete(self):
        client = APIClient()
        first = client.get('/api/menu/').json()
        second = client.get('/api/menu/?page=2').json()
        third = client.get('/api/menu/?page=3').json()
        self.assertEqual(first['count'], 27)
        self.assertEqual([len(p['results']) for p in [first, second, third]], [12, 12, 3])
        self.assertEqual(len({p['id'] for page in [first,second,third] for p in page['results']}),27)
        self.assertIsNone(third['next'])
        self.assertNotIn('preparation_tasks', first['results'][0])

    def test_filters_apply_before_pagination(self):
        client = APIClient()
        result = client.get('/api/menu/', {'search':'Meal 00','category':self.category.pk}).json()
        self.assertEqual(result['count'], 1)
        self.assertEqual(result['results'][0]['name'], 'Meal 00')
        self.assertEqual(client.get('/api/menu/', {'search':'cake','category':self.category.pk}).json()['count'],0)

    def test_invalid_page_and_category(self):
        client=APIClient()
        self.assertEqual(client.get('/api/menu/?page=999').status_code,404)
        self.assertEqual(client.get('/api/menu/?category=nope').status_code,400)
