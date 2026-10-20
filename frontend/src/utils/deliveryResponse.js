import {invalidResponse} from './apiResponse.js';

const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function deliveryPolicy(data) {
  if (typeof data?.eligible !== 'boolean' || typeof data.reason !== 'string'
      || (data.initial_delivery !== undefined && typeof data.initial_delivery !== 'boolean')
      || (data.unconfirmed_request !== undefined && typeof data.unconfirmed_request !== 'boolean')
      || (data.eligible && !((data.initial_delivery === true || data.unconfirmed_request === true) && data.cutoff === null) && !date(data.cutoff)) || !Array.isArray(data.history)
      || data.history.some(row => !Number.isInteger(row?.id) || row.id < 1
        || !date(row.at) || !date(row.delivery_at) || !(row.previous_delivery === null || date(row.previous_delivery))
        || typeof row.reason !== 'string' || typeof row.by !== 'string')) throw invalidResponse();
  return data;
}

export function deliveryPreview(data) {
  const preview = data?.preview;
  if (typeof data?.confirm !== 'string' || !data.confirm.trim()
      || !(preview?.previous_delivery === null || date(preview?.previous_delivery)) || !date(preview?.delivery_at)
      || (preview?.unconfirmed_request !== undefined && typeof preview.unconfirmed_request !== 'boolean')
      || (preview?.needs_review !== undefined && typeof preview.needs_review !== 'boolean')
      || (!date(preview?.change_closes_at) && !(preview?.unconfirmed_request===true && preview.needs_review===true && preview.change_closes_at===null)) || typeof preview?.reason !== 'string') throw invalidResponse();
  return data;
}

export function deliveryConfirmation(data, orderId) {
  if (data?.order?.id !== orderId || !date(data.order.delivery_at)
      || typeof data.already_applied !== 'boolean') throw invalidResponse();
  return data;
}
