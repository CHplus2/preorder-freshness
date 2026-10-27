"""Small, private history of bearer-authenticated HTTP worker executions.

The existing authentication-event store holds only purpose-prefixed run markers
and bounded aggregate counts. No bearer, recipient, order ID or mail content is
stored. This observes executions, including manual calls; it cannot establish
that an external automatic schedule is enabled or that email reached an inbox.
"""
import logging
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ..models import AuthAttempt

PREFIX = 'reminder-worker:v1:'
START = PREFIX+'start'
logger = logging.getLogger(__name__)


def begin():
    try:
        with transaction.atomic():
            AuthAttempt.objects.filter(key__startswith=PREFIX, created_at__lt=timezone.now()-timedelta(hours=24)).delete()
            return AuthAttempt.objects.create(key=START).pk
    except Exception:
        logger.warning('Reminder worker activity could not be recorded.')
        return None


def finish(run_id, *, result=None, outcome=None):
    if run_id is None:
        return
    try:
        if outcome not in ('not_configured', 'worker_error'):
            if (not isinstance(result, dict) or any(type(result.get(k)) is not int or not 0 <= result[k] <= 3 for k in ('sent','failed'))
                    or result['sent']+result['failed'] > 3):
                raise ValueError('Unrecognised worker counts')
            suffix = f"counts:{result['sent']}:{result['failed']}"
        else:
            suffix = outcome
        with transaction.atomic():
            AuthAttempt.objects.create(key=f'{PREFIX}finish:{run_id}:{suffix}')
    except Exception:
        # Monitoring failure must not turn an accepted SMTP send into a failed
        # HTTP request or expose a backend exception/connection credential.
        logger.warning('Reminder worker completion could not be recorded.')


def history(now=None):
    now = now or timezone.now()
    starts = AuthAttempt.objects.filter(key=START, created_at__gte=now-timedelta(hours=24), created_at__lte=now)
    total = starts.count()
    runs = list(starts.order_by('-created_at','-pk').values('pk','created_at')[:10])
    finished = {}
    if runs:
        query = Q()
        for run in runs:
            query |= Q(key__startswith=f"{PREFIX}finish:{run['pk']}:")
        # At most one finish is written per HTTP run. A bounded read also keeps
        # malformed/manual records from expanding a status response.
        for record in AuthAttempt.objects.filter(query).order_by('-pk').values('key','created_at')[:30]:
            parts = record['key'][len(PREFIX):].split(':')
            try:
                run_id = int(parts[1])
                if run_id in finished:
                    continue
                if len(parts)==5 and parts[2]=='counts':
                    sent, failed = int(parts[3]), int(parts[4])
                    if not 0 <= sent <= 3 or not 0 <= failed <= 3 or sent+failed > 3:
                        continue
                    finished[run_id] = dict(completed_at=record['created_at'], outcome='send_failed' if failed else 'completed', sent=sent, failed=failed)
                elif len(parts)==3 and parts[2] in ('not_configured','worker_error'):
                    finished[run_id] = dict(completed_at=record['created_at'], outcome=parts[2], sent=None, failed=None)
            except (IndexError, TypeError, ValueError):
                continue
    rows = []
    for run in runs:
        data = dict(started_at=run['created_at'], completed_at=None,
            outcome='incomplete' if now-run['created_at'] > timedelta(minutes=2) else 'running', sent=None, failed=None)
        result = finished.get(run['pk'])
        if result and result['completed_at'] >= run['created_at']:
            data.update(result)
        rows.append(data)
    return dict(generated_at=now, retention_hours=24, recent_threshold_minutes=15,
        authenticated_runs_24h=total, recent_runs=rows)
