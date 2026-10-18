"""Release preparation tests use fake bytes, never a trained model or live DB."""
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts.prepare_genpact_release import prepare
from backend.predictive_ai.provision_bundle import FILES


class OriginalReleaseTests(unittest.TestCase):
    def archive(self, root):
        path=root/'fixture.tar.gz'
        with tarfile.open(path,'w:gz') as tar:
            for name in FILES:
                info=tarfile.TarInfo(name);info.size=4
                tar.addfile(info,BytesIO(b'test'))
        return path,hashlib.sha256(path.read_bytes()).hexdigest()

    def test_exact_existing_bytes_are_retained_and_backup_scope_is_explicit(self):
        with TemporaryDirectory() as temporary:
            root=Path(temporary);archive,digest=self.archive(root);output=root/'release'
            with patch('scripts.prepare_genpact_release.ORIGINAL_DEMO_SHA256',digest):
                report=prepare(output,archive)
            self.assertFalse(report['retrained']);self.assertFalse(report['kitchen_records_included'])
            self.assertEqual((output/report['archive']).read_bytes(),archive.read_bytes())
            self.assertEqual(report['sha256'],digest)
            self.assertEqual(json.loads((output/'manifest.json').read_text())['contains'],list(FILES))
            with self.assertRaisesRegex(ValueError,'preserved'):
                prepare(output,archive)

    def test_wrong_archive_and_missing_download_credential_create_no_release(self):
        with TemporaryDirectory() as temporary:
            root=Path(temporary);archive,_=self.archive(root)
            with patch('scripts.prepare_genpact_release.ORIGINAL_DEMO_SHA256','0'*64):
                with self.assertRaisesRegex(ValueError,'checksum'):
                    prepare(root/'wrong',archive)
            self.assertFalse((root/'wrong').exists())
            with patch.dict(os.environ,{'FRESHCAST_BUNDLE_TOKEN':''}):
                with self.assertRaisesRegex(ValueError,'Nothing was backed up'):
                    prepare(root/'missing')
            self.assertFalse((root/'missing').exists())


if __name__=='__main__':unittest.main()
