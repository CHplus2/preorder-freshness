"""QR upload preserves exact cropped pixels and never publishes the source card."""
from io import BytesIO
from PIL import Image,ImageDraw,PngImagePlugin
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient
from .models import MenuPhoto


class ReceivingQrTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('qr-owner',is_staff=True)
        self.buyer=User.objects.create_user('qr-buyer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.source=Image.new('RGB',(420,600),'white');draw=ImageDraw.Draw(self.source)
        draw.rectangle((0,0,419,90),fill='blue')
        for x in range(64,320,8):
            for y in range(128,384,8):
                if (x//8+y//8)%2:draw.rectangle((x,y,x+7,y+7),fill=(235,29,105))

    def image(self):
        data=BytesIO();metadata=PngImagePlugin.PngInfo();metadata.add_text('Owner','PRIVATE HEADING')
        self.source.save(data,'PNG',pnginfo=metadata)
        return SimpleUploadedFile('private-qr-card.png',data.getvalue(),content_type='image/png')

    def test_uploaded_crop_is_lossless_and_excludes_heading_and_metadata(self):
        response=self.client.post('/api/receiving-qr/',dict(image=self.image(),x=64,y=128,size=256),format='multipart')
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(MenuPhoto.objects.count(),1)
        row=MenuPhoto.objects.get();self.assertEqual(row.width,256)
        result=Image.open(BytesIO(bytes(row.content))).convert('RGB')
        self.assertEqual(result.tobytes(),self.source.crop((64,128,320,384)).tobytes())
        self.assertNotIn(b'PRIVATE HEADING',bytes(row.content))
        self.assertNotIn('exif',result.info)
        public=APIClient().get(response.data['image_url']);self.assertEqual(public.status_code,200)
        self.assertEqual(public.content,bytes(row.content))
        saved=self.client.patch('/api/storefront/',{'duitnow_qr_url':response.data['image_url'],'manual_payment_enabled':True},format='json')
        self.assertEqual(saved.status_code,200,saved.data)

    def test_only_staff_can_upload_receiving_codes(self):
        for user in (None,self.buyer):
            self.client.force_authenticate(user)
            self.assertIn(self.client.post('/api/receiving-qr/',dict(image=self.image(),x=64,y=128,size=256),format='multipart').status_code,(401,403))
        self.assertFalse(MenuPhoto.objects.exists())

    def test_bounds_and_actual_file_contents_are_validated(self):
        for crop in (dict(x=400,y=128,size=256),dict(x=-1,y=0,size=256),dict(x=0,y=0,size=0),dict(x=0,y=0,size=2001)):
            self.assertEqual(self.client.post('/api/receiving-qr/',dict(image=self.image(),**crop),format='multipart').status_code,400)
        bad=SimpleUploadedFile('fake.png',b'<svg onload="alert(1)"/>',content_type='image/png')
        self.assertEqual(self.client.post('/api/receiving-qr/',dict(image=bad,x=0,y=0,size=128),format='multipart').status_code,400)
        self.assertFalse(MenuPhoto.objects.exists())

    def test_unknown_uploaded_qr_reference_is_not_accepted(self):
        r=self.client.patch('/api/storefront/',{'duitnow_qr_url':'/api/menu-photos/'+'0'*64+'/'},format='json')
        self.assertEqual(r.status_code,400)
