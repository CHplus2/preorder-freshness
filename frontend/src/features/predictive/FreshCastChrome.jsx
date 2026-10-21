/* global __FRESHCAST_REVISION__: readonly */
import {decisionSteps} from './decisionNavigation';
import {stockQuantity} from './kitchenPresentation';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import RescueDemo from './RescueDemo';
import './freshCastChrome.css';

export function FreshCastHeading({view,onRefresh,loading=false}) {
 const titles={decisions:'Decision assistant',inventory:'Stock & expiry',forecast:'Demand forecast'};
 const descriptions={decisions:'Spot expiry risks, compare options and choose your next action.',inventory:'Inspect ingredients and see how dated stock covers demand.',forecast:'Review expected demand and the evidence behind it.'};
 return <header className="pd-header fc-page-heading"><div><span className="pd-eyebrow">FRESHCAST</span><h1>{titles[view] || titles.decisions}</h1><p>{descriptions[view] || descriptions.decisions}</p></div><button type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true"/>{loading?'Refreshing…':'Refresh data'}</button></header>;
}

export function DecisionSteps({step, onChange, disabled = false}) {
 const list=useRef(null);
 useEffect(()=>{const row=list.current,button=row?.querySelector('[aria-current="step"]');if(row && button && row.scrollWidth>row.clientWidth)row.scrollLeft+=button.getBoundingClientRect().left-row.getBoundingClientRect().left-(row.clientWidth-button.offsetWidth)/2;},[step,disabled]);
  return <ol ref={list} className="fc-steps" aria-label="Decision journey">{decisionSteps.map((label, index) =>
    <li key={label}><button disabled={disabled} aria-current={!disabled && index === step ? 'step' : undefined} onClick={() => onChange?.(index)}><span>{index + 1}</span>{label}</button></li>,
  )}</ol>;
}

export function SourceSelector({value, onChange}) {
  return <label>Data source<select aria-label="Data source" value={value} onChange={event => onChange(event.target.value)}>
    <option value="local">My kitchen · orders &amp; stock</option>
    <option value="live">Genpact · external demand</option>
    {value==='demo' && <option value="demo">Sample data · no model run</option>}
  </select></label>;
}

export function SourceNotice({source, synthetic = false}) {
  const title = source === 'local' ? synthetic ? 'Kitchen demo scenario' : 'Your kitchen records'
    : source === 'live' ? 'Genpact model demo' : 'Sample-data demo · no model run';
  const detail = source === 'local' ? synthetic
    ? 'Includes generated history or fictional stock. Forecasts and costs are scenario estimates.'
    : 'Delivery-based demand, accepted recipes and dated stock. Check record coverage before acting.'
    : source === 'live' ? 'Model demand with simulated stock, recipes and costs. External meal IDs are not linked to your kitchen menu.'
    : 'Synthetic example data. No forecasting model is run in this mode.';
  return <div className={`pd-source ${source}`} role="status"><strong>{title}</strong><p>{detail}</p></div>;
}

export function BuildIdentity({source,onSourceChange}) {
  const [tutorial,setTutorial]=useState(false);
  const revision = typeof __FRESHCAST_REVISION__ === 'string' ? __FRESHCAST_REVISION__ : 'development';
  return <footer className="fc-build-identity"><details><summary>Demo &amp; technical tools</summary><p>FreshCast build <code>{revision}</code> · include this version when reporting a problem.</p>
    {onSourceChange && <><p>Sample data is a fixed example for a model-free walkthrough. It does not read kitchen records or replace a failed API request.</p><div className="fc-demo-tools"><button type="button" onClick={()=>onSourceChange(source==='demo'?'local':'demo')}>{source==='demo'?'Return to my kitchen':'Open sample-data demo'}</button><button type="button" aria-expanded={tutorial} onClick={()=>setTutorial(value=>!value)}>{tutorial?'Close rescue tutorial':'Open illustrative rescue tutorial'}</button></div>{tutorial && <RescueDemo/>}</>}
  </details></footer>;
}

export function ZeroWasteNotice({waste, carried = null, unit, windowLabel}) {
  if (waste !== 0) return null;
  return <p className="fc-zero-waste-note">No eligible stock is projected to expire unused {windowLabel || 'in this window'}.
    {carried > 0 && <> <strong>{stockQuantity(carried, unit)}</strong> remains in later-expiring stock.</>}
    {' '}This is a forecast estimate; it does not guarantee zero future waste.
  </p>;
}
