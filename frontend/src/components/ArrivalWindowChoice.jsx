import {useId} from 'react';
export default function ArrivalWindowChoice({value=0,onChange,disabled=false}){
 const id=useId();
 return <div className="arrival-window-choice"><label htmlFor={id}>Arrival timing</label><select id={id} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}><option value={60}>1-hour arrival window (recommended)</option><option value={30}>30-minute arrival window</option><option value={0}>One agreed time</option></select><p>The kitchen plans preparation against the latest arrival. Confirm courier arrangements; a window is not a live traffic estimate. Contact the kitchen for a strict event deadline.</p></div>;
}
