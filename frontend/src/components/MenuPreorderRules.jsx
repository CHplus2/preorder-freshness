import {cutoffText,offeredDatesText,deliveryDateText} from '../utils/preorderWindows';
import './MenuOrderWindow.css';

export default function MenuPreorderRules({product,compact=false}) {
 const dates=product.delivery_dates || [],cutoff=cutoffText(product);
 if(!dates.length && !cutoff)return null;
 return <div className={compact?'preorder-rules-compact':'preorder-rules'}>
  {dates.length>0 && <p>Delivery dates: {offeredDatesText(dates)}</p>}
  {!compact && dates.length>3 && <details><summary>All offered dates</summary><ul>{dates.map(day=><li key={day}>{deliveryDateText(day)}</li>)}</ul></details>}
  {cutoff && <p>{cutoff}.</p>}
  {!compact && <p className="preorder-window-note">Preparation notice and availability still apply. Choose an offered time for your whole basket.</p>}
 </div>;
}
