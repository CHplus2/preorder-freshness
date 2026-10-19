import {Link} from 'react-router-dom';
import {Check} from 'lucide-react';
import './CustomerOrdering.css';

const steps=[['menu','Choose food','/menu'],['cart','Your basket','/cart'],['checkout','Delivery & payment','/checkout']];
export default function OrderJourney({current}){
 const active=steps.findIndex(([key])=>key===current);
 return <ol className="order-journey" aria-label="Preorder steps">{steps.map(([key,label,to],index)=><li key={key} aria-current={key===current?'step':undefined} className={index<active?'is-complete':''}><span className="order-journey-number" aria-hidden="true">{index<active?<Check size={13}/>:index+1}</span>{index<active?<Link to={to}>{label}</Link>:<span>{label}</span>}</li>)}</ol>;
}
