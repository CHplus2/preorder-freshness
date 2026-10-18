import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

ROUTE='/api/admin/predictive/model-backup/'


class StaffModelBackupTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('model-backup-owner',is_staff=True)
        self.customer=User.objects.create_user('model-backup-customer')
        self.client=APIClient()

    def test_anonymous_and_customer_cannot_download(self):
        self.assertEqual(self.client.get(ROUTE).status_code,403)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get(ROUTE).status_code,403)

    def test_staff_download_is_fixed_verified_and_read_only(self):
        self.client.force_authenticate(self.owner)
        with TemporaryDirectory() as directory:
            archive=Path(directory)/'runtime-bundle.tar.gz';content=b'test-only-original-archive'
            archive.write_bytes(content);stamp=archive.stat().st_mtime_ns
            checksum=hashlib.sha256(content).hexdigest()
            with override_settings(PREDICTIVE_ARTIFACT_DIR=directory,FRESHCAST_BUNDLE_SHA256=checksum):
                response=self.client.get(ROUTE,HTTP_ACCEPT='application/gzip, application/json')
                self.assertEqual(response.status_code,200)
                self.assertEqual(response['X-Checksum-SHA256'],checksum)
                self.assertIn('no-store',response['Cache-Control'])
                self.assertEqual(b''.join(response.streaming_content),content);response.close()
                self.assertEqual(archive.stat().st_mtime_ns,stamp)
                self.assertEqual(self.client.get(ROUTE+'?file=database').status_code,400)
                self.assertEqual(self.client.post(ROUTE).status_code,405)
                archive.write_bytes(b'corrupt')
                self.assertEqual(self.client.get(ROUTE).status_code,503)
                archive.unlink()
                response=self.client.get(ROUTE)
                self.assertEqual(response.status_code,503)
                self.assertNotIn(directory,response.content.decode())

    def test_staff_login_does_not_unlock_deployment_transfer_route(self):
        self.client.force_login(self.owner)
        with override_settings(FRESHCAST_BUNDLE_EXPORT_TOKEN='private-test-token-at-least-32-characters'):
            self.assertEqual(self.client.get('/api/internal/freshcast-bundle/').status_code,403)
