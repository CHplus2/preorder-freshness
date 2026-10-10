"""Prepare one explicitly fictional upcoming order and labelled stock via staff APIs.

Default is read-only. Uses normal checkout, payment reconciliation and batch
creation; preserves existing orders, stock, addresses and nonempty baskets.
Requires the existing Dapur Kita catalogue, secure staff bindings and explicit
--apply --fictional-demo flags. No money transfer or stock deduction occurs.
"""
import argparse
from datetime import date, datetime, timedelta
from decimal import Decimal
import json
import os
from pathlib import Path
import uuid
from zoneinfo import ZoneInfo

from import_dapur_kita import StaffAPI, require


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--fictional-demo', action='store_true')
    parser.add_argument('--allow-local-http', action='store_true')
    args = parser.parse_args()
    require(not args.apply or args.fictional_demo, 'Applying requires explicit fictional-demo acknowledgement.')
    require(all(os.environ.get(k) for k in ('DJANGO_STAFF_USERNAME', 'DJANGO_STAFF_PASSWORD')), 'Configure staff bindings securely.')
    api = StaffAPI(args.base_url, os.environ['DJANGO_STAFF_USERNAME'], os.environ['DJANGO_STAFF_PASSWORD'],
                   allow_local_http=args.allow_local_http)
    plan = api.request('GET', 'admin/predictive/local-plan/')
    today = date.fromisoformat(plan['as_of'])
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True, mode=0o700)

    def save(name, value):
        path = out / name
        if not path.exists():
            path.write_text(json.dumps(value, indent=2)); path.chmod(0o600)

    resources = {name: api.request('GET', path) for name, path in
                 [('orders', 'admin/orders/'), ('batches', 'admin/inventory-items/'),
                  ('products', 'products/'), ('materials', 'admin/raw-materials/'),
                  ('cart', 'cart/'), ('addresses', 'addresses/')]}
    for name, value in resources.items():
        save(name + '-before.json', value)
    request_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f'freshcast-fictional-kitchen-demo:{args.base_url}:{today}'))
    previous = next((o for o in resources['orders'] if o['checkout_request_id'] == request_id), None)
    if previous and not args.apply:
        print(json.dumps({'already_prepared': True, 'order_id': previous['id'], 'payment_status': previous['payment_status']}))
        return
    require(previous or not resources['cart'], 'Preserve the existing basket: use an account with an empty basket.')
    require(resources['addresses'], 'The staff account needs an existing saved checkout address.')
    menu = next((p for p in resources['products'] if p['name'] == 'Nasi Ayam Kunyit' and p.get('selling_status') == 'active'), None)
    require(menu and menu['ingredients'], 'Expected active Nasi Ayam Kunyit with reviewed recipes.')
    materials = {m['id']: m for m in resources['materials']}
    portions = 4
    delivery_day = today + timedelta(days=2)
    delivery = datetime.combine(delivery_day, datetime.min.time()).replace(hour=17, tzinfo=ZoneInfo(plan['timezone']))
    stock = []
    for ingredient in menu['ingredients']:
        material = materials[ingredient['raw_material']]
        need = Decimal(ingredient['quantity_required']) * portions
        multiplier = Decimal('0.5') if material['name'] == 'Chicken boneless trimmed' else Decimal('1.5') if material['name'] == 'Rice' else Decimal('1')
        expiry = delivery_day if material['name'] == 'Rice' else today + timedelta(days=14)
        stock.append({'raw_material': material['id'], 'quantity': str((need * multiplier).quantize(Decimal('.001'))),
                      'received_date': str(today), 'expiry_date': str(expiry), 'original_expiry_date': str(expiry),
                      'expiry_basis': 'label', 'label_date_type': 'not_recorded', 'source_type': 'other',
                      'supplier': 'Fictional FreshCast hackathon scenario',
                      'batch_code': f'FRESHCAST-DEMO-{today}-{material["id"]}',
                      'storage_location': 'Fictional demo stock — not a physical stock count',
                      'handling_history': 'documented', 'handling_note': 'Fictional test record. Storage and dates are assumptions for the hackathon, not physical food safety evidence.',
                      'guidance_note': 'Assumed demo expiry date, not a supplier label or validated shelf life.',
                      'quarantined': False, 'unit_cost': material['estimated_unit_cost']})
    preview = {'fictional_demo': True, 'menu': menu['name'], 'portions': portions,
               'delivery_at': delivery.isoformat(), 'new_batches': stock,
               'purpose': 'Confirmed chicken shortage and rice expiry surplus; no historical data rewrite.'}
    save('prepared-plan.json', preview)
    print(json.dumps({k: preview[k] for k in ('fictional_demo', 'menu', 'portions', 'delivery_at', 'purpose')}))
    if not args.apply:
        return
    if previous:
        require(previous['status'] == 'pending' and not previous['inventory_deducted'] and previous['payment_status'] in ('paid', 'unpaid'),
                'Existing demo order has progressed; preserve it and review manually.')
        order = {'order_id': previous['id']}
    else:
        cart = api.request('POST', 'cart/', {'product_id': menu['id'], 'quantity': portions})
        save('created-cart-item.json', {'id': cart['id'], 'product_id': menu['id'], 'quantity': portions})
        quote = api.request('POST', 'orders/quote/', {'delivery_at': delivery.isoformat()})
        require(not quote.get('needs_review'), 'Checkout quote requires preparation review; no paid demo order was fabricated.')
        order = api.request('POST', 'orders/place/', {'address_id': resources['addresses'][0]['id'], 'payment': 'cod',
                                                'delivery_at': delivery.isoformat(), 'request_id': request_id})
    require(not order.get('needs_review'), 'Order needs review; stop before recording the fictional payment.')
    payment = {'id': None} if previous and previous['payment_status'] == 'paid' else api.request('POST', f'admin/orders/{order["order_id"]}/payments/',
                         {'request_id': str(uuid.uuid5(uuid.NAMESPACE_URL, request_id + ':payment')),
                          'kind': 'receipt', 'outcome': 'completed', 'reference': 'FICTIONAL FRESHCAST HACKATHON DEMO — NO MONEY RECEIVED',
                          'note': 'Owner-authorized fictional test transaction only. This is not evidence of a bank transfer or real customer purchase.'})
    created = []
    existing = {b['batch_code']: b for b in resources['batches']}
    for batch in stock:
        if batch['batch_code'] in existing:
            require(all(str(existing[batch['batch_code']].get(k)) == str(batch[k]) for k in ('raw_material', 'quantity', 'received_date', 'expiry_date')),
                    'Existing demo batch differs; preserve it and review instead of overwriting.')
            created.append(existing[batch['batch_code']]['id'])
        else:
            created.append(api.request('POST', 'admin/inventory-items/', batch)['id'])
    result = {'fictional_demo': True, 'order_id': order['order_id'], 'payment_event_id': payment['id'], 'created_batch_ids': created}
    save('applied.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
