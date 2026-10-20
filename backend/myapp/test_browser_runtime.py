"""Browser shell cache policy and malformed sign-in requests."""
from django.conf import settings
from django.http import HttpResponse
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from .middleware import BrowserResponseMiddleware


class BrowserRuntimeTests(SimpleTestCase):
    def test_html_revalidates_and_keeps_private_policies(self):
        for cache in (None, 'private, no-store'):
            response = HttpResponse('<!doctype html>', content_type='text/html')
            if cache:
                response['Cache-Control'] = cache
            returned = BrowserResponseMiddleware(lambda request: response)(None)
            self.assertEqual(returned['Cache-Control'], cache or 'no-cache')
            self.assertEqual(returned['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()')

    def test_only_content_hashed_js_and_css_are_immutable(self):
        for url in ('/static/assets/index-bBGA8HZP.js', '/static/assets/menu-Aa0_12-Z.css'):
            self.assertTrue(settings.WHITENOISE_IMMUTABLE_FILE_TEST('', url))
        for url in ('/static/index.html', '/static/menu-images/cookies.jpg',
                    '/static/assets/runtime.js', '/static/assets/index-abcdefgh.js.map',
                    '/other/assets/index-abcdefgh.js'):
            self.assertFalse(settings.WHITENOISE_IMMUTABLE_FILE_TEST('', url))

    def test_json_does_not_get_html_cache_policy(self):
        response = HttpResponse('{}', content_type='application/json')
        self.assertNotIn('Cache-Control', BrowserResponseMiddleware(lambda request: response)(None))


class LoginInputTests(TestCase):
    def test_non_object_json_is_rejected_before_password_authentication(self):
        client = APIClient()
        for body in ([], None, 'unexpected', [dict(username='owner', password='untrusted')]):
            with self.subTest(body=body):
                response = client.post('/api/login/', body, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn('no-store', response['Cache-Control'])
