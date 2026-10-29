import {useEffect,useState} from 'react';
import axios from 'axios';
import EmailDeliveryCheck from './EmailDeliveryCheck';
import {reminderStatus,activitySummary,workerTime,workerOutcome} from '../utils/reminderStatus';

export default function ReminderStatus(){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();axios.get('/api/admin/reminder-status/',{signal:c.signal,timeout:15000}).then(({data})=>setStatus(reminderStatus(data))).catch(e=>{if(!axios.isCancel(e))setError('Email status could not be checked. Try refreshing.');});return()=>c.abort()},[revision]);
 return <section className="settings-group reminder-monitor" id="reminders" tabIndex={-1} aria-labelledby="reminder-monitor-title">
  <div className="reminder-monitor-heading"><h2 id="reminder-monitor-title">Order email reminders</h2><button type="button" disabled={!status && !error} onClick={()=>{setStatus(null);setError('');setRevision(v=>v+1);}}>Refresh status</button></div>
  <p>Reminders for your kitchen, and order updates for customers who choose them at checkout.</p>
  {error?<p role="alert" className="admin-notice error">{error}</p>:!status?<p role="status">Checking email status…</p>:<ReminderEvidence status={status}/>}
  <p className="reminder-status-timestamp">Refreshing status does not send email.</p>
 </section>;
}

export function ReminderEvidence({status}){
 const activity=status.worker_activity,summary=activitySummary(activity),last=activity.recent_runs[0];
 return <>
  <dl className="reminder-readiness"><div><dt>Kitchen reminders</dt><dd>{status.email_configured?'Email setup ready':'Setup needed'}</dd></div><div><dt>Customer updates</dt><dd>{status.customer_email_configured?'Email setup ready':'Setup needed'}</dd></div></dl>
  {status.email_configured && !status.customer_email_configured && <p>Customer updates are not configured yet.</p>}
  {!status.scheduler_secret_configured && <p className="reminder-run-stale">Automatic sending needs setup. See Email settings &amp; history below.</p>}
  <div className="reminder-run-summary"><h3>{summary.title}</h3><p>{summary.detail}</p>
   {last && <p className="reminder-status-timestamp">{workerTime(last.completed_at || last.started_at)}</p>}
   {summary.stale && <p className="reminder-run-stale">No check recorded in the last {activity.recent_threshold_minutes} minutes. Review your sending schedule below.</p>}
  </div>
  <h3 className="reminder-queue-heading">Customer updates waiting</h3>
  <div className="reminder-queue-grid"><div><strong>{status.customer_reminders_due}</strong><span>Before arrival</span></div><div><strong>{status.customer_dispatch_due}</strong><span>On dispatch</span></div><div><strong>{status.customer_time_updates_due}</strong><span>Time changes</span></div></div>
  {status.customer_reminders_due+status.customer_dispatch_due+status.customer_time_updates_due>3 && <p>Some updates will need another check. Review the sending schedule if the queue keeps growing.</p>}
  <p className="reminder-status-timestamp">Checked {workerTime(activity.generated_at)}. Counts show eligible customer messages at this check.</p>
  <details className="reminder-settings-details"><summary>Email settings &amp; history</summary>
   {status.email_delivery && <EmailDeliveryCheck key={`${status.email_delivery.sender_address}|${status.email_delivery.owner_recipient}`} configuration={status.email_delivery}/>}
   <h3>Automatic sending</h3>
   <p>{status.scheduler_secret_configured?'The sending connection is configured.':'The sending connection needs setup.'} Check that one automatic schedule is enabled; these recorded checks can include manual runs.</p>
   <p><a href="https://github.com/CHplus2/preorder-freshness/actions/workflows/delivery-reminders.yml" target="_blank" rel="noopener noreferrer">View sending schedule in GitHub</a></p>
   <p>Check about every five minutes. GitHub schedules can be delayed; this page cannot verify that the schedule is enabled or that emails reached an inbox.</p>
   <p><a href="https://github.com/CHplus2/preorder-freshness/blob/main/docs/customer-delivery-batches.md" target="_blank" rel="noopener noreferrer">Email setup guide</a></p>
   <h3>Recent email checks</h3>
   <p>{activity.authenticated_runs_24h} checks recorded here in 24 hours. Includes manual checks; command-line sends are separate.</p>
   {activity.recent_runs.length>0?<div className="admin-table-scroll" role="region" aria-label="Recent email check history" tabIndex={0}><table><caption>Latest 10 checks in 24 hours. Accepted means the email provider accepted the message for sending.</caption><thead><tr><th scope="col">Started (Malaysia)</th><th scope="col">Result</th><th scope="col">Accepted</th><th scope="col">Failed</th></tr></thead><tbody>{activity.recent_runs.map((run,index)=><tr key={index}><td>{workerTime(run.started_at)}</td><td>{workerOutcome(run.outcome)}</td><td>{run.sent ?? '—'}</td><td>{run.failed ?? '—'}</td></tr>)}</tbody></table></div>:<p>No checks recorded here in the last 24 hours.</p>}
   <h3>When reminders are sent</h3>
   <p>Your reminders cover preparation and requested deliveries within 24 hours, including overdue events by up to a day. Customers who opt in can receive a reminder within two hours before a confirmed delivery or collection time.</p>
   <p>Dispatch and time-change updates are separate customer choices. Each check attempts up to three emails across kitchen and customer reminders. A recorded acceptance prevents routine repeat messages, but does not confirm inbox delivery.</p>
   <p>Closed orders and changed customer email addresses are excluded. If a check stops before recording its result, an email may be repeated on retry.</p>
  </details>
 </>;
}
