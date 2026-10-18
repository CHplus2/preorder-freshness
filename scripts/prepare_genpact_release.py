"""Prepare the exact original Genpact archive for GitHub; never train or read a DB."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.predictive_ai.provision_bundle import (ORIGINAL_DEMO_SHA256,
    RETAINED_ARCHIVE, FILES, provision, download_bundle)

SOURCE='https://preorder-freshness-model-bundle.vercel.app/api/internal/freshcast-bundle/'


def prepare(output, archive=None):
    output=Path(output)
    if output.exists():
        raise ValueError('Choose a new release directory; existing backups are preserved.')
    with tempfile.TemporaryDirectory() as tmp:
        staged=Path(tmp)/'verified'
        if archive:
            provision(archive,ORIGINAL_DEMO_SHA256,staged,retain_archive=True)
        else:
            token=os.environ.get('FRESHCAST_BUNDLE_TOKEN','')
            if not token:
                raise ValueError('Configure the GitHub Actions secret FRESHCAST_BUNDLE_TOKEN or supply the existing original archive. Nothing was backed up.')
            download_bundle(SOURCE,ORIGINAL_DEMO_SHA256,staged,token=token,retain_archive=True)
        output.mkdir(parents=True)
        target=output/'freshcast-runtime-bundle.tar.gz'
        shutil.copyfile(staged/RETAINED_ARCHIVE,target)
        manifest={'backup_kind':'original-genpact-runtime','created_at':datetime.now(timezone.utc).isoformat(),
            'archive':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'contains':list(FILES),'retrained':False,'kitchen_records_included':False}
        (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        (output/'SHA256SUMS').write_text(ORIGINAL_DEMO_SHA256+'  '+target.name+'\n',encoding='utf-8')
        (output/'RESTORE.md').write_text((ROOT/'docs/github-backups.md').read_text(),encoding='utf-8')
    return manifest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--archive',type=Path)
    options=parser.parse_args()
    try:
        report=prepare(options.output,options.archive)
    except Exception:
        # Network exceptions may contain signed URLs; never print them or tokens.
        raise SystemExit('Original model backup unavailable or verification failed. Supply the original archive or configure FRESHCAST_BUNDLE_TOKEN securely. No model was retrained and no release should be published.') from None
    print(json.dumps(report))


if __name__=='__main__':main()
