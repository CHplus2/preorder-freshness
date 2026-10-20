import {orderQueues} from '../utils/orderQueue';
export default function OwnerOrderShortcuts({counts,value,onChange}) {
 return <div className="owner-order-shortcuts" role="group" aria-label="Order shortcuts">
  {orderQueues.map(([key,label])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}><span>{label}</span><strong>{counts[key]}</strong></button>)}
 </div>;
}
