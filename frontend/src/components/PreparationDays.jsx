import {duration} from '../utils/planner';
import './PreparationDays.css';

export default function PreparationDays({plan}) {
 const days=plan?.daily_work;
 if(plan?.mode==='manual_window' || !Array.isArray(days) || days.length<2)return null;
 const date=value=>new Date(value+'T12:00:00+08:00').toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',day:'numeric',month:'short'});
 return <section className="preparation-days" aria-label="Preparation by day"><h3>Preparation across {days.length} days</h3><p>The kitchen uses earlier working days for this order. Pauses use the recorded handling and storage limits.</p><ol>{days.map(day=><li key={day.date}><time dateTime={day.date}>{date(day.date)}</time><strong>{day.hands_on_minutes>0?`${duration(day.hands_on_minutes)} hands-on`:'Rest or storage only'}</strong>{day.pause_minutes>0 && <span>{duration(day.pause_minutes)} planned pause</span>}</li>)}</ol></section>;
}
