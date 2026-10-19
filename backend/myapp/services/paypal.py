"""PayPal Sandbox Orders v2. Amounts and request IDs come from Django records.

Never accept an API host, amount, credentials or capture result from the browser.
"""
import base64
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
from django.conf import settings

API = 'https://api-m.sandbox.paypal.com'
CURRENCY = 'MYR'


def enabled():
    return bool(settings.PAYPAL_SANDBOX_ENABLED and settings.PAYPAL_SANDBOX_CLIENT_ID
                and settings.PAYPAL_SANDBOX_CLIENT_SECRET)


def provider_id(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9]{1,100}', value) is not None


class PayPalError(Exception):
    def __init__(self, message='PayPal Sandbox could not confirm the result. Check payment status before trying again.', code='provider_unavailable'):
        self.message, self.code = message, code
        super().__init__(message)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class SandboxClient:
    def __init__(self):
        if not enabled():
            raise PayPalError('PayPal Sandbox is not configured. No payment has been requested.', 'not_configured')
        self.opener = build_opener(NoRedirect())
        credential = base64.b64encode((settings.PAYPAL_SANDBOX_CLIENT_ID+':'+settings.PAYPAL_SANDBOX_CLIENT_SECRET).encode()).decode()
        data = self._request('/v1/oauth2/token', 'POST', urlencode({'grant_type':'client_credentials'}).encode(),
            {'Authorization':'Basic '+credential, 'Content-Type':'application/x-www-form-urlencoded'})
        token = data.get('access_token')
        if not isinstance(token, str) or not token:
            raise PayPalError()
        self.token = token

    def _request(self, path, method, body=None, headers=None):
        request = Request(API+path, data=body, method=method, headers={'Accept':'application/json', **(headers or {})})
        try:
            with self.opener.open(request, timeout=8) as response:
                raw = response.read(1_000_001)
                if len(raw)>1_000_000:
                    raise PayPalError()
                data = json.loads(raw)
                if not isinstance(data, dict):
                    raise PayPalError()
                return data
        except HTTPError as error:
            # Never return provider payloads (payer details) or auth headers.
            try:
                data = json.loads(error.read(64000))
                issues = {d.get('issue') for d in data.get('details', []) if isinstance(d, dict)}
            except (ValueError, TypeError, AttributeError):
                issues = set()
            if 'INSTRUMENT_DECLINED' in issues:
                raise PayPalError('PayPal declined the selected Sandbox funding source. Check payment status before choosing another funding source.', 'instrument_declined') from None
            if 'ORDER_NOT_APPROVED' in issues:
                raise PayPalError('Approve this payment in the PayPal window before completing it.', 'approval_required') from None
            raise PayPalError() from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise PayPalError() from None

    def request(self, path, method='GET', payload=None, request_id=None):
        headers = {'Authorization':'Bearer '+self.token, 'Content-Type':'application/json', 'Prefer':'return=representation'}
        if request_id:
            headers['PayPal-Request-Id'] = str(request_id)
        return self._request(path, method, json.dumps(payload).encode() if payload is not None else None, headers)

    def create(self, intent):
        return self.request('/v2/checkout/orders', 'POST', {
            'intent':'CAPTURE',
            'purchase_units':[{'reference_id':intent['request_id'], 'custom_id':intent['custom_id'],
                'description':'Dapur Kita preorder · Sandbox test',
                'amount':{'currency_code':CURRENCY, 'value':intent['amount']}}],
            'payment_source':{'paypal':{'experience_context':{'shipping_preference':'NO_SHIPPING', 'user_action':'PAY_NOW'}}},
        }, intent['request_id'])

    def get(self, order_id):
        if not provider_id(order_id):
            raise PayPalError(code='invalid_provider_order')
        return self.request('/v2/checkout/orders/'+order_id)

    def capture(self, order_id, request_id):
        if not provider_id(order_id):
            raise PayPalError(code='invalid_provider_order')
        return self.request('/v2/checkout/orders/'+order_id+'/capture', 'POST', {}, request_id)
