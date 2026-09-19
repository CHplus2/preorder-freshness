"""Public API errors never expose database or Python exception details."""
import logging
import uuid
from django.db import IntegrityError, OperationalError
from django.db.models.deletion import ProtectedError
from rest_framework.views import exception_handler, set_rollback
from rest_framework.response import Response

logger = logging.getLogger(__name__)

def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response
    set_rollback()
    if isinstance(exc, ProtectedError):
        return Response({'detail': 'This record is used by another record. Update its references before deleting it.'}, status=409)
    if isinstance(exc, IntegrityError):
        return Response({'detail': 'This change conflicts with an existing record. Refresh the data and check for duplicates.'}, status=409)
    reference = uuid.uuid4().hex[:12]
    logger.error('API failure reference=%s view=%s', reference, type(context.get('view')).__name__, exc_info=True)
    status = 503 if isinstance(exc, OperationalError) else 500
    return Response({'detail': 'The service could not complete this request. If you submitted an order, check My orders before trying again.', 'reference': reference}, status=status)
