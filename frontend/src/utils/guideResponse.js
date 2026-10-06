import {invalidResponse, responseSlots} from './apiResponse.js';

export function guideResponse(data) {
  if (!data || typeof data.session !== 'string' || !data.session ||
      typeof data.message !== 'string' || !Array.isArray(data.results)) throw invalidResponse();
  for (const row of data.results) {
    if (!row || !Number.isInteger(row.id) || row.id < 1 || typeof row.name !== 'string' ||
        !Number.isInteger(row.portions) || row.portions < 1 ||
        !['number', 'string'].includes(typeof row.food_total) || String(row.food_total).trim() === '' ||
        !Number.isFinite(Number(row.food_total)) || Number(row.food_total) < 0 ||
        !Array.isArray(row.reasons) || row.reasons.some(reason => typeof reason !== 'string')) throw invalidResponse();
    if (!responseSlots(row).length) throw invalidResponse();
  }
  return data;
}

// These preferences are optional; checkout still asks for and validates a delivery time.
export function rememberSuggestion(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* Private storage must not block the basket. */ }
}
