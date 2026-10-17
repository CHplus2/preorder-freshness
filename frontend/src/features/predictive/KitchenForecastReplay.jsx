import {useState} from 'react';
const labels={mean_28:'28-day moving average',mean_7:'7-day moving average',same_weekday:'Same-weekday baseline'};
export default function KitchenForecastReplay({menus}){
  const candidates=menus.filter(m=>m.evaluation);
  const [selected,setSelected]=useState(''),[method,setMethod]=useState('selected');
  const menu=candidates.find(m=>String(m.product_id)===selected)||candidates[0];
  const chosen=method==='selected'?menu?.method:method;
  const score=menu?.evaluation.test[chosen];
  const actual=score?.daily_actual||[],predictions=score?.daily_predictions||[];
  const max=Math.max(1,...actual,...predictions),points=values=>values.map((value,i)=>`${36+i*424/Math.max(1,values.length-1)},${142-value/max*116}`).join(' ');
  return <details className="pd-card"><summary>Baseline comparison & held-out forecast replay</summary>
    {menus.some(m=>m.synthetic_history_items>0) && <p><strong>Synthetic-data evaluation.</strong> This replay includes generated history. Numerical test scores do not establish future accuracy on real customers.</p>}
    {!menu?<p>At least 42 completed daily observations are needed for separate training, validation and test periods. Until then the baseline is labelled limited, without an accuracy claim.</p>:<>
      <label>Menu to replay<select value={String(menu.product_id)} onChange={e=>setSelected(e.target.value)}>{candidates.map(m=><option key={m.product_id} value={m.product_id}>{m.product_name}</option>)}</select></label>
      <div className="fc-comparison-switch" role="group" aria-label="Replay baseline">{[['selected','Selected method'],...Object.entries(labels)].map(([id,label])=><button key={id} aria-pressed={method===id} onClick={()=>setMethod(id)}>{label}</button>)}</div>
      <p>{labels[chosen]} · test {menu.evaluation.test_start}–{menu.evaluation.test_end}. MAE {score.mae} portions/day; WAPE {score.wape_percent===null?'undefined because actual volume is zero':`${score.wape_percent}%`}.</p>
      {actual.length>0&&<figure><svg viewBox="0 0 480 175" role="img" aria-label="Held-out actual portions in green and one-day-ahead predictions in orange" style={{width:'100%',maxWidth:720}}>
        <path d="M36 22V142H462" fill="none" stroke="#b5bdad"/><text x="0" y="28" fontSize="11">{max.toFixed(0)}</text><text x="18" y="145" fontSize="11">0</text>
        <polyline points={points(actual)} fill="none" stroke="#285a3e" strokeWidth="3"/><polyline points={points(predictions)} fill="none" stroke="#b66a28" strokeWidth="3" strokeDasharray="5 3"/>
        <text x="36" y="164" fontSize="11">First test day</text><text x="388" y="164" fontSize="11">Last test day</text>
      </svg><figcaption>Green: recorded paid delivered portions. Dashed orange: forecast using earlier days only. Historical replay is not proof of future accuracy.</figcaption></figure>}
      <div className="pd-table-wrap"><table><caption>All candidate baselines on the same untouched test days</caption><thead><tr><th>Method</th><th>Test MAE/day</th><th>Test WAPE</th></tr></thead><tbody>{Object.entries(menu.evaluation.test).map(([id,s])=><tr key={id}><th>{labels[id]}</th><td>{s.mae}</td><td>{s.wape_percent===null?'Undefined':`${s.wape_percent}%`}</td></tr>)}</tbody></table></div>
      <p>{menu.evaluation.train_days} training days · {menu.evaluation.validation_days} validation days · {menu.evaluation.test_days} test days. Method selection uses validation only. Rolling test predictions use actual earlier observations; future multi-day projections use previous predictions.</p>
    </>}
  </details>;
}
