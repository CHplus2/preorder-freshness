"""Keep forecast provenance separate from operational order permissions."""
HISTORY_VERSION = '1'
HISTORY_KEY = 'freshcast_synthetic_history'


def generated_sales_summary(order):
    """Forecast-only daily aggregates are not individual customer orders."""
    metadata = getattr(order, 'payment_instructions', None)
    marker = metadata.get(HISTORY_KEY) if isinstance(metadata, dict) else None
    return isinstance(marker, dict) and marker.get('version') == HISTORY_VERSION


def synthetic_history(order):
    """Both aggregates and constructed individual orders need honest evaluation."""
    metadata = getattr(order, 'payment_instructions', None)
    return isinstance(metadata, dict) and any(isinstance(metadata.get(key),dict) and metadata[key].get('version') == HISTORY_VERSION for key in (HISTORY_KEY,'catalogue_refresh_sample'))
