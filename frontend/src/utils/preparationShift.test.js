import assert from 'node:assert/strict';
import {shiftPreparation} from './preparationShift.js';
const tasks=[
 {start:'2026-10-18T18:00:00+08:00',end:'2026-10-18T18:30:00+08:00'},
 {start:'2026-10-18T18:15:00+08:00',end:'2026-10-18T19:00:00+08:00'},
 {start:'2026-10-19T08:00:00+08:00',end:'2026-10-19T09:45:00+08:00'},
];
const shifted=shiftPreparation(tasks,'2026-10-20T18:00');
assert.equal(shifted.start,'2026-10-20T10:00:00.000Z');
assert.equal(shifted.end,'2026-10-21T01:45:00.000Z');
assert.equal(shifted.steps[1].start,'2026-10-20T10:15:00.000Z');
assert.equal(shifted.steps[2].start,'2026-10-21T00:00:00.000Z');
// API indexes still identify the original tasks even when tasks aren't sorted.
const unsorted=shiftPreparation([...tasks].reverse(),'2026-10-20T18:00');
assert.equal(unsorted.steps[0].index,0);
assert.equal(unsorted.steps[0].start,'2026-10-21T00:00:00.000Z');
assert.equal(unsorted.end,shifted.end);
assert.equal(shiftPreparation(tasks,''),null);
assert.equal(shiftPreparation([],'2026-10-20T18:00'),null);
assert.equal(shiftPreparation([{start:'invalid',end:tasks[0].end}],'2026-10-20T18:00'),null);
assert.equal(shiftPreparation([{start:tasks[0].end,end:tasks[0].start}],'2026-10-20T18:00'),null);
console.log('Preparation shift: Malaysia time, overnight gaps, overlapping tasks, original indexes and invalid saved times passed.');
