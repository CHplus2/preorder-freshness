import hashlib
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import tarfile
import unittest
from unittest.mock import patch

from scripts.backup_freshcast import model_backup, main
from backend.predictive_ai.provision_bundle import FILES


class BackupRunnerTests(unittest.TestCase):
    def archive(self, folder):
        path = folder/'original.tar.gz'
        with tarfile.open(path, 'w:gz') as tar:
            for name in FILES:
                entry = tarfile.TarInfo(name);entry.size = 4
                tar.addfile(entry, BytesIO(b'test'))
        return path, hashlib.sha256(path.read_bytes()).hexdigest()

    def test_model_backup_preserves_exact_verified_archive_without_retraining(self):
        with TemporaryDirectory() as folder:
            root = Path(folder);archive,digest = self.archive(root)
            output = root/'backup';output.mkdir()
            result = model_backup(output, archive, {'FRESHCAST_BUNDLE_SHA256':digest})
            self.assertEqual(result['status'], 'backed_up')
            self.assertEqual((output/'genpact-runtime.tar.gz').read_bytes(), archive.read_bytes())
            with self.assertRaisesRegex(ValueError, 'checksum'):
                model_backup(output, archive, {'FRESHCAST_BUNDLE_SHA256':'0'*64})

    def test_partial_backup_reports_missing_components_and_sanitizes_url_errors(self):
        import contextlib,io,json
        with TemporaryDirectory() as folder:
            output=Path(folder)/'partial';log=io.StringIO()
            with patch('scripts.backup_freshcast.source_backup',return_value={'status':'backed_up'}), \
                 patch('scripts.backup_freshcast.kitchen_backup',side_effect=ValueError('Database access missing.')), \
                 patch('scripts.backup_freshcast.model_backup',side_effect=RuntimeError('https://secret-token@example.test')), \
                 contextlib.redirect_stdout(log):
                status=main(['--output',str(output)])
            self.assertEqual(status,2)
            report=json.loads((output/'manifest.json').read_text())
            self.assertEqual(report['status'],'partial')
            self.assertEqual(report['components']['kitchen']['status'],'not_backed_up')
            self.assertNotIn('secret-token',log.getvalue()+json.dumps(report))
            self.assertTrue((output/'RESTORE.md').is_file())


if __name__ == '__main__':
    unittest.main()
