import {invalidResponse} from './apiResponse.js';

// Keep a confirmed cancellation and its counts in one update. An older list
// request is aborted by the provider before this action is dispatched.
export function orderHistoryReducer(state,action){
 if(action.type==='loaded')return {page:action.page,rows:action.append
  ?[...state.rows,...action.page.rows.filter(row=>!state.rows.some(previous=>previous.id===row.id))]
  :action.page.rows};
 if(action.type==='view')return {rows:[],page:state.page
  ?{...state.page,view:action.view,count:state.page.counts[action.view]}:null};
 if(action.type!=='cancelled')return state;
 const previous=state.rows.find(row=>row.id===action.order.id);
 if(!previous)return state;
 const moved=!['delivered','cancelled'].includes(previous.status);
 const counts=state.page?{...state.page.counts,
  current:state.page.counts.current-(moved?1:0),history:state.page.counts.history+(moved?1:0)}:null;
 return {rows:state.rows.map(row=>row.id===action.order.id?action.order:row),
  page:state.page?{...state.page,counts,count:counts[state.page.view]}:null};
}

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
