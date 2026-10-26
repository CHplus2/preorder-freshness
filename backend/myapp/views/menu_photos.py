"""Owner uploads decoded and re-encoded photos; no remote URL is fetched."""
from hashlib import sha256
from io import BytesIO
import re
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from django.http import HttpResponse, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.response import Response
from ..models import MenuPhoto
from ..services.auth_limits import limit


def sanitized_photo(upload):
    if not upload or upload.size > 4*1024*1024:
        raise serializers.ValidationError('Choose a JPEG, PNG or WebP image up to 4 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            raw = upload.read(4*1024*1024+1)
            if len(raw) > 4*1024*1024:
                raise ValueError()
            with Image.open(BytesIO(raw)) as source:
                if source.format not in {'JPEG', 'PNG', 'WEBP'} or getattr(source, 'n_frames', 1) != 1:
                    raise ValueError()
                if min(source.size) < 16 or max(source.size) > 12000 or source.width*source.height > 20000000:
                    raise ValueError()
                source.load()
                photo = ImageOps.exif_transpose(source).convert('RGBA' if 'A' in source.getbands() else 'RGB')
            photo.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            for quality in (85, 70, 55):
                output = BytesIO()
                photo.save(output, 'WEBP', quality=quality, method=4)
                if output.tell() <= 512*1024:
                    return output.getvalue(), photo.width, photo.height
            raise ValueError()
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise serializers.ValidationError('Use a still JPEG, PNG or WebP photo between 16 pixels and 20 megapixels. This image could not be safely processed.')


@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser])
def upload_menu_photo(request):
    limit(request, 'menu-photo', str(request.user.pk), maximum=30)
    content, width, height = sanitized_photo(request.FILES.get('image'))
    digest = sha256(content).hexdigest()
    MenuPhoto.objects.get_or_create(digest=digest, defaults=dict(content=content, width=width, height=height))
    return Response(dict(image_url=f'/api/menu-photos/{digest}/',
                         width=width, height=height), status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def menu_photo(request, digest):
    if not re.fullmatch('[0-9a-f]{64}', digest):
        return Response(status=404)
    tag = '"'+digest+'"'
    rows = MenuPhoto.objects.only('digest') if request.headers.get('If-None-Match') == tag else MenuPhoto.objects.all()
    photo = get_object_or_404(rows, digest=digest)
    response = HttpResponseNotModified() if request.headers.get('If-None-Match') == tag else HttpResponse(bytes(photo.content), content_type='image/webp')
    response['ETag'] = tag
    response['Cache-Control'] = 'public, max-age=31536000, immutable'
    response['X-Content-Type-Options'] = 'nosniff'
    response['Content-Security-Policy'] = "default-src 'none'"
    return response
