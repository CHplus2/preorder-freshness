"""Explicit, repeatable fictional stock setup; never executed by deployment."""
import hashlib
import json
import os
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from myapp.models import InventoryItem, InventoryLog, Order, Product, ProductIngredient, RawMaterial, Storefront
from myapp.services.kitchen_decisions import decision_support
from myapp.services.local_planning import local_plan
from .prepare_freshcast_demo import ROOT, reviewed_snapshot

PREFIX = 'DEMO-FC-INV-'


def encode(value):
    return json.dumps(value, default=str, sort_keys=True)


def projection():
    support = decision_support(local_plan(horizon_days=7))
    return {
        'forecast_status': support['forecast_status'],
        'menus_with_forecast': sum(m['forecast_portions'] is not None for m in support['menus']),
        'menus_without_history': [m['product_name'] for m in support['menus'] if m['forecast_portions'] is None],
        'menu_forecasts': [{'menu': m['product_name'], 'method': m['method'],
                           'forecast_portions': m['forecast_portions'], 'confidence': m['confidence']}
                          for m in support['menus']],
        'ingredient_projections': [{'ingredient': r['ingredient_name'], 'unit': r['unit'],
            'forecast_requirement': r['forecast_requirement'], 'projected_unused_at_expiry': r['forecast_expiring_unused'],
            'potential_waste_cost_myr': r['forecast_waste_cost_myr'], 'signal': r['signal']}
            for r in support['ingredient_risks']],
    }


