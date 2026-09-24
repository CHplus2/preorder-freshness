"""Date-based inventory indicators, never a measurement of food safety."""
def inventory_summary(lots, today):
    scores = []
    expired = held = unknown = counted = within = 0
    for lot in lots:
        if lot.quantity <= 0 or lot.received_date > today:
            continue
        counted += 1
        is_expired = lot.expiry_date < today
        expired += int(is_expired)
        held += int(lot.quarantined)
        if is_expired or lot.quarantined:
            scores.append(0)
            continue
        start = lot.manufactured_date if lot.expiry_basis == 'manufactured' else lot.received_date
        if not start or lot.expiry_date <= start or (lot.expiry_basis != 'label' and not lot.guidance_note.strip()):
            unknown += 1
            continue
        within += 1
        scores.append(max(0, min(100, 100 * (lot.expiry_date - today).days / (lot.expiry_date - start).days)))
    return {
        'average_remaining_percent': round(sum(scores) / len(scores), 1) if scores else None,
        'recorded_batches': counted, 'assessed_batches': len(scores),
        'within_date_batches': within, 'unknown_batches': unknown, 'expired_batches': expired, 'held_batches': held,
        'as_of': today.isoformat(),
        'method': 'Equal weight per non-empty received batch. Printed-date batches use the receipt-to-expiry window; manufacture-based batches use manufacture-to-expiry. Expired or held batches contribute zero. Unknown records are excluded and reported separately.',
    }
