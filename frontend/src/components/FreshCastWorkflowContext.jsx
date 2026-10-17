import {Link,useSearchParams} from 'react-router-dom';
import {workflowReturnLink} from '../features/predictive/kitchenDecision';
export default function FreshCastWorkflowContext(){
  const [params]=useSearchParams();
  if(params.get('from')!=='freshcast'||!/^\d+$/.test(params.get('material')||''))return null;
  const id=params.get('material'),name=params.get('ingredient')||`Ingredient #${id}`;
  return <section className="admin-notice" aria-label="Forecast decision context"><strong>FreshCast review: {name}</strong>
    <p>Check the current records before changing purchases or preparation. Forecast quantities are advisory; nothing has been applied automatically.</p>
    <Link to={workflowReturnLink(params)}>Return to this decision & save follow-up →</Link></section>;
}
