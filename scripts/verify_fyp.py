"""Repeatable local evidence; forces isolated DB/email and never loads backend/.env."""
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]

def main():
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output=ROOT/'docs'/'evidence'/stamp
    output.mkdir(parents=True)
    env=os.environ.copy()
    env.update(PYTHON_DOTENV_DISABLED='1',SECRET_KEY='isolated-fyp-verification-only',DATABASE_URL='sqlite:///:memory:',DATABASE_SCHEMA='public',EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',PUBLIC_APP_URL='http://127.0.0.1:8000',VERCEL='0',DEBUG='False',GOOGLE_API_KEY='',CRON_SECRET='',OWNER_NOTIFICATION_EMAIL='')
    npm=shutil.which('npm')
    if not npm:raise SystemExit('npm is required; no tests executed.')
    steps=[('backend',[sys.executable,'manage.py','test','myapp','--noinput','--verbosity','2'],ROOT/'backend'),('release',[sys.executable,'-m','unittest','discover','-s','tests','-v'],ROOT)]
    steps += [(name,[npm,'run',name],ROOT/'frontend') for name in ['test','test:ux','test:checkout','test:planner','lint','build']]
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    dirty=bool(subprocess.check_output(['git','status','--porcelain','--untracked-files=normal'],cwd=ROOT,text=True).strip())
    source_files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines()
    hashes={}
    for name in sorted(set(source_files)):
        file=ROOT/name
        if file.is_file() and not name.startswith('docs/evidence/') and file.suffix in {'.py','.js','.jsx','.css','.json','.toml'}:
            hashes[name]=hashlib.sha256(file.read_bytes()).hexdigest()
    (output/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n',encoding='utf-8')
    inventory=[]
    for file in sorted((ROOT/'backend'/'myapp').glob('test*.py')):
        tree=ast.parse(file.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name.startswith('test_'):
                inventory.append({'file':file.relative_to(ROOT).as_posix(),'test':node.name,'line':node.lineno})
    (output/'test-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n',encoding='utf-8')
    manifest={'started_utc':stamp,'base_commit':sha,'working_tree_dirty':dirty,'database':'isolated in-memory SQLite','email':'in-memory; no delivery','limitations':['PostgreSQL locking tests skip on SQLite','No real user study, external payments or email delivery tested','Lint failures remain failures, not overridden'],'steps':[]}
    for name,command,cwd in steps:
        print('Running '+name,flush=True)
        try:
            result=subprocess.run(command,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',timeout=300)
            code,text=result.returncode,result.stdout
        except subprocess.TimeoutExpired as exc:
            code=124;text=exc.stdout or ''
            if isinstance(text,bytes):text=text.decode('utf-8',errors='replace')
            text+='\nTIMEOUT: 300 seconds\n'
        logfile=output/(name.replace(':','-')+'.log')
        logfile.write_text(text,encoding='utf-8')
        manifest['steps'].append({'name':name,'command':command,'cwd':cwd.relative_to(ROOT).as_posix(),'exit_code':code,'status':'passed' if code==0 else 'failed','log':logfile.name,'sha256':hashlib.sha256(logfile.read_bytes()).hexdigest()})
        (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        print(name+': '+str(code),flush=True)
    print('Evidence: '+str(output),flush=True)
    return int(any(step['exit_code'] for step in manifest['steps']))

if __name__=='__main__':raise SystemExit(main())
