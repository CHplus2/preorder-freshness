"""Check the root-relative file that Vercel's Django detector selects."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]

class EntrypointTests(unittest.TestCase):
    def test_vercel_file_import_and_frontend_routes(self):
        env = os.environ.copy()
        env.update(PYTHON_DOTENV_DISABLED='1', DJANGO_SETTINGS_MODULE='config.settings',
                   VERCEL='1', VERCEL_URL='entrypoint-check.vercel.app',
                   DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused',
                   DATABASE_SCHEMA='django_app', DEBUG='False',
                   SECRET_KEY='isolated-entrypoint-test-only-not-for-production')
        code = r"""
from pathlib import Path
import sys, importlib.util, tomllib
root = Path.cwd()
sys.path.insert(0, str(root / 'backend'))
from django.conf import settings
module, name = settings.WSGI_APPLICATION.rsplit('.', 1)
path = root / (module.replace('.', '/') + '.py')
assert path.is_file(), f'Vercel cannot load root-relative {path}'
declared = tomllib.loads((root / 'pyproject.toml').read_text())['tool']['vercel']['entrypoint']
assert declared == f'{module}:{name}', 'Django and Vercel entrypoints disagree'
sys.path.remove(str(root / 'backend'))
spec = importlib.util.spec_from_file_location('_vercel_check', path)
loaded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loaded)
assert callable(getattr(loaded, name))
from django.test import Client
client = Client()
for route in ['/', '/checkout', '/escrow-demo']:
    response = client.get(route, HTTP_HOST='entrypoint-check.vercel.app', secure=True)
    assert response.status_code == 200, (route, response.status_code)
    assert b'id="root"' in response.content
"""
        result = subprocess.run([sys.executable, '-c', code], cwd=ROOT, env=env,
                                capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
