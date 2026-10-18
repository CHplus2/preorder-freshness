"""Back up committed source, kitchen records and the existing Genpact archive.

Run with the project's Python interpreter and an existing database connection.
Each component reports success or failure; partial backups exit with code 2.
No restore, migration, training or production-data changes are performed.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.predictive_ai.provision_bundle import (ORIGINAL_DEMO_SHA256,
    RETAINED_ARCHIVE, provision, download_bundle)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def run(arguments, **kwargs):
    return subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', **kwargs)


def source_backup(output):
    destination = output/'source.bundle'
    if run(['git', 'bundle', 'create', str(destination), '--all']).returncode:
        raise ValueError('Git source backup failed; check that Git is installed and this is a committed checkout.')
    if run(['git', 'bundle', 'verify', str(destination)]).returncode:
        raise ValueError('Git bundle verification failed.')
    revision = run(['git', 'rev-parse', 'HEAD'])
    if revision.returncode:
        raise ValueError('Cannot identify the source revision.')
    return {'status': 'backed_up', 'file': destination.name, 'commit': revision.stdout.strip(),
            'scope': 'Committed local Git refs. Uncommitted and ignored files are not included.',
            'working_tree_clean': not bool(run(['git', 'status', '--porcelain']).stdout.strip())}


def kitchen_backup(output, environment):
    if not environment.get('DATABASE_URL', '').startswith(('postgres://', 'postgresql://', 'sqlite:')):
        raise ValueError('DATABASE_URL is missing or invalid. Use the terminal with your working database connection.')
    result = run([sys.executable, str(ROOT/'backend/manage.py'), 'backup_freshcast_kitchen',
                  '--output', str(output/'kitchen')], env=environment)
    if result.returncode:
        raise ValueError('Kitchen export failed. Check the database connection, django_app schema and project Python environment. No database changes were requested.')
    report = json.loads(result.stdout)
    if report.get('mode') != 'backed_up':
        raise ValueError('Kitchen export did not return a verified result.')
    return {'status': 'backed_up', 'directory': 'kitchen',
            'record_count': report['record_count'], 'scope': report['scope']}


def model_backup(output, archive, environment):
    candidates = [archive, environment.get('FRESHCAST_BUNDLE_ARCHIVE'),
        ROOT/'.freshcast-deploy/runtime-bundle.tar.gz',
        ROOT/'backend/predictive_ai/artifacts/runtime-bundle.tar.gz']
    path = next((Path(p).expanduser() for p in candidates if p and Path(p).expanduser().is_file()), None)
    if archive and (not Path(archive).expanduser().is_file()):
        raise ValueError('The supplied model archive does not exist.')
    expected = environment.get('FRESHCAST_BUNDLE_SHA256') or ORIGINAL_DEMO_SHA256
    with tempfile.TemporaryDirectory() as temporary:
        staged = Path(temporary)/'verified'
        if path:
            provision(path, expected, staged, retain_archive=True)
        elif environment.get('FRESHCAST_BUNDLE_URL') and environment.get('FRESHCAST_BUNDLE_TOKEN'):
            download_bundle(environment['FRESHCAST_BUNDLE_URL'], expected, staged,
                token=environment['FRESHCAST_BUNDLE_TOKEN'], retain_archive=True)
        else:
            raise ValueError('Model archive unavailable. Supply --model-archive or configure the protected bundle URL and token securely.')
        target = output/'genpact-runtime.tar.gz'
        shutil.copyfile(staged/RETAINED_ARCHIVE, target)
        os.chmod(target, 0o600)
    return {'status': 'backed_up', 'file': target.name, 'sha256': expected,
            'scope': 'Existing checksum-verified Genpact model, metrics and six runtime CSVs. No retraining.'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='New private directory outside the repository.')
    parser.add_argument('--model-archive', type=Path)
    options = parser.parse_args(argv)
    destination = (options.output or Path.home()/'FreshCast-backups'/
        ('freshcast-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))).expanduser().resolve()
    if destination.is_relative_to(ROOT) or destination.exists():
        parser.error('Choose a new directory outside the repository; existing backups are never overwritten.')
    os.umask(0o077)
    destination.mkdir(parents=True, mode=0o700)
    environment = dict(os.environ, PYTHON_DOTENV_DISABLED='1')
    environment.setdefault('DATABASE_SCHEMA', 'django_app')
    if not environment.get('SECRET_KEY'):
        import secrets
        environment['SECRET_KEY'] = secrets.token_urlsafe(48)
    components = {}
    jobs = [('source', lambda: source_backup(destination)),
            ('kitchen', lambda: kitchen_backup(destination, environment)),
            ('genpact', lambda: model_backup(destination, options.model_archive, environment))]
    for name, action in jobs:
        try:
            components[name] = action()
        except Exception as error:
            # Never emit URL-bearing exceptions, subprocess stderr or credentials.
            reason = str(error) if type(error) is ValueError and not name == 'genpact' else None
            if name == 'genpact':
                reason = 'Model backup unavailable or verification failed. Supply the original archive or securely configure bundle access; no model was retrained.'
            components[name] = {'status': 'not_backed_up', 'reason': reason or 'Backup failed; private error details were not printed.'}
        print(name+': '+components[name]['status'])
        if components[name].get('reason'):
            print('  '+components[name]['reason'])
    shutil.copyfile(ROOT/'docs/freshcast-backup-restore.md', destination/'RESTORE.md')
    files = {str(path.relative_to(destination)).replace(os.sep, '/'):
        {'sha256': sha256(path), 'bytes': path.stat().st_size}
        for path in sorted(destination.rglob('*')) if path.is_file()}
    complete = all(part['status'] == 'backed_up' for part in components.values())
    report = {'format': 'freshcast-backup-v1', 'created_at': datetime.now(timezone.utc).isoformat(),
        'status': 'complete' if complete else 'partial', 'components': components, 'files': files,
        'note': 'Application backup, not a full Supabase project backup. Environment secrets and external media are not included. Restore into an isolated database first.'}
    (destination/'manifest.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    (destination/'SHA256SUMS').write_text(''.join(row['sha256']+'  '+name+'\n' for name,row in files.items()), encoding='utf-8')
    print(('COMPLETE' if complete else 'PARTIAL')+' backup: '+str(destination))
    print('Keep a private copy outside this computer/cloud workspace. Kitchen exports include private user and business records.')
    return 0 if complete else 2


if __name__ == '__main__':
    raise SystemExit(main())
