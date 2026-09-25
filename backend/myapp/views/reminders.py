import secrets
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from ..services.reminders import email_ready, send_due_reminders

@api_view(['GET'])
@permission_classes([IsAdminUser])
def reminder_status(request):
    return Response({'email_configured': email_ready(),
                     'scheduler_secret_configured': len(settings.CRON_SECRET) >= 32})

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def run_reminders(request):
    secret = settings.CRON_SECRET
    if len(secret) < 32 or not secrets.compare_digest(
            request.headers.get('Authorization', ''), 'Bearer '+secret):
        return Response({'detail': 'Unauthorized.'}, status=401)
    if not email_ready():
        return Response({'detail': 'Configure owner email and SMTP before enabling reminders.'}, status=503)
    result = send_due_reminders()
    return Response(result, status=503 if result['failed'] else 200)
