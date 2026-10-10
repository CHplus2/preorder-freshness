"""Put a checksum-verified existing bundle in the private Python function tree."""
import argparse
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.predictive_ai.provision_bundle import FILES


def publish_verified_bundle(staged, destination):
    staged, destination = Path(staged), Path(destination)
    # Preflight all collisions before copying: preserve any existing local inputs.
    for name in FILES:
        source, target = staged / name, destination / name
        if not source.is_file() or not source.stat().st_size:
            raise ValueError('Verified bundle is missing a required runtime file')
        if target.exists() and (not target.is_file() or
                hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest()):
            raise ValueError('Existing runtime input differs; refusing to overwrite it')
    for name in FILES:
        source, target = staged / name, destination / name
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', help='Local verified archive for an offline build rehearsal')
    parser.add_argument('--destination', default=str(ROOT / 'backend' / 'predictive_ai'))
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / 'bundle'
        command = [sys.executable, str(ROOT / 'backend' / 'predictive_ai' / 'provision_bundle.py'),
                   '--destination', str(staged)]
        if args.archive:
            command += ['--archive', args.archive]
        subprocess.run(command, check=True)
        publish_verified_bundle(staged, args.destination)
    print('Eight verified FreshCast inputs ready for private Python function packaging.')


if __name__ == '__main__':
    main()
