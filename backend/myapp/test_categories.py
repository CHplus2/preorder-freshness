from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Category, Product


class CategoryManagementTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('category-owner', is_staff=True)
        self.buyer = User.objects.create_user('category-buyer')
        self.client = APIClient()
        self.category = Category.objects.create(name='Rice meals')
        self.url = f'/api/categories/{self.category.pk}/'

    def test_read_public_write_staff_only(self):
        for user in [None, self.buyer]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get('/api/categories/').status_code, 200)
            self.assertEqual(self.client.get(self.url).status_code, 200)
            self.assertEqual(self.client.post('/api/categories/', {'name': 'Bakes'}).status_code, 403)
            self.assertEqual(self.client.patch(self.url, {'name': 'Bakes'}).status_code, 403)
            self.assertEqual(self.client.delete(self.url).status_code, 403)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, 'Rice meals')

    def test_create_normalizes_spaces_and_lists_alphabetically(self):
        self.client.force_authenticate(self.owner)
        result = self.client.post('/api/categories/', {'name': '  Fresh   bakes  '}, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['name'], 'Fresh bakes')
        self.assertEqual([r['name'] for r in self.client.get('/api/categories/').data], ['Fresh bakes', 'Rice meals'])

    def test_blank_long_and_duplicate_names_are_field_errors(self):
        self.client.force_authenticate(self.owner)
        for name in ['', '  ', 'a' * 101, 'RICE MEALS', '  rice   meals  ']:
            result = self.client.post('/api/categories/', {'name': name}, format='json')
            self.assertEqual(result.status_code, 400, result.data)
            self.assertIn('name', result.data)
        other = Category.objects.create(name='Bakes')
        result = self.client.patch(f'/api/categories/{other.pk}/', {'name': 'Rice meals'}, format='json')
        self.assertEqual(result.status_code, 400)
        other.refresh_from_db()
        self.assertEqual(other.name, 'Bakes')

    def test_rename_preserves_menu_id_and_public_filter(self):
        menu = Product.objects.create(name='Rice', price=12, category=self.category)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(self.url, {'name': 'Home meals'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(self.url, {'name': 'HOME MEALS'}, format='json').status_code, 200)
        self.client.force_authenticate(None)
        result = self.client.get(f'/api/menu/?category={self.category.pk}')
        self.assertEqual(result.data['count'], 1)
        self.assertEqual(result.data['results'][0]['category_name'], 'HOME MEALS')
        menu.refresh_from_db()
        self.assertEqual(menu.category_id, self.category.pk)

    def test_menu_counts_staff_only_include_all_states(self):
        for state in ['active', 'paused', 'archived']:
            Product.objects.create(name=state, price=10, category=self.category, selling_status=state)
        self.assertNotIn('menu_count', self.client.get(self.url).data)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.url).data['menu_count'], 3)

    def test_delete_protects_even_paused_and_archived_menu_links(self):
        self.client.force_authenticate(self.owner)
        for state in ['active', 'paused', 'archived']:
            menu = Product.objects.create(name=state, price=10, category=self.category, selling_status=state)
            response = self.client.delete(self.url)
            self.assertEqual(response.status_code, 409, response.data)
            self.assertEqual(response.data['code'], 'category_in_use')
            menu.refresh_from_db()
            self.assertEqual(menu.category_id, self.category.pk)
            menu.delete()
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertEqual(self.client.delete(self.url).status_code, 404)

    def test_move_menus_before_deleting_category(self):
        menu = Product.objects.create(name='Rice', price=12, category=self.category)
        destination = Category.objects.create(name='Lunch')
        self.client.force_authenticate(self.owner)
        result = self.client.patch(f'/api/admin/products/{menu.pk}/', {'category': destination.pk}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        menu.refresh_from_db()
        self.assertEqual(menu.category_id, destination.pk)
