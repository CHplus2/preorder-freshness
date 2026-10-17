"""Run the reviewed date batch from an owner's connected terminal, with backup."""
import json
import os
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core import serializers, signing
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from myapp.models import Order, OrderAmendment, OrderItem, Product, Storefront
from myapp.views.delivery_date_batch import SALT, context, missing_delivery_dates
from .prepare_freshcast_demo import ROOT


class Command(BaseCommand):
    help = 'Preview/apply future fictional request dates using the owner API logic, with a private backup before changes.'

    def add_arguments(self, parser):
        parser.add_argument('--actor-id', type=int, required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--confirm', help='Signed confirm token from the reviewed preview.')
        parser.add_argument('--backup', help='New private JSON backup path outside the checkout.')

    def handle(self, *args, **options):
        actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
        if not actor:
            raise CommandError('Choose an existing staff actor ID.')
        if options['apply'] and not all(options[key] for key in ('confirm_fictional', 'confirm', 'backup')):
            raise CommandError('Apply requires --confirm-fictional, --confirm from the reviewed preview, and --backup.')
        if options['confirm'] and not options['apply']:
            raise CommandError('Use --apply to save a reviewed preview, or omit --confirm to create a new preview.')

        def request(payload):
            incoming = APIRequestFactory().post('/api/admin/orders/missing-delivery-dates/', payload, format='json')
            force_authenticate(incoming, user=actor)
            response = missing_delivery_dates(incoming)
            if response.status_code != 200:
                raise CommandError(json.dumps(response.data, default=str))
            return response.data

        if not options['apply']:
            self.stdout.write(json.dumps(request({}), default=str))
            return
        try:
            preview = signing.loads(options['confirm'], salt=SALT, max_age=600)
        except signing.BadSignature:
            raise CommandError('Preview expired or is invalid. Run a new preview in this same terminal session.') from None
        if preview['actor'] != actor.pk:
            raise CommandError('This preview belongs to another staff actor.')
        payload = {'confirm': options['confirm'], 'confirm_fictional': True}
        with transaction.atomic():
            store = Storefront.objects.select_for_update().filter(pk=1).first()
            if not store:
                raise CommandError('Existing kitchen settings are required.')
            list(Order.objects.select_for_update().order_by('pk'))
            list(Product.objects.select_for_update().order_by('pk'))
            # Confirmed retries need no new backup and must not restore subsequently changed dates.
            if OrderAmendment.objects.filter(actor=actor, after__batch_request_id=preview['request_id']).exists():
                result = request(payload)
                self.stdout.write(json.dumps(result, default=str))
                return
            _, fingerprint, _ = context(store, timezone.now())
            if fingerprint != preview['fingerprint']:
                raise CommandError('Orders, menus or capacity changed. Run and review a new preview.')
            ids = [row['order_id'] for row in preview['dates']]
            if not ids:
                raise CommandError('The preview has no eligible date changes. Review its skipped reasons.')
            path = Path(options['backup']).resolve()
            if path.is_relative_to(ROOT):
                raise CommandError('Keep the private backup outside the repository.')
            snapshot = {'purpose': 'PRIVATE before-backup: fictional future delivery request dates only',
                        'maintenance_id': str(uuid4()), 'actor_id': actor.pk, 'order_ids': ids,
                        'records': json.loads(serializers.serialize('json', [
                            *Order.objects.filter(pk__in=ids).order_by('pk'),
                            *OrderItem.objects.filter(order_id__in=ids).order_by('pk')]))}
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, 'w') as file:
                    json.dump(snapshot, file, indent=2)
            except OSError:
                raise CommandError('Could not create a new private backup. Choose a writable folder and unused filename.') from None
            result = request(payload)
            result['backup'] = str(path)
        self.stdout.write(json.dumps(result, default=str))
