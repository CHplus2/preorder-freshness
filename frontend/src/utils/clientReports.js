import {invalidResponse} from './apiResponse.js';
import {readArrivalWindow} from './arrivalWindow.js';

const count = value => Number.isSafeInteger(value) && value >= 0;
const money = value => typeof value === 'string' && /^\d+\.\d{2}$/.test(value) && Number.isFinite(Number(value));
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const menus = rows => Array.isArray(rows) && rows.length <= 500 && rows.every(row =>
 typeof row.product_name === 'string' && count(row.quantity) && money(row.gross_food));
const amounts = (data, keys) => keys.every(key => money(data?.[key]));

export const malaysiaDay = (now = new Date()) => new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
export const reportMoney = value => 'RM ' + Number(value).toLocaleString('en-MY', {minimumFractionDigits:2, maximumFractionDigits:2});
export const slipUrl = id => `/admin/orders/${id}/print`;

export function readSlip(data, expectedId) {
 if (!data || data.id !== expectedId || typeof data.name !== 'string'
  || !['received','not_received','cancelled'].includes(data.receipt_status)
  || !['unpaid','paid','refunded'].includes(data.payment_status)
  || !['standard','express','pickup'].includes(data.delivery_method)
  || data.delivery_at !== null && !Number.isFinite(Date.parse(data.delivery_at))
  || !amounts(data, ['food_total','delivery_fee','discount','total'])
  || !Array.isArray(data.items) || data.items.some(row => typeof row.name !== 'string' || !count(row.quantity)
    || !amounts(row, ['unit_price','food_total']))) throw invalidResponse();
 readArrivalWindow(data.arrival_window, data.delivery_at);
 return data;
}

export function dailyReport(data, expectedDate, expectedPage) {
 if (!data || data.date !== expectedDate || data.page !== expectedPage || data.page_size !== 50
  || !['count','cancelled_count','received_count','quantity'].every(key => count(data[key]))
  || typeof data.has_more !== 'boolean' || typeof data.menus_truncated !== 'boolean'
  || !amounts(data, ['food_total','delivery_fee','order_value']) || !menus(data.menus)
  || !Array.isArray(data.orders) || data.orders.length > 50) throw invalidResponse();
 data.orders.forEach(row => readSlip(row, row.id));
 if (data.orders.some(row => !Number.isSafeInteger(row.id) || row.id < 1)
  || new Set(data.orders.map(row => row.id)).size !== data.orders.length) throw invalidResponse();
 return data;
}

export function periodReport(data, start, end) {
 if (!data || data.start !== start || data.end !== end
  || !['paid_received_orders','unpaid_received_orders','unscheduled_orders','excluded_test_orders'].every(key => count(data[key]))
  || !amounts(data, ['net_food_sales','delivery_income','discounts','total_sales'])
  || !menus(data.menus) || typeof data.menus_truncated !== 'boolean'
  || !Array.isArray(data.days) || data.days.length > 366 || data.days.some(row =>
    !date(row.date) || row.date < start || row.date > end || !amounts(row, ['net_food_sales','delivery_income','total_sales']))) throw invalidResponse();
 return data;
}

export function printableSlip(data, id) {
 readSlip(data, id);
 if (typeof data.phone !== 'string' || typeof data.kitchen !== 'string'
  || typeof data.pickup_location !== 'string' || typeof data.handover_notes !== 'string'
  || typeof data.handover_location !== 'string' || !Array.isArray(data.address_lines)
  || data.address_lines.some(value => typeof value !== 'string') || !Number.isFinite(Date.parse(data.printed_at))) throw invalidResponse();
 return data;
}
