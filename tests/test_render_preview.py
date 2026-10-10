"""Check Render isolation and HTTPS auth settings without connecting to production."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RenderPreviewTests(unittest.TestCase):
    def run_preview(self, code, **overrides):
        env = os.environ.copy()
        env.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='config.render_preview_settings',
                   VERCEL='0', SECRET_KEY='render-preview-test-only',
                   DATABASE_URL='sqlite:////var/data/freshcast-demo.sqlite3',
                   RENDER_EXTERNAL_HOSTNAME='isolated-preview.onrender.com')
        env.update(overrides)
        return subprocess.run([sys.executable, '-c', code], cwd=ROOT, env=env,
                              capture_output=True, text=True, timeout=120)

    def test_https_frontend_csrf_and_host_validation(self):
        result = self.run_preview("""
import app
from django.conf import settings
from django.test import Client
assert settings.SESSION_COOKIE_SECURE and settings.CSRF_COOKIE_SECURE
assert not settings.DEBUG
assert settings.DATABASES['default']['NAME'] == '/var/data/freshcast-demo.sqlite3'
client = Client(enforce_csrf_checks=True)
response = client.get('/admin/ai/decisions', secure=True, HTTP_HOST='isolated-preview.onrender.com')
assert response.status_code == 200 and b'id="root"' in response.content
response = client.get('/api/check-auth/', secure=True, HTTP_HOST='isolated-preview.onrender.com')
assert response.status_code == 200
assert response.cookies['csrftoken']['secure']
assert client.post('/api/admin/predictive/what-if/', data={}, secure=True,
                   HTTP_HOST='isolated-preview.onrender.com').status_code == 403
assert client.get('/', secure=True, HTTP_HOST='unexpected.example').status_code == 400
""")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_production_database_and_unknown_host_are_refused(self):
        for overrides, message in [
            ({'DATABASE_URL': 'postgresql://unused:unused@127.0.0.1:1/unused'}, 'isolated /var/data'),
            ({'RENDER_EXTERNAL_HOSTNAME': 'untrusted.example'}, 'RENDER_EXTERNAL_HOSTNAME'),
        ]:
            result = self.run_preview('import app', **overrides)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(message, result.stderr)
