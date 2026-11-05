"""Offline payment choices. Uploads are evidence, never automatic bank confirmation."""
def available(store, method='standard'):
    if not store.manual_payment_enabled:
        return False
    return bool(store.duitnow_qr_url) if method == 'pickup' else bool(store.duitnow_qr_url or store.bank_transfer_instructions.strip())
