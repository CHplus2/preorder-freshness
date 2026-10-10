"""Narrow machine-to-machine transfer of the verified demo archive only.

This view cannot read the database or choose a filename. Staff authentication
for the five predictive APIs remains unchanged; this is a deployment transfer.
"""
import hashlib
import hmac
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.views.decorators.http import require_GET

from .provision_bundle import ORIGINAL_DEMO_SHA256, RETAINED_ARCHIVE, MAX_ARCHIVE


@require_GET
def bundle_export(request):
    token=getattr(settings,'FRESHCAST_BUNDLE_EXPORT_TOKEN','')
    provided=request.headers.get('Authorization','')
    if len(token)<32 or not hmac.compare_digest(provided.encode(),('Bearer '+token).encode()):
        response=JsonResponse({'detail':'Artifact access denied.'},status=403)
    else:
        root=Path(getattr(settings,'PREDICTIVE_ARTIFACT_DIR',Path(__file__).parent/'artifacts'))
        archive=root/Path(RETAINED_ARCHIVE).name
        expected=getattr(settings,'FRESHCAST_BUNDLE_SHA256',ORIGINAL_DEMO_SHA256)
        try:
            handle=archive.open('rb')
        except OSError:
            response=JsonResponse({'detail':'Verified deployment archive unavailable.'},status=503)
        else:
            digest=hashlib.sha256()
            size=0
            while chunk:=handle.read(1024*1024):
                size+=len(chunk)
                if size>MAX_ARCHIVE:break
                digest.update(chunk)
            if size>MAX_ARCHIVE or not hmac.compare_digest(digest.hexdigest(),expected):
                handle.close()
                response=JsonResponse({'detail':'Verified deployment archive unavailable.'},status=503)
            else:
                handle.seek(0)
                response=FileResponse(handle,content_type='application/gzip',as_attachment=True,
                                      filename='freshcast-runtime-bundle.tar.gz')
    response['Cache-Control']='private, no-store'
    response['X-Content-Type-Options']='nosniff'
    return response
