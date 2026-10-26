"""Isolated settings imports; no database or email connections are made."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]


class NotificationOriginTests(unittest.TestCase):
    def origin(self,vercel='1',production='kitchen.example',explicit=None):
        env=os.environ.copy()
        env.update(PYTHON_DOTENV_DISABLED='1',DJANGO_SETTINGS_MODULE='config.settings',VERCEL=vercel,
                   VERCEL_PROJECT_PRODUCTION_URL=production,DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused',
                   DATABASE_SCHEMA='django_app',SECRET_KEY='isolated-origin-fixture-not-for-production',DEBUG='False',
                   HTTP_HOST='untrusted.example',HTTP_X_FORWARDED_HOST='untrusted.example')
        env.pop('PUBLIC_APP_URL',None)
        if explicit is not None:env['PUBLIC_APP_URL']=explicit
        code="import sys; sys.path.insert(0,'backend'); from myapp.services.recovery_email import reset_origin; print(reset_origin())"
        result=subprocess.run([sys.executable,'-c',code],cwd=ROOT,env=env,capture_output=True,text=True,timeout=20)
        self.assertEqual(result.returncode,0,result.stderr)
        return result.stdout.strip()

    def test_trusted_production_metadata_is_used_without_request_host(self):
        self.assertEqual(self.origin(),'https://kitchen.example')

    def test_explicit_origin_and_explicit_disable_are_preserved(self):
        self.assertEqual(self.origin(explicit='https://configured.example'),'https://configured.example')
        self.assertEqual(self.origin(explicit=''),'None')

    def test_local_missing_and_unsafe_metadata_do_not_produce_email_links(self):
        self.assertEqual(self.origin(vercel='0'),'None')
        for host in ['', 'user:pass@kitchen.example', 'kitchen.example/path', 'kitchen.example?x=y', 'kitchen.example#part']:
            self.assertEqual(self.origin(production=host),'None',host)
