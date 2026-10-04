"""Create a temporary loopback-only PostgreSQL cluster for concurrency verification."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--pg-bin',default=r'C:\Program Files\PostgreSQL\17\bin')
    args=parser.parse_args()
    binaries=Path(args.pg_bin)
    suffix='.exe' if os.name=='nt' else ''
    def binary(name):
        file=binaries/(name+suffix)
        if not file.is_file():raise SystemExit('Missing PostgreSQL executable: '+str(file))
        return str(file)
    initdb,pg_ctl=binary('initdb'),binary('pg_ctl')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    evidence=ROOT/'docs'/'evidence'/('postgres-'+stamp)
    evidence.mkdir(parents=True)
    temporary=Path(tempfile.mkdtemp(prefix='dapur-postgres-verification-'))
    cluster=temporary/'cluster'
    password=secrets.token_urlsafe(32)
    password_file=temporary/'password.txt'
    password_file.write_text(password,encoding='utf-8')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env=os.environ.copy()
    env.update(PYTHON_DOTENV_DISABLED='1',SECRET_KEY='isolated-postgres-verification',DATABASE_URL='sqlite:///:memory:',EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',VERCEL='0',DEBUG='False',PGPASSWORD=password,FYP_TEST_PORT=str(port),DJANGO_SETTINGS_MODULE='config.settings')
    started=False
    result_code=1
    try:
        result=subprocess.run([initdb,'-D',str(cluster),'-U','fyp_test','--pwfile='+str(password_file),'--auth=scram-sha-256','--encoding=UTF8','--locale=C'],env=env,capture_output=True,text=True,timeout=60)
        password_file.unlink(missing_ok=True)
        (evidence/'initdb.log').write_text(result.stdout+result.stderr,encoding='utf-8')
        if result.returncode:raise RuntimeError('Isolated cluster initialisation failed; see initdb.log')
        # Real files prevent a Windows server child retaining a captured pipe.
        with (evidence/'start.log').open('w',encoding='utf-8') as log:
            result=subprocess.run([pg_ctl,'-D',str(cluster),'-l',str(temporary/'server.log'),'-o',f'-h 127.0.0.1 -p {port} -c ssl=off','-w','start'],env=env,stdout=log,stderr=subprocess.STDOUT,timeout=60)
        if result.returncode:raise RuntimeError('Isolated cluster start failed; see start.log')
        started=True
        code="""
import os
from django.conf import settings
settings.DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':'postgres','USER':'fyp_test','PASSWORD':os.environ['PGPASSWORD'],'HOST':'127.0.0.1','PORT':os.environ['FYP_TEST_PORT'],'OPTIONS':{'sslmode':'disable','connect_timeout':10},'TEST':{'NAME':'test_fyp_concurrency'}}}
import django
django.setup()
from django.core.management import call_command
call_command('test','myapp.test_postgres_commitments',interactive=False,verbosity=2)
"""
        result=subprocess.run([sys.executable,'-c',code],cwd=ROOT/'backend',env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=180)
        (evidence/'concurrency.log').write_text(result.stdout+result.stderr,encoding='utf-8')
        result_code=result.returncode
        print(result.stdout+result.stderr,flush=True)
    finally:
        password_file.unlink(missing_ok=True)
        if started or (cluster/'postmaster.pid').exists():
            started=True
            stop=subprocess.run([pg_ctl,'-D',str(cluster),'-m','fast','-w','stop'],env=env,capture_output=True,text=True,timeout=60)
            (evidence/'stop.log').write_text(stop.stdout+stop.stderr,encoding='utf-8')
            if stop.returncode:result_code=1
        manifest={'started_utc':stamp,'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'working_tree_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),'database':'new temporary PostgreSQL cluster; loopback only; synthetic data','exit_code':result_code,'status':'passed' if result_code==0 else 'failed','cluster_stopped':started and stop.returncode==0,'cluster_directory':str(cluster),'limits':'Tests checkout races only; no real payment, SMTP or production data used.'}
        (evidence/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        print('Evidence: '+str(evidence),flush=True)
    return result_code
if __name__=='__main__':raise SystemExit(main())
