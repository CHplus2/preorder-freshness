"""Use normal proxy/TLS handling; never redirect provider credentials."""
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, build_opener


class NoProviderRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise URLError('AI provider redirects are not followed.')


def open_provider(request, timeout=5):
    return build_opener(NoProviderRedirects()).open(request, timeout=timeout)