class Command(BaseCommand):
    help = 'Preview or explicitly add labeled fictional recipe-based stock, preserving all existing lots and sales.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--backup')
        parser.add_argument('--actor-id', type=int)

    def handle(self, *args, **options):
        if options['apply'] and not all(options[k] for k in ('confirm_fictional', 'expected_fingerprint', 'backup', 'actor_id')):
            raise CommandError('Apply requires --confirm-fictional, --expected-fingerprint, --backup and --actor-id.')
        with transaction.atomic():
            if options['apply']:
                if not Storefront.objects.select_for_update().filter(pk=1).first():
                    raise CommandError('Existing storefront settings are required. Check the intended database/schema.')
                list(Order.objects.select_for_update().order_by('pk'))
                list(Product.objects.select_for_update().order_by('pk'))
                list(RawMaterial.objects.select_for_update().order_by('pk'))
                list(InventoryItem.objects.select_for_update().order_by('pk'))
            today = timezone.localdate()
            database, _ = reviewed_snapshot()
            recipes = list(ProductIngredient.objects.filter(product__selling_status='active')
                           .select_related('raw_material', 'product').order_by('pk'))
            stock = list(InventoryItem.objects.order_by('pk').values())
            context = {'as_of': today, 'database': database, 'stock': stock,
                       'materials': list(RawMaterial.objects.order_by('pk').values()),
                       'recipes': [{'id': r.pk, 'product_id': r.product_id, 'material_id': r.raw_material_id,
                                    'quantity_required': r.quantity_required} for r in recipes],
                       'active_product_ids': list(Product.objects.filter(selling_status='active').order_by('pk').values_list('pk', flat=True))}
            proposals, skipped, per_portion, materials = [], [], {}, {}
            guide = json.loads((ROOT/'docs/DAPUR-KITA-STARTER-DATA.json').read_text())
            storage = {r['raw_material']: r['storage_type'] for r in guide['inventory_templates']}
            for recipe in recipes:
                material = recipe.raw_material
                if material.unit not in {'g', 'kg', 'ml', 'l', 'unit'} or recipe.quantity_required <= 0:
                    skipped.append({'menu': recipe.product.name, 'ingredient': material.name, 'reason': 'invalid_recipe_quantity_or_unit'})
                    continue
                materials[material.pk] = material
                per_portion[material.pk] = max(per_portion.get(material.pk, Decimal(0)), recipe.quantity_required)
            missing_recipes = set(context['active_product_ids']) - {r.product_id for r in recipes}
            for product_id in sorted(missing_recipes):
                skipped.append({'product_id': product_id, 'reason': 'active_menu_has_no_recipe'})
            for material_id, portion in sorted(per_portion.items()):
                material = materials[material_id]
                for kind, multiplier, days in [('NEAR', 10, 2), ('RESERVE', 20, 14)]:
                    code = f'{PREFIX}{material_id}-{kind}'
                    existing = [row for row in stock if row['batch_code'] == code]
                    if existing:
                        if len(existing) != 1 or existing[0]['raw_material_id'] != material_id:
                            raise CommandError('A demo batch code is duplicated or assigned to another material; review existing stock.')
                        skipped.append({'batch_id': existing[0]['id'], 'batch_code': code,
                                        'reason': 'existing_demo_batch_preserved_even_if_consumed_or_expired'})
                        continue
                    quantity = (portion*multiplier).quantize(Decimal('.001'))
                    if quantity <= 0 or quantity > Decimal('999999999.999'):
                        raise CommandError('Recipe-derived demo quantity exceeds inventory field limits.')
                    proposals.append({'raw_material_id': material_id, 'ingredient': material.name, 'unit': material.unit,
                        'quantity': quantity, 'batch_code': code, 'received_date': today,
                        'expiry_date': today+timedelta(days=days), 'shelf_life_days': days,
                        'storage_type': storage.get(material.name, 'ambient'),
                        'unit_cost': material.estimated_unit_cost})
            fingerprint = hashlib.sha256(encode({'context': context, 'proposals': proposals}).encode()).hexdigest()
            report = {'mode': 'preview', 'fingerprint': fingerprint, 'as_of': today,
                'active_menus': len(context['active_product_ids']), 'recipe_materials': len(materials),
                'proposed_batches': proposals, 'skipped': skipped, 'before': projection(),
                'assumptions': [
                    'All added stock is fictional. No real receiving, supplier payment or customer sale is recorded.',
                    'Per ingredient, quantities equal its largest active-recipe per-portion use times 10 (near expiry) or 20 (reserve); not model-predicted purchases.',
                    'Expiry offsets of 2 and 14 days and guide-based storage categories (ambient for unmatched materials) are illustrative inputs, not verified shelf-life or storage guidance.',
                    'Unit costs copy existing raw-material estimates; missing costs remain unknown. No profit or actual savings is established.',
                    'Existing stock is additive and never overwritten, topped up, unquarantined or redated. Repeat runs preserve consumed/expired demo batches.',
                    'Stock does not create sales history. Menus lacking eligible paid delivered history remain unavailable; limited-history projections remain review signals.',
                    'These database rows affect normal menu availability, FEFO and shopping. Use only the owner-confirmed fictional demonstration database.']}
            if options['apply']:
                if fingerprint != options['expected_fingerprint']:
                    raise CommandError('Data or date changed since preview; review a fresh fingerprint.')
                actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
                if not actor:
                    raise CommandError('Choose an existing staff actor ID.')
                backup = Path(options['backup']).resolve()
                if backup.is_relative_to(ROOT):
                    raise CommandError('Keep the private backup outside the repository.')
                run_id = str(uuid4())
                try:
                    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, 'w') as file:
                        file.write(encode(dict(context, maintenance_id=run_id, staff_actor_id=actor.pk,
                                               proposed_batches=proposals)))
                except OSError:
                    raise CommandError('Cannot create a new private backup. Choose an existing directory and unused filename.') from None
                created = []
                for row in proposals:
                    fields = {k: v for k, v in row.items() if k not in {'ingredient', 'unit'}}
                    item = InventoryItem.objects.create(**fields, supplier='FICTIONAL FreshCast inventory scenario',
                        source_type='other', label_date_type='not_recorded', expiry_basis='storage',
                        storage_location='FICTIONAL DEMO stock - storage unverified', handling_history='not_recorded',
                        handling_note='FICTIONAL scenario. No receipt, storage history or food safety is verified.',
                        guidance_note='FICTIONAL quantities, storage and expiry dates for workflow demonstration only.')
                    InventoryLog.objects.create(inventory_item=item, change=item.quantity, admin=actor,
                        reason='FICTIONAL demo stock seed - no real goods received', reference=f'FreshCast demo inventory {run_id}')
                    created.append(item.pk)
                report.update(mode='applied', maintenance_id=run_id, created_batch_ids=created, after=projection())
            self.stdout.write(encode(report))
