"""Provenance markers for explicitly generated demo history, never real sales."""
HISTORY_VERSION = '1'
HISTORY_KEY = 'freshcast_synthetic_history'


def synthetic_history(order):
    metadata = getattr(order, 'payment_instructions', None)
    return isinstance(metadata, dict) and any(isinstance(metadata.get(key),dict) and metadata[key].get('version') == HISTORY_VERSION for key in (HISTORY_KEY,'catalogue_refresh_sample'))
