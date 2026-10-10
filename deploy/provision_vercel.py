"""Put a checksum-verified existing bundle in the private Python function tree."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.predictive_ai.provision_bundle import FILES, ORIGINAL_DEMO_SHA256, RETAINED_ARCHIVE

EXPECTED_DEMO_SHA256 = ORIGINAL_DEMO_SHA256
LOCAL_ARCHIVE = ROOT / '.freshcast-deploy' / 'runtime-bundle.tar.gz'


def publish_verified_bundle(staged, destination):
    staged, destination = Path(staged), Path(destination)
    names=FILES+((RETAINED_ARCHIVE,) if (staged/RETAINED_ARCHIVE).is_file() else ())
    # Preflight all collisions before copying: preserve any existing local inputs.
    for name in names:
        source, target = staged / name, destination / name
        if not source.is_file() or not source.stat().st_size:
            raise ValueError('Verified bundle is missing a required runtime file')
        if target.exists() and (not target.is_file() or
                hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest()):
            raise ValueError('Existing runtime input differs; refusing to overwrite it')
    for name in names:
        source, target = staged / name, destination / name
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', default=os.getenv('FRESHCAST_BUNDLE_ARCHIVE') or
                        (str(LOCAL_ARCHIVE) if LOCAL_ARCHIVE.is_file() else None),
                        help='Local verified archive; direct uploads auto-detect .freshcast-deploy/runtime-bundle.tar.gz')
    parser.add_argument('--destination', default=str(ROOT / 'backend' / 'predictive_ai'))
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / 'bundle'
        command = [sys.executable, str(ROOT / 'backend' / 'predictive_ai' / 'provision_bundle.py'),
                   '--destination', str(staged), '--retain-archive']
        if args.archive:
            command += ['--archive', args.archive]
        environment = os.environ.copy()
        if args.archive:
            # The directly uploaded existing archive is pinned even without remote URL settings.
            environment.setdefault('FRESHCAST_BUNDLE_SHA256', EXPECTED_DEMO_SHA256)
        subprocess.run(command, check=True, env=environment)
        publish_verified_bundle(staged, args.destination)
    print('Eight verified FreshCast inputs ready for private Python function packaging.')


if __name__ == '__main__':
    main()
