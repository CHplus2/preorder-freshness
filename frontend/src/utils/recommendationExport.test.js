import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendationCsv} from './recommendationExport.js';

const data={generated_at:'2026-10-03T08:00:00+00:00',window_start:'2026-09-05T08:00:00+00:00',window_end:'2026-10-03T08:00:00+00:00',days:28,experiment_enabled:false,definition:'Attribution, with "quoted" notes',rows:[{variant:'personalised',exposed_sessions:3,clicked_sessions:2,added_sessions:1,ordered_sessions:1,paid_sessions:0}]};
test('exports displayed counts and rates with provenance and correctly quoted CSV',()=>{
  const csv=recommendationCsv(data);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"personalised","3","2","1","1","0","66.7","33.3","33.3","0.0"'));
  assert.ok(csv.includes('"Attribution, with ""quoted"" notes"'));
  assert.ok(csv.includes('"2026-09-05T08:00:00+00:00"'));
  assert.ok(csv.includes('not unique customers'));
});
test('empty cohort preserves report metadata without inventing percentages',()=>{
  const csv=recommendationCsv({...data,rows:[]});
  assert.ok(csv.includes('"no_exposures","","","","","","","","",""'));
  assert.ok(csv.includes(data.generated_at));
});
test('missing measures stay blank while recorded zero remains zero',()=>{
  const csv=recommendationCsv({...data,rows:[{variant:'popularity',exposed_sessions:2,paid_sessions:0}]});
  assert.ok(csv.includes('"popularity","2","","","","0","","","","0.0"'));
});
test('neutralises spreadsheet formulas in textual values',()=>{
  assert.ok(recommendationCsv({...data,definition:'=HYPERLINK("example")'}).includes('"\'=HYPERLINK(""example"")"'));
});
