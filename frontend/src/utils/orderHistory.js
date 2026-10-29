import {invalidResponse} from './apiResponse.js';
export function orderHistoryPage(data,requestedView='auto',before=null){
 const views=['current','history','all'];
 const nonnegative=n=>Number.isSafeInteger(n) && n>=0;
 if(!data || !views.includes(data.view) || (requestedView!=='auto' && data.view!==requestedView)
  || requestedView==='auto' && data.view==='all' || !Array.isArray(data.results) || data.results.length>10
  || !data.counts || !views.every(key=>nonnegative(data.counts[key]))
  || data.counts.current+data.counts.history!==data.counts.all || data.count!==data.counts[data.view])throw invalidResponse();
 let previous=before ?? Infinity;
 for(const row of data.results){
  if(!row || !Number.isSafeInteger(row.id) || row.id<1 || row.id>=previous || typeof row.status!=='string'
   || !Array.isArray(row.items) || (data.view==='history' && !['delivered','cancelled'].includes(row.status))
   || (data.view==='current' && ['delivered','cancelled'].includes(row.status)))throw invalidResponse();
  previous=row.id;
 }
 if(data.next_before!==null && (!Number.isSafeInteger(data.next_before) || data.next_before<1 || data.results.length!==10 || data.next_before!==previous))throw invalidResponse();
 return {rows:data.results,view:data.view,count:data.count,counts:data.counts,nextBefore:data.next_before};
}
