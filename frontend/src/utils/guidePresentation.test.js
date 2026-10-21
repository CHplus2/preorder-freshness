import assert from 'node:assert/strict';
import {guideDateBounds,guideEmptyMessage} from './guidePresentation.js';
assert.deepEqual(guideDateBounds(new Date('2026-10-21T17:00:00Z')),{first:'2026-10-22',last:'2027-01-20'});
assert.deepEqual(guideDateBounds(new Date('2024-02-28T02:00:00Z')),{first:'2024-02-28',last:'2024-05-28'});
assert.match(guideEmptyMessage('category_unavailable','Bakes'),/No Bakes menus/);
assert.match(guideEmptyMessage('no_kitchen_times','Bakes'),/No automatic kitchen times/);
assert.match(guideEmptyMessage('no_menu_match','Bakes'),/Bakes menus do not match/);
assert.doesNotMatch(guideEmptyMessage(undefined,'Any category'),/No Bakes/);
console.log('Guide presentation: Malaysia date bounds, leap-year arithmetic and category/time/filter recovery passed.');
