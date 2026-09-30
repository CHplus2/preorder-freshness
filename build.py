"""Build static frontend assets. Database migrations are an explicit release step."""
from pathlib import Path
import shutil
import subprocess
import os
import sys

def main():
    root = Path(__file__).resolve().parent
    if os.getenv('VERCEL') == '1':
        # Read-only gate: do not release code against a schema it cannot use.
        result = subprocess.run([sys.executable, str(root / 'backend' / 'manage.py'),
                                 'migrate', '--check'], cwd=root)
        if result.returncode:
            raise RuntimeError('Database release check failed. Back up the target database, apply and verify pending migrations, then redeploy. This build does not apply migrations.')
    npm = shutil.which('npm')
    if not npm:
        raise RuntimeError('Node.js/npm is required to build the frontend.')
    subprocess.run([npm, 'ci', '--prefix', str(root / 'frontend')], check=True)
    subprocess.run([npm, '--prefix', str(root / 'frontend'), 'run', 'build'], check=True)

if __name__ == '__main__':
    main()
