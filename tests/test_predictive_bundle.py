"""Integrity/safe provisioning checks; test bytes are not trained artifacts."""
import hashlib
from io import BytesIO
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import urllib.request
from backend.predictive_ai.provision_bundle import FILES,provision,download_bundle,HTTPSRedirect,RETAINED_ARCHIVE


class BundleTests(unittest.TestCase):
    def archive(self,root,omit=None,unsafe=False):
        path=root/'bundle.tar.gz'
        with tarfile.open(path,'w:gz') as tar:
            for name in FILES:
                if name==omit:continue
                info=tarfile.TarInfo(name);info.size=4;tar.addfile(info,BytesIO(b'test'))
            if unsafe:
                info=tarfile.TarInfo('../outside');info.size=4;tar.addfile(info,BytesIO(b'evil'))
        return path,hashlib.sha256(path.read_bytes()).hexdigest()

    def test_verified_contents_and_no_overwrite(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);archive,digest=self.archive(root);out=root/'release'
            provision(archive,digest,out)
            for name in FILES:self.assertEqual((out/name).read_bytes(),b'test')
            with self.assertRaisesRegex(ValueError,'empty'):
                provision(archive,digest,out)
            self.assertEqual((out/FILES[0]).read_bytes(),b'test')

    def test_invalid_digest_and_missing_files(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);archive,digest=self.archive(root,omit=FILES[0]);out=root/'release'
            with self.assertRaisesRegex(ValueError,'checksum'):
                provision(archive,'0'*64,out)
            with self.assertRaisesRegex(ValueError,'missing'):
                provision(archive,digest,out)
            self.assertFalse(out.exists())

    def test_path_traversal_rejected(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);archive,digest=self.archive(root,unsafe=True)
            with self.assertRaisesRegex(ValueError,'unsafe'):
                provision(archive,digest,root/'release')
            self.assertFalse((root/'outside').exists())

    def test_authenticated_download_verifies_and_retains_exact_archive(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);archive,digest=self.archive(root);out=root/'release'
            with patch('backend.predictive_ai.provision_bundle.urllib.request.build_opener') as opener:
                opener.return_value.open.return_value=BytesIO(archive.read_bytes())
                download_bundle('https://artifacts.example.test/private/',digest,out,token='test-token',retain_archive=True)
                request=opener.return_value.open.call_args.args[0]
                self.assertEqual(request.get_header('Authorization'),'Bearer test-token')
            self.assertEqual((out/RETAINED_ARCHIVE).read_bytes(),archive.read_bytes())

    def test_authenticated_redirect_cannot_forward_token_to_other_origin(self):
        handler=HTTPSRedirect()
        request=urllib.request.Request('https://one.example.test/bundle',headers={'Authorization':'Bearer test-token'})
        with self.assertRaisesRegex(ValueError,'same origin'):
            handler.redirect_request(request,None,302,'redirect',{},'https://two.example.test/bundle')
        with self.assertRaisesRegex(ValueError,'HTTPS'):
            handler.redirect_request(request,None,302,'redirect',{},'http://one.example.test/bundle')

    def test_invalid_download_never_publishes_partial_runtime(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            with patch('backend.predictive_ai.provision_bundle.urllib.request.build_opener') as opener:
                opener.return_value.open.return_value=BytesIO(b'corrupted')
                with self.assertRaisesRegex(ValueError,'checksum'):
                    download_bundle('https://artifacts.example.test/private/','0'*64,root/'release',retain_archive=True)
            self.assertFalse((root/'release').exists())
