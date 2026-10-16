const KEY='freshcast.local-decision-reviews.v1';
export function readReviews(storage){
  try{
    const rows=JSON.parse((storage||globalThis.localStorage).getItem(KEY)||'[]');
    if(!Array.isArray(rows)||!rows.every(r=>typeof r.token==='string'&&typeof r.snapshot?.id==='string'))throw Error('Invalid reviews');
    return {rows:rows.slice(0,20),error:null};
  }catch{return {rows:[],error:'Saved reviews could not be read from this browser. Storage may be blocked or the saved data is invalid.'};}
}
export function saveReview(record,storage){
  const target=storage||globalThis.localStorage;
  const previous=readReviews(target);
  if(previous.error)throw Error(previous.error);
  if(typeof record.token!=='string'||typeof record.snapshot?.id!=='string')throw Error('The signed review response is incomplete.');
  const rows=[record,...previous.rows.filter(r=>r.snapshot.id!==record.snapshot.id)].slice(0,20);
  try{target.setItem(KEY,JSON.stringify(rows));}catch{throw Error('This browser could not save the review. Download a decision slip instead; no operational action was executed.');}
}
export function saveOutcomeNote(id,note,storage){
  const target=storage||globalThis.localStorage,previous=readReviews(target);
  if(previous.error)throw Error(previous.error);
  target.setItem(KEY,JSON.stringify(previous.rows.map(r=>r.snapshot.id===id?{...r,outcome_note:note,reviewed_at:new Date().toISOString()}:r)));
}
