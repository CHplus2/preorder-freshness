"""Prevent private API responses being retained by browser/shared HTTP caches."""
from django.utils.cache import patch_cache_control, patch_vary_headers


class PrivateAPIResponseMiddleware:
    private_paths = (
        '/api/admin/', '/api/internal/', '/api/auth/', '/api/account/',
        '/api/orders/', '/api/cart/', '/api/wallet/', '/api/address/', '/api/addresses/',
        '/api/recommendation/', '/api/recommendation/events/',
        '/api/check-auth/', '/api/login/', '/api/logout/', '/api/signup/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/') and (
                request.path.startswith(self.private_paths)
                or request.user.is_authenticated
                or request.headers.get('Authorization')):
            directives = {part.strip().split('=', 1)[0].lower()
                          for part in response.get('Cache-Control', '').split(',')}
            # Existing no-store policies already prohibit retention. Preserve
            # their documented headers, while correcting any public directive.
            if 'no-store' not in directives or 'public' in directives:
                patch_cache_control(response, private=True, no_store=True)
            patch_vary_headers(response, ['Cookie'])
        return response


class BrowserResponseMiddleware:
    """Revalidate the SPA shell while letting content-hashed assets stay cached."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        if response.get('Content-Type', '').split(';', 1)[0] == 'text/html':
            response.setdefault('Cache-Control', 'no-cache')
        return response
