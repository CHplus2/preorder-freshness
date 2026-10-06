// Read-only requests can be retried without the order-submission warning.
export function readApiError(error, fallback = 'The records could not be loaded.') {
  if (error?.code === 'INVALID_RESPONSE') return 'The kitchen returned an unexpected response. Refresh these records to try again.';
  if (!error?.response) {
    return error?.code === 'ECONNABORTED'
      ? 'Loading took too long. Check your connection and try again.'
      : 'Could not load these records. Check your connection and try again.';
  }
  if (error.response.status >= 500) {
    const reference = error.response.data?.reference;
    return 'These records are temporarily unavailable. Please try again shortly.'
      + (typeof reference === 'string' ? ` Reference: ${reference}` : '');
  }
  return apiError(error, fallback);
}

export function apiError(error, fallback = 'The request could not be completed.') {
  if (error?.code === 'CHECKOUT_STORAGE') return 'Checkout could not safely save or read its request reference. No new order request was sent. Check My orders before clearing browser data or starting again; allow browser storage to continue.';
  if (error?.code === 'INVALID_RESPONSE') return 'The kitchen returned an unexpected response. Please reload and try again. If you submitted an order, check My orders first.';
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') return 'The request took too long. Check your connection. If you submitted an order, check My orders before trying again.';
    return 'Could not reach the kitchen. Check your connection and try again. If you submitted an order, check My orders first.';
  }
  const {status, data} = error.response;
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
  if (status >= 500) return 'The kitchen service is temporarily unavailable. Please try again shortly. If you submitted an order, check My orders first.' + (typeof data?.reference === 'string' ? ` Reference: ${data.reference}` : '');
  const flatten = (value, label = '') => {
    if (typeof value === 'string') return /<[^>]+>/.test(value) ? [] : [label + value];
    if (Array.isArray(value)) return value.flatMap(v => flatten(v, label));
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key,v]) => flatten(v, ['detail','non_field_errors'].includes(key) ? label : `${key.replaceAll('_',' ')}: `));
    return [];
  };
  const message = flatten(data).slice(0,6).join(' ');
  if (message.includes('CSRF')) return 'Your session could not be verified. Refresh the page and sign in again. Your form has not been cleared.';
  return message || fallback;
}
