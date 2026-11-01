export const receiptStatus=order=>order.status==='delivered'?'received':'not_received';
export function validSimpleQuote(data){
 return data?.ordering_mode==='simple'&&data.needs_review===false&&data.preparation_at===null&&data.preparation_end_at===null
  &&data.stock_deduction_stage==='placement'&&Array.isArray(data.tasks)&&data.tasks.length===0;
}
export function validReceiptUpdate(data,ids,received){
 return Array.isArray(data?.updated)&&data.updated.length===ids.length&&new Set(data.updated.map(r=>r?.id)).size===ids.length
  &&data.updated.every(r=>ids.includes(r?.id)&&r.status===(received?'delivered':'pending')&&typeof r.updated_at==='string'&&Number.isFinite(Date.parse(r.updated_at)));
}
