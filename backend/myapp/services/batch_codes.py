"""Readable stock references. The database PK and historical allocations stay fixed."""
import re
from rest_framework.exceptions import ValidationError
from ..models import InventoryItem


def standard_batch_code(batch, received_date=None):
    name = batch.raw_material.name.strip().upper()
    prefix = 'CHK' if name.startswith('CHICKEN') else 'RCE' if name=='RICE' else 'SLT' if name=='SALT' else re.sub('[^A-Z]', '', name)[:3].ljust(3,'X')
    day = received_date or batch.received_date
    code = f'{prefix}-{day:%Y%m%d}-{batch.pk:03d}'
    if InventoryItem.objects.exclude(pk=batch.pk).filter(batch_code__iexact=code).exists():
        raise ValidationError({'batch_code':'The standard code is already in use. Keep a distinct supplier reference or review the existing batch.'})
    return code
