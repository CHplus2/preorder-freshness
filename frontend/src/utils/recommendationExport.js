const metrics = ['exposed_sessions', 'clicked_sessions', 'added_sessions', 'ordered_sessions', 'paid_sessions'];
const notes = 'Counts are recommendation requests, not unique customers or a sequential funnel. Recent requests may still convert; later payment updates may change outcomes. Current experiment mode may differ from historical assignment. Observed results do not prove causal sales lift or reduced decision fatigue.';

function cell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// Export the displayed response, rather than fetching potentially different counts.
export function recommendationCsv(data) {
  const headers = ['generated_at', 'window_start_inclusive', 'window_end_inclusive', 'window_days', 'experiment_enabled_at_generation', 'variant', ...metrics,
    ...metrics.slice(1).map(key => `${key}_percent_of_exposed`), 'attribution_definition', 'interpretation_notes'];
  const rows = (data.rows.length ? data.rows : [null]).map(row => {
    const count = key => Number.isInteger(row?.[key]) && row[key] >= 0 ? row[key] : '';
    const percentages = metrics.slice(1).map(key => count(key) !== '' && count('exposed_sessions') > 0
      ? (100 * count(key) / count('exposed_sessions')).toFixed(1) : '');
    return [data.generated_at, data.window_start, data.window_end, data.days, data.experiment_enabled,
      row?.variant ?? 'no_exposures', ...metrics.map(count), ...percentages, data.definition, notes];
  });
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
