"""Audit local fulfilment targets without inventing demand or training a model.

Only a minimal projection leaves the authenticated API response. Snapshot status
is the current status, not a reconstructed status at a historical forecast date.
"""
from collections import Counter
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo('Asia/Kuala_Lumpur')
PROVENANCE = {'fictional_demo', 'business_history'}
MIN_OBSERVED_WEEKS = 12  # Preparation threshold, not proof of forecast accuracy.


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.utcoffset() is None:
        raise ValueError('Timestamps must include a timezone.')
    return result.astimezone(TIMEZONE)


def positive_int(value):
    if type(value) is not int or value <= 0:
        raise ValueError('IDs and quantities must be positive integers.')
    return value


def week_start(value):
    day = value.date()
    return day - timedelta(days=day.weekday())


def snapshot(orders, products, *, as_of, provenance, catalogue_relabelled=False):
    """Strip customer, address, payment, price and other unused fields."""
    if provenance not in PROVENANCE or type(catalogue_relabelled) is not bool:
        raise ValueError('Declare the data provenance and catalogue identity history.')
    moment = timestamp(as_of)
    menus = []
    menu_ids = set()
    for product in products:
        pk = positive_int(product['id'])
        if pk in menu_ids:
            raise ValueError('Duplicate product ID.')
        menu_ids.add(pk)
        menus.append({'product_id': pk, 'created_at': timestamp(product['created_at']).isoformat()})
    records = []
    order_ids, item_ids = set(), set()
    for order in orders:
        pk = positive_int(order['id'])
        if order['status'] not in {'pending', 'processing', 'cooked', 'shipped', 'delivered', 'cancelled'} or order['payment_status'] not in {'unpaid', 'paid', 'refunded'}:
            raise ValueError('Unknown order or payment status.')
        if pk in order_ids:
            raise ValueError('Duplicate order ID; refusing a partial or repeated export.')
        order_ids.add(pk)
        items = []
        for item in order['items']:
            item_id = positive_int(item['id'])
            if item_id in item_ids:
                raise ValueError('Duplicate order item ID.')
            item_ids.add(item_id)
            product_id = positive_int(item['product'])
            if product_id not in menu_ids:
                raise ValueError('Order references a product missing from the catalogue export.')
            items.append({'item_id': item_id, 'product_id': product_id,
                          'quantity': positive_int(item['quantity'])})
        records.append({'order_id': pk, 'created_at': timestamp(order['created_at']).isoformat(),
                        'delivery_at': timestamp(order['delivery_at']).isoformat() if order['delivery_at'] else None,
                        'status': order['status'], 'payment_status': order['payment_status'],
                        'items': sorted(items, key=lambda row: row['item_id'])})
    return {'schema_version': 1, 'source': 'LOCAL_FYP', 'timezone': str(TIMEZONE),
            'as_of': moment.isoformat(), 'provenance': provenance,
            'catalogue_relabelled': catalogue_relabelled,
            'products': sorted(menus, key=lambda row: row['product_id']),
            'orders': sorted(records, key=lambda row: row['order_id'])}


def normalize_snapshot(data):
    """Revalidate saved input and project again so offline replay also drops PII."""
    if data['schema_version'] != 1 or data['source'] != 'LOCAL_FYP':
        raise ValueError('Unsupported local snapshot schema.')
    # Revalidate offline snapshots using the same projection as a live export.
    products = [{'id': p['product_id'], 'created_at': p['created_at']} for p in data['products']]
    orders = [dict(o, id=o['order_id'], items=[dict(i, id=i['item_id'], product=i['product_id'])
                                             for i in o['items']]) for o in data['orders']]
    return snapshot(orders, products, as_of=data['as_of'], provenance=data['provenance'],
                    catalogue_relabelled=data['catalogue_relabelled'])


def audit(data):
    """Return a readiness report and *observed* eligible weekly quantities.

    No zero weeks are backfilled: catalogue availability/recording coverage are
    unknown. Eligible observations alone are not a training-ready dense panel.
    """
    clean = normalize_snapshot(data)
    now = timestamp(clean['as_of'])
    current_week = week_start(now)
    creation = {p['product_id']: timestamp(p['created_at']) for p in clean['products']}
    reasons, totals = Counter(), Counter()
    eligible_orders = 0
    for order in clean['orders']:
        booked = timestamp(order['created_at'])
        delivery = timestamp(order['delivery_at']) if order['delivery_at'] else None
        if order['status'] == 'cancelled' or order['payment_status'] == 'refunded':
            reasons['cancelled_or_refunded'] += 1
        elif order['status'] != 'delivered' or order['payment_status'] != 'paid':
            reasons['not_delivered_and_paid'] += 1
        elif delivery is None:
            reasons['missing_delivery_date'] += 1
        elif booked > delivery or booked > now or delivery > now:
            reasons['invalid_or_future_dates'] += 1
        elif week_start(delivery) >= current_week:
            reasons['incomplete_delivery_week'] += 1
        elif not order['items']:
            reasons['empty_order'] += 1
        elif any(creation[i['product_id']] > delivery for i in order['items']):
            reasons['product_created_after_delivery'] += 1
        else:
            eligible_orders += 1
            for item in order['items']:
                totals[(week_start(delivery).isoformat(), item['product_id'])] += item['quantity']
    rows = [{'week_start': week, 'product_id': pk, 'observed_portions': quantity}
            for (week, pk), quantity in sorted(totals.items())]
    observed_weeks = len({r['week_start'] for r in rows})
    blockers = []
    if clean['provenance'] == 'fictional_demo':
        blockers.append('Orders are fictional demo records, not evidence of customer demand.')
    if clean['catalogue_relabelled']:
        blockers.append('Historical menu identities were reassigned; current dish names do not identify historical demand.')
    if observed_weeks < MIN_OBSERVED_WEEKS:
        blockers.append(f'Only {observed_weeks} eligible observed delivery weeks; preparation target is at least {MIN_OBSERVED_WEEKS}, then chronological evaluation.')
    blockers.append('Verified menu availability and order-recording coverage are missing; absent orders cannot be assumed to be zero demand.')
    report = {'source': clean['source'], 'as_of': clean['as_of'], 'timezone': clean['timezone'],
              'provenance': clean['provenance'], 'catalogue_relabelled': clean['catalogue_relabelled'],
              'target': 'Paid, delivered portions per product per completed local Monday-Sunday week',
              'orders': len(clean['orders']), 'order_items': sum(len(o['items']) for o in clean['orders']),
              'orders_missing_delivery_date': sum(o['delivery_at'] is None for o in clean['orders']),
              'delivered_paid_orders': sum(o['status'] == 'delivered' and o['payment_status'] == 'paid' for o in clean['orders']),
              'eligible_orders': eligible_orders, 'eligible_observed_weeks': observed_weeks,
              'eligible_product_week_rows': len(rows), 'excluded_orders_by_reason': dict(sorted(reasons.items())),
              'training_status': 'blocked', 'candidate_model_trained': False,
              'model_wape_percent': None, 'baseline_wape_percent': None, 'blockers': blockers,
              'warnings': ['Current status is not a historical status snapshot; never use final status or final payment as past forecast features.',
                           'Order creation date is booking time, not a substitute for missing fulfilment time.',
                           'No missing weeks, missing dates, stock receipts or historical dish identities have been invented.']}
    return report, rows
