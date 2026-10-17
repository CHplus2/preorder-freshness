"""Provenance markers for explicitly generated demo history, never real sales."""
HISTORY_VERSION = '1'
HISTORY_KEY = 'freshcast_synthetic_history'


def synthetic_history(order):
    metadata = getattr(order, 'payment_instructions', None)
    return isinstance(metadata, dict) and isinstance(metadata.get(HISTORY_KEY), dict) and metadata[HISTORY_KEY].get('version') == HISTORY_VERSION
