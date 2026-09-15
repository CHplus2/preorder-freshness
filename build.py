"""Build static frontend assets. Database migrations are an explicit release step."""
from pathlib import Path
import shutil
import subprocess

def main():
    root = Path(__file__).resolve().parent
    npm = shutil.which('npm')
    if not npm:
        raise RuntimeError('Node.js/npm is required to build the frontend.')
    subprocess.run([npm, 'ci', '--prefix', str(root / 'frontend')], check=True)
    subprocess.run([npm, '--prefix', str(root / 'frontend'), 'run', 'build'], check=True)

if __name__ == '__main__':
    main()
