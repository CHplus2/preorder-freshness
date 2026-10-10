"""Build packaging preserves existing inputs and places files outside public assets."""
from pathlib import Path
import os
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from backend.predictive_ai.provision_bundle import FILES
from deploy.provision_vercel import publish_verified_bundle
from deploy.provision_vercel import EXPECTED_DEMO_SHA256, ROOT


class VercelBundleTests(unittest.TestCase):
    def staged(self, root):
        staged = root / 'verified'
        for name in FILES:
            path = staged / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'archive-verified-test-content')
        return staged

    def test_repeatable_packaging_and_preservation(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            staged = self.staged(root)
            destination = root / 'backend' / 'predictive_ai'
            publish_verified_bundle(staged, destination)
            stamps = {name: (destination / name).stat().st_mtime_ns for name in FILES}
            publish_verified_bundle(staged, destination)
            self.assertEqual(stamps, {name: (destination / name).stat().st_mtime_ns for name in FILES})
            (destination / FILES[-1]).write_bytes(b'existing-local-metrics')
            with self.assertRaisesRegex(ValueError, 'refusing to overwrite'):
                publish_verified_bundle(staged, destination)
            self.assertEqual((destination / FILES[-1]).read_bytes(), b'existing-local-metrics')

    def test_collision_preflight_does_not_partially_publish(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            staged = self.staged(root)
            destination = root / 'backend' / 'predictive_ai'
            existing = destination / FILES[-1]
            existing.parent.mkdir(parents=True)
            existing.write_bytes(b'existing-local-metrics')
            with self.assertRaises(ValueError):
                publish_verified_bundle(staged, destination)
            self.assertFalse((destination / FILES[0]).exists())

    def test_direct_archive_corruption_is_refused_without_publishing(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'corrupt.tar.gz'
            archive.write_bytes(b'corrupted-archive')
            environment = os.environ.copy()
            environment['FRESHCAST_BUNDLE_SHA256'] = EXPECTED_DEMO_SHA256
            destination = root / 'runtime'
            result = subprocess.run([sys.executable, str(ROOT / 'deploy' / 'provision_vercel.py'),
                                     '--archive', str(archive), '--destination', str(destination)],
                                    env=environment, capture_output=True, text=True, timeout=30)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('checksum mismatch', result.stderr)
            self.assertFalse(destination.exists())
