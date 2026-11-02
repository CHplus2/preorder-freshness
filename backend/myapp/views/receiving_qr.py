"""Owner-selected QR crop, encoded losslessly. No bank request or QR generation."""
from hashlib import sha256
from io import BytesIO
import warnings
from PIL import Image,ImageOps,UnidentifiedImageError
from rest_framework import serializers
from rest_framework.decorators import api_view,permission_classes,parser_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from ..models import MenuPhoto
from ..services.auth_limits import limit


class CropInput(serializers.Serializer):
    x=serializers.IntegerField(min_value=0)
    y=serializers.IntegerField(min_value=0)
    size=serializers.IntegerField(min_value=128,max_value=2000)


def cropped_qr(upload,crop):
    if not upload or upload.size>4*1024*1024:
        raise serializers.ValidationError('Choose a JPG, PNG or WebP QR image up to 4 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            raw=upload.read(4*1024*1024+1)
            if len(raw)>4*1024*1024:raise ValueError()
            with Image.open(BytesIO(raw)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or getattr(source,'n_frames',1)!=1 or source.width*source.height>20_000_000:
                    raise ValueError()
                source.load()
                photo=ImageOps.exif_transpose(source).convert('RGBA')
            x,y,size=crop['x'],crop['y'],crop['size']
            if x+size>photo.width or y+size>photo.height:raise ValueError()
            # Exact source pixels: no resizing, sharpening, smoothing or regenerated QR.
            selected=photo.crop((x,y,x+size,y+size))
            output=BytesIO();selected.save(output,'WEBP',lossless=True,exact=True,method=4)
            if output.tell()>1024*1024:raise ValueError()
            return output.getvalue(),size
    except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise serializers.ValidationError('The QR crop could not be saved. Use a still image and keep the square inside it, between 128 and 2,000 pixels.')


@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser])
def upload_receiving_qr(request):
    limit(request,'receiving-qr',str(request.user.pk),maximum=15)
    form=CropInput(data=request.data);form.is_valid(raise_exception=True)
    content,size=cropped_qr(request.FILES.get('image'),form.validated_data)
    digest=sha256(content).hexdigest()
    MenuPhoto.objects.get_or_create(digest=digest,defaults=dict(content=content,width=size,height=size))
    return Response(dict(image_url=f'/api/menu-photos/{digest}/',width=size,height=size),status=201)
