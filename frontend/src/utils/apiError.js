export function apiError(error, fallback = 'The request could not be completed.') {
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
