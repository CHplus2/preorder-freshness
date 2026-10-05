import {invalidResponse, responseList} from './apiResponse.js';

const amount = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
  && Number.isFinite(Number(value)) && Number(value) >= 0;
const optionalAmount = value => value === null || amount(value);

export function salesSummary(data) {
  const a = data?.analytics, f = data?.forecast;
  if (!a || !f || !amount(a.net_food_sales) || !amount(a.average_order_value)
      || !Number.isInteger(a.paid_orders) || a.paid_orders < 0 || !Array.isArray(a.trend)
      || a.trend.some(row => typeof row?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
        || !Number.isFinite(Date.parse(row.date)) || !amount(row.sales))
      || typeof f.method !== 'string' || !optionalAmount(f.next_7_days_portions)
      || !optionalAmount(f.validation_mae)) throw invalidResponse();
  return data;
}

export function menuSales(data) {
  const rows = responseList(data);
  if (rows.some(row => typeof row.product_name !== 'string'
      || !Number.isInteger(row.total_quantity) || row.total_quantity < 0
      || !amount(row.total_revenue))) throw invalidResponse();
  return rows;
}
