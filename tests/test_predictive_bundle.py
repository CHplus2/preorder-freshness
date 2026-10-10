"""Integrity/safe provisioning checks; test bytes are not trained artifacts."""
import hashlib
from io import BytesIO
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest
from backend.predictive_ai.provision_bundle import FILES,provision


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
