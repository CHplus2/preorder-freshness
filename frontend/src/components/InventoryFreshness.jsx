import {useEffect,useState} from 'react';
import axios from 'axios';
import {CalendarDays,Info,RefreshCw} from 'lucide-react';
import {storageRecords} from '../utils/storageRecords';
import {deliveryDateText} from '../utils/preorderWindows';
import './InventoryFreshness.css';

export default function InventoryFreshness(){
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!opened)return;
  const controller=new AbortController();
  axios.get('/api/inventory-freshness/',{signal:controller.signal,timeout:15000}).then(({data})=>{
   const records=storageRecords(data);if(!controller.signal.aborted)setData(records);
  }).catch(e=>{if(!controller.signal.aborted&&!axios.isCancel(e))setError(true)});
  return()=>controller.abort();
 },[opened,retry]);
 const reload=()=>{setError(false);setData(null);setRetry(value=>value+1)};
 return <details id="inventory-freshness" className="inventory-transparency storage-records" onToggle={event=>{if(event.target===event.currentTarget&&event.currentTarget.open)setOpened(true)}}>
  <summary>Ingredient storage records<span>Recorded dates and stock on hold</span></summary>
  {opened&&<div className="storage-records-body">
   <div className="storage-records-heading"><h2>What is recorded in storage?</h2><button className="storage-refresh" type="button" disabled={!data&&!error} onClick={reload}><RefreshCw size={15} aria-hidden="true"/>Refresh records</button></div>
   {error?<div className="storage-read-error" role="alert"><p>Storage records could not be loaded. Please try again.</p><button type="button" onClick={reload}>Try again</button></div>:!data?<p role="status">Loading storage records…</p>:<>
    <p className="storage-snapshot"><CalendarDays size={16} aria-hidden="true"/><span>{data.recorded_batches} received {data.recorded_batches===1?'batch':'batches'} · {deliveryDateText(data.as_of)} · Malaysia</span></p>
    <p className="storage-intro">These counts cover non-empty ingredient batches recorded by the kitchen. They do not identify the ingredients used in your meal.</p>
    {data.recorded_batches>0?<dl className="storage-counts">{[
     ['Within recorded dates',data.within_date_batches,'Not on hold'],
     ['Past recorded date',data.expired_batches,'Excluded from cooking stock'],
     ['On hold',data.held_batches,'Excluded from cooking stock'],
     ['Needs date review',data.unknown_batches,'Shelf-life evidence incomplete']
    ].map(([label,count,hint])=><div key={label}><dt>{label}</dt><dd>{count}</dd><small>{hint}</small></div>)}</dl>:<p className="storage-empty">No received ingredient batches with stock are recorded.</p>}
    <p className="storage-count-note">Held and past-date counts can overlap.</p>
    <p className="storage-safety-note"><Info size={17} aria-hidden="true"/><span>Dates are a planning guide, not a food-safety check. Storage conditions and owner updates matter.</span></p>
    <details className="storage-explanation"><summary>How to read these records</summary><p>A batch is one recorded lot of an ingredient, such as a delivery of chicken. Past-date and held batches are excluded from cooking stock. Future orders may use newly purchased ingredients.</p><p>Records depend on the dates, storage conditions and handling history entered by the kitchen. Dates alone cannot confirm physical freshness or food safety.</p></details>
    <details className="storage-average"><summary>Date-based shelf-life average</summary><p className="storage-average-value"><strong>{data.average_remaining_percent===null?'Not available':data.average_remaining_percent+'%'}</strong><span>average recorded shelf-life remaining</span></p><p>This describes the proportion of recorded storage windows left. It is not a percentage of how fresh or safe the food is.</p><p>{data.assessed_batches} of {data.recorded_batches} batches included. Unknown date records are excluded.</p><p className="storage-average-method">{data.method}</p></details>
   </>}
  </div>}
 </details>;
}
