from decimal import Decimal
from django.conf import settings
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from ..models import Product, Storefront
from ..services.kitchen_help import TEXT, TOPICS, local_topic, ai_topic


class HelpThrottle(SimpleRateThrottle):
    rate = '20/min'

    def get_cache_key(self, request, view):
        ident = str(request.user.pk) if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': 'kitchen_help', 'ident': ident}


class HelpInput(serializers.Serializer):
    language = serializers.ChoiceField(choices=['en', 'ms', 'zh'], default='en')
    topic = serializers.ChoiceField(choices=TOPICS, required=False)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    use_ai = serializers.BooleanField(default=False)
    portions = serializers.IntegerField(min_value=1, max_value=1000, default=1)
    budget = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal("0.01"), required=False)
    search = serializers.CharField(max_length=80, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('message') and not attrs.get('topic'):
            raise serializers.ValidationError('Choose a topic or enter a question.')
        return attrs


class KitchenHelp(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [HelpThrottle]

    def get(self, request):
        return Response({'ai_available': bool(settings.GROQ_API_KEY), 'languages': ['en', 'ms', 'zh']})

    def post(self, request):
        data = HelpInput(data=request.data)
        data.is_valid(raise_exception=True)
        data = data.validated_data
        topic = data.get('topic') or local_topic(data.get('message', ''))
        mode = 'guided'
        if not topic and data['use_ai']:
            topic = ai_topic(data.get('message', ''))
            mode = 'ai' if topic else 'fallback'
        topic = topic or 'contact'
        store = Storefront.objects.filter(pk=1).first() or Storefront(pk=1)
        text = TEXT[data['language']]
        answer = text[topic].format(buffer=store.delivery_buffer_minutes)
        menus = []
        if topic == 'menu':
            rows = Product.objects.filter(selling_status='active', daily_capacity__gte=data['portions']).order_by('price', 'id')
            if data.get('search'):
                rows = rows.filter(name__icontains=data['search'])
            if data.get('budget'):
                rows = rows.filter(price__lte=data['budget'] / data['portions'])
            menus = [{'name': p.name, 'price': str(p.price),
                      'food_total': str(p.price * data['portions']),
                      'portions': data['portions'], 'href': '/products/' + str(p.pk)}
                     for p in rows[:3]]
            if not menus:
                answer += '\n\n' + text['none']
        return Response({'answer': answer, 'topic': topic, 'mode': mode, 'menus': menus,
                         'href': '/orders' if topic == 'orders' else '/menu' if topic in ['menu', 'preorder', 'freshness', 'review'] else '/contact'})
