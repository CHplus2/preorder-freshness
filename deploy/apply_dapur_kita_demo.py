"""Explicit one-off Vercel operator command; normal build.py stays read-only.

Select this build command only for the owner-authorized fictional data rewrite,
with a reviewed history fingerprint. No database URL or password is exported.
"""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    fingerprint = os.getenv('DAPUR_KITA_DEMO_FINGERPRINT', '')
    if os.getenv('DAPUR_KITA_CONFIRMED_FICTIONAL') != '1' or len(fingerprint) != 64 or any(c not in '0123456789abcdef' for c in fingerprint):
        raise RuntimeError('One-off demo rewrite requires explicit fictional-data confirmation and a reviewed fingerprint.')
    # Finish all release checks/model provisioning/frontend building before data edits.
    subprocess.run([sys.executable, str(ROOT / 'build.py')], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'backend/manage.py'), 'recast_dapur_kita_demo',
        '--apply', '--confirm-fictional', '--expected-fingerprint', fingerprint], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
