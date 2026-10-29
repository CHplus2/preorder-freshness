import {useId,useState} from 'react';
import {deliveryCostCheck} from '../utils/deliveryCost';
const money=value=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(value);
export default function DeliveryCostCheck({fee,freeMinimum}){
 const [quote,setQuote]=useState('');
 const id=useId();
 const alwaysFree=freeMinimum!=null && String(freeMinimum).trim()!=='' && Number(freeMinimum)===0;
 const result=deliveryCostCheck(alwaysFree?'0.00':fee,quote);
 return <details className="delivery-cost-check"><summary>Check a courier cost</summary>
  <p>Compare your shop fee with a quote you enter. This example is not saved and does not change any order or fetch courier prices.</p>
  <label htmlFor={id}>Example courier quote (RM)<input id={id} type="text" inputMode="decimal" maxLength={12} value={quote} placeholder="Enter a quote to compare" onChange={e=>setQuote(e.target.value)}/></label>
  {quote!=='' && <div className="delivery-cost-result" role="status">{result?<>
   <dl><div><dt>Customer delivery fee{alwaysFree?' · free delivery':' · when charged'}</dt><dd>{money(result.customer)}</dd></div><div><dt>Your courier cost · example</dt><dd>{money(result.courier)}</dd></div><div><dt>{result.coveredByShop>0?'Kitchen covers the difference':result.remaining>0?'Left towards other delivery costs':'Difference'}</dt><dd>{money(result.coveredByShop || result.remaining)}</dd></div></dl>
   {result.coveredByShop>0 && <p>This difference is a cost to the kitchen, not a second customer charge.</p>}
   {result.remaining>0 && <p>This remainder is not net profit; packing, travel and other delivery costs may still apply.</p>}
   {freeMinimum!=null && !alwaysFree && <p>For an order qualifying for free delivery, the customer pays RM0.00 delivery and the kitchen covers the full {money(result.courier)} example courier cost.</p>}
  </>:<p>Enter a non-negative amount with up to two decimal places, such as 8.50.</p>}</div>}
 </details>;
}
