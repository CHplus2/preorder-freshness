"""Deployment archive access is independent of customer/staff API sessions."""
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import SimpleTestCase, override_settings

ROUTE='/api/internal/freshcast-bundle/'
TOKEN='test-only-artifact-token-with-at-least-32-characters'


class BundleExportTests(SimpleTestCase):
    def test_disabled_missing_wrong_or_query_credentials_are_denied(self):
        for configured,headers,url in [('',{},ROUTE), (TOKEN,{},ROUTE),
                                      (TOKEN,{'HTTP_AUTHORIZATION':'Bearer wrong'},ROUTE),
                                      (TOKEN,{},ROUTE+'?token='+TOKEN)]:
            with self.subTest(configured=bool(configured),url=url), override_settings(FRESHCAST_BUNDLE_EXPORT_TOKEN=configured):
                response=self.client.get(url,**headers)
                self.assertEqual(response.status_code,403)
                self.assertEqual(response['Cache-Control'],'private, no-store')
                self.assertNotIn(TOKEN,response.content.decode())

    def test_only_verified_fixed_archive_is_served_without_database_access(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/'runtime-bundle.tar.gz'
            content=b'fixture-only-archive-bytes'
            path.write_bytes(content)
            stamp=path.stat().st_mtime_ns
            with override_settings(PREDICTIVE_ARTIFACT_DIR=tmp,FRESHCAST_BUNDLE_EXPORT_TOKEN=TOKEN,
                                   FRESHCAST_BUNDLE_SHA256=hashlib.sha256(content).hexdigest()):
                response=self.client.get(ROUTE,HTTP_AUTHORIZATION='Bearer '+TOKEN)
                self.assertEqual(response.status_code,200)
                self.assertEqual(b''.join(response.streaming_content),content)
                response.close()
                self.assertEqual(response['Content-Type'],'application/gzip')
                self.assertEqual(response['Cache-Control'],'private, no-store')
                self.assertEqual(path.stat().st_mtime_ns,stamp)
                path.write_bytes(b'corrupted')
                self.assertEqual(self.client.get(ROUTE,HTTP_AUTHORIZATION='Bearer '+TOKEN).status_code,503)
                path.unlink()
                response=self.client.get(ROUTE,HTTP_AUTHORIZATION='Bearer '+TOKEN)
                self.assertEqual(response.status_code,503)
                self.assertNotIn(tmp,response.content.decode())

    def test_post_and_staff_session_cannot_replace_bearer_authorization(self):
        with override_settings(FRESHCAST_BUNDLE_EXPORT_TOKEN=TOKEN):
            self.assertEqual(self.client.post(ROUTE,HTTP_AUTHORIZATION='Bearer '+TOKEN).status_code,405)
            # Ordinary API session cookies never authorize artifact transfer.
            self.client.cookies['sessionid']='fixture-staff-session'
            self.assertEqual(self.client.get(ROUTE).status_code,403)
