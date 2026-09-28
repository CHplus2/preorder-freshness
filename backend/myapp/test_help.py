import json
from unittest.mock import patch, MagicMock
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Product
from .services.kitchen_help import ai_topic


@override_settings(GROQ_API_KEY='')
class KitchenHelpTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def ask(self, **kwargs):
        return self.client.post('/api/help/', kwargs, format='json')

    def test_languages_and_no_key_fallback(self):
        self.assertFalse(self.client.get('/api/help/').json()['ai_available'])
        for lang, word in [('en', '90 days'), ('ms', '90 hari'), ('zh', '90天')]:
            response = self.ask(topic='preorder', language=lang)
            self.assertEqual(response.status_code, 200)
            self.assertIn(word, response.json()['answer'])
        response = self.ask(message='something unfamiliar', use_ai=True)
        self.assertEqual(response.json()['mode'], 'fallback')
        self.assertEqual(response.json()['href'], '/contact')

    def test_multilingual_detection(self):
        for message, topic in [('如何付款', 'payment'), ('ada alahan', 'allergy'), ('my order status', 'orders')]:
            self.assertEqual(self.ask(message=message).json()['topic'], topic)

    @patch('myapp.views.help.ai_topic')
    def test_external_ai_requires_consent_and_is_skipped_for_known_topics(self, provider):
        self.ask(message='unfamiliar request')
        self.ask(topic='payment', use_ai=True)
        provider.assert_not_called()
        provider.return_value = 'preorder'
        response = self.ask(message='unfamiliar request', use_ai=True)
        self.assertEqual(response.json()['mode'], 'ai')
        self.assertIn('90 days', response.json()['answer'])

    def test_budgets_are_calculated_from_database_not_model(self):
        Product.objects.create(name='Rice', price='10.00', daily_capacity=20)
        Product.objects.create(name='Cake', price='30.00', daily_capacity=20)
        Product.objects.create(name='Limited', price='5.00', daily_capacity=1)
        data = self.ask(topic='menu', budget='50.00', portions=5).json()
        self.assertEqual([p['name'] for p in data['menus']], ['Rice'])
        self.assertEqual(data['menus'][0]['food_total'], '50.00')
        self.assertIn('not confirmed availability', data['answer'])
        self.assertEqual(self.ask(topic='menu', search='missing').json()['menus'], [])

    def test_orders_return_navigation_not_private_data(self):
        response = self.ask(topic='orders', user_id=999, order_id=123)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['href'], '/orders')
        self.assertNotIn('order_id', response.json())

    def test_invalid_inputs(self):
        for data in [{}, {'topic':'delete_order'}, {'topic':'menu','portions':0},
                     {'topic':'menu','budget':'-1'}, {'topic':'menu','language':'xx'},
                     {'message':'a'*501}]:
            self.assertEqual(self.ask(**data).status_code, 400)

    def test_throttles_repeated_requests(self):
        for _ in range(20):
            self.assertEqual(self.ask(topic='contact').status_code, 200)
        self.assertEqual(self.ask(topic='contact').status_code, 429)

    @override_settings(GROQ_API_KEY='test-key', GROQ_CHAT_MODEL='test-model')
    @patch('myapp.services.kitchen_help.urlopen')
    def test_provider_timeout_and_untrusted_output_fall_back(self, provider):
        provider.side_effect = TimeoutError()
        self.assertIsNone(ai_topic('question'))
        provider.side_effect = None
        response = MagicMock()
        provider.return_value.__enter__.return_value = response
        response.read.return_value = json.dumps({'choices':[{'message':{'content':'Your payment is confirmed!'}}]}).encode()
        self.assertIsNone(ai_topic('question'))
        response.read.return_value = b'not json'
        self.assertIsNone(ai_topic('question'))

    @override_settings(GROQ_API_KEY='test-key', GROQ_CHAT_MODEL='test-model')
    @patch('myapp.services.kitchen_help.urlopen')
    def test_provider_only_receives_redacted_question_and_fixed_prompt(self, provider):
        response = MagicMock()
        provider.return_value.__enter__.return_value = response
        response.read.return_value = b'{"choices":[{"message":{"content":"contact"}}]}'
        self.assertEqual(ai_topic('Email test@example.com or +60123456789'), 'contact')
        payload = json.loads(provider.call_args.args[0].data)
        self.assertNotIn('test@example.com', str(payload))
        self.assertNotIn('60123456789', str(payload))
        self.assertEqual(len(payload['messages']), 2)
