"""Read-only plan for recasting explicitly fictional order history. Never writes."""
import argparse
from decimal import Decimal
import json
import os
from pathlib import Path

from import_dapur_kita import ImportErrorDetail, SOURCE, StaffAPI, index_names, require, rows, validate_source

MAPPING = SOURCE.parent / 'DAPUR-KITA-DEMO-ORDER-MAPPING.json'


def plan_history(api, source, mapping):
    validate_source(source)
    menus = index_names(source['menus'], 'target menu')
    translations = {old.casefold(): new.casefold() for old, new in mapping['products'].items()}
    require(len(translations) == len(mapping['products']), 'Duplicate mapping names.')
    require(all(name in menus for name in translations.values()), 'Mapping refers to a missing target menu.')
    plans = []
    for order in rows(api, 'admin/orders/'):
        lines = []
        unmapped = []
        for item in order['items']:
            key = item['product_name'].casefold()
            target = menus.get(translations.get(key, key))
            if target is None:
                unmapped.append(item['product_name'])
                continue
            price = Decimal(target['price'])
            lines.append({'item_id': item['id'], 'old_name': item['product_name'], 'new_name': target['name'],
                'quantity': item['quantity'], 'old_unit_price': item['unit_price'],
                'new_unit_price': str(price), 'new_subtotal': str(price * item['quantity'])})
        subtotal = sum((Decimal(line['new_subtotal']) for line in lines), Decimal('0'))
        discount, shipping = (Decimal(order[field]) for field in ['discount_amount', 'shipping_fee'])
        new_total = None if unmapped else subtotal - discount
        payments = api.request('GET', f'admin/orders/{order["id"]}/payments/')
        issues = []
        if unmapped:
            issues.append('Explicit mapping required for: ' + ', '.join(unmapped))
        if new_total is not None and new_total < 0:
            issues.append('Original fixed discount exceeds replacement subtotal.')
        if payments['events']:
            issues.append('Reconcile fictional payment events with the replacement total.')
        if order.get('payment_method') == 'wallet':
            issues.append('Reconcile demo-wallet debits/refunds and balances; no external money transfer.')
        if order.get('inventory_deducted'):
            issues.append('Inspect fictional ingredient consumption and inventory logs before replacement; do not fabricate new stock evidence.')
        plans.append({'order_id': order['id'], 'keep_created_at': order['created_at'],
            'keep_delivery_at': order.get('delivery_at'), 'lines': lines,
            'old_total_amount': order['total_amount'], 'keep_discount_amount': str(discount),
            'keep_shipping_fee': str(shipping), 'new_total_amount': None if new_total is None else str(new_total),
            'new_payment_amount': None if new_total is None else str(new_total + shipping),
            'reconciliation_required': issues})
    return {'synthetic_demo_history': True, 'writes_performed': 0, 'order_count': len(plans),
        'item_count': sum(len(order['lines']) for order in plans), 'orders': plans,
        'limitation': 'This only plans changes. Existing staff APIs do not support rewriting order items, accepted recipes or payment ledgers. A tested database migration is required; this plan does not modify forecasts.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='https://preorder-freshness.vercel.app')
    parser.add_argument('--mapping', type=Path, default=MAPPING)
    parser.add_argument('--output', type=Path, required=True, help='Local private report outside Git; contains no customer/address fields.')
    args = parser.parse_args()
    try:
        username, password = (os.getenv(name) for name in ['DJANGO_STAFF_USERNAME', 'DJANGO_STAFF_PASSWORD'])
        require(username and password, 'Set Django staff credentials securely in environment settings.')
        api = StaffAPI(args.url, username, password)
        result = plan_history(api, json.loads(SOURCE.read_text()), json.loads(args.mapping.read_text()))
        with args.output.open('x', encoding='utf-8') as handle:
            os.chmod(args.output, 0o600)
            json.dump(result, handle, indent=2)
            handle.write('\n')
        print(f'Read-only plan: {result["order_count"]} orders, {result["item_count"]} mapped items. Saved to {args.output}. No writes performed.')
        return 0
    except (ImportErrorDetail, KeyError, ValueError, TypeError, OSError) as exc:
        print(f'Planning stopped: {exc}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
