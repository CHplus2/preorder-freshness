"""Provision a verified existing runtime bundle. Never train or access a database."""
import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile
import urllib.request
from urllib.parse import urlsplit

FILES = tuple(['data/'+name for name in ('train.csv','meal_info.csv','fulfilment_center_info.csv',
    'recipes_demo.csv','inventory_batches_demo.csv','supplier_settings_demo.csv')]+[
    'artifacts/demand_model.cbm','artifacts/metrics.json'])
MAX_ARCHIVE=40*1024*1024
MAX_CONTENT=40*1024*1024
ORIGINAL_DEMO_SHA256 = '697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a'
RETAINED_ARCHIVE = 'artifacts/runtime-bundle.tar.gz'


class HTTPSRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        if not newurl.startswith('https://'):
            raise ValueError('Artifact redirects must retain HTTPS')
        if request.has_header('Authorization') and urlsplit(request.full_url).netloc != urlsplit(newurl).netloc:
            raise ValueError('Authenticated artifact redirects must remain on the same origin')
        return super().redirect_request(request,response,code,message,headers,newurl)


def provision(archive, digest, destination, *, retain_archive=False):
    if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest.lower()):
        raise ValueError('A SHA-256 digest is required')
    archive=Path(archive)
    if archive.stat().st_size>MAX_ARCHIVE:
        raise ValueError('Bundle exceeds archive size limit')
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=digest.lower():
        raise ValueError('Bundle checksum mismatch')
    destination=Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Bundle destination must be empty; provision a new version, do not overwrite active data')
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as tmp:
        stage=Path(tmp)/'bundle';stage.mkdir()
        with tarfile.open(archive,'r:gz') as tar:
            members=tar.getmembers()
            if len(members)>100 or sum(m.size for m in members)>MAX_CONTENT:
                raise ValueError('Bundle exceeds content limits')
            names=set()
            for member in members:
                path=PurePosixPath(member.name)
                if path.is_absolute() or '..' in path.parts or not member.isfile() or member.name in names:
                    raise ValueError('Bundle contains unsafe or duplicate members')
                names.add(member.name)
                if member.name in FILES:
                    if member.size<=0: raise ValueError('Required bundle file is empty')
                    target=stage/member.name;target.parent.mkdir(parents=True,exist_ok=True)
                    with tar.extractfile(member) as src,target.open('wb') as dst:shutil.copyfileobj(src,dst)
            if not set(FILES)<=names:raise ValueError('Bundle is missing required runtime files')
        if retain_archive:
            # Retain the exact verified bytes, never a differently compressed archive.
            target=stage/RETAINED_ARCHIVE
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(archive,target)
        if destination.exists():destination.rmdir()
        stage.rename(destination)
    return destination


def download_bundle(url, digest, destination, *, token='', retain_archive=False):
    parsed=urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('A server-side HTTPS bundle URL without embedded credentials is required')
    headers={'Accept':'application/gzip'}
    if token:
        headers['Authorization']='Bearer '+token
    request=urllib.request.Request(url,headers=headers)
    with tempfile.TemporaryDirectory() as tmp:
        path=Path(tmp)/'bundle.tar.gz'
        opener=urllib.request.build_opener(HTTPSRedirect())
        with opener.open(request,timeout=60) as response,path.open('wb') as dst:
            total=0
            while chunk:=response.read(1024*1024):
                total+=len(chunk)
                if total>MAX_ARCHIVE:raise ValueError('Bundle exceeds archive size limit')
                dst.write(chunk)
        return provision(path,digest,destination,retain_archive=retain_archive)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive')
    parser.add_argument('--destination',required=True)
    parser.add_argument('--retain-archive',action='store_true')
    args=parser.parse_args()
    digest=os.getenv('FRESHCAST_BUNDLE_SHA256','')
    if args.archive:
        provision(args.archive,digest,args.destination,retain_archive=args.retain_archive)
    else:
        url=os.getenv('FRESHCAST_BUNDLE_URL','')
        if not url.startswith('https://'):raise SystemExit('Set a server-side HTTPS FRESHCAST_BUNDLE_URL')
        try:
            download_bundle(url,digest,args.destination,token=os.getenv('FRESHCAST_BUNDLE_TOKEN',''),
                            retain_archive=args.retain_archive)
        except Exception:
            # Signed URLs, authorization headers and tokens never appear in logs.
            raise SystemExit('Bundle provisioning failed; verify secure URL access, checksum and archive contents.') from None
    print('Verified runtime bundle provisioned; no training or database changes.')


if __name__=='__main__':main()
