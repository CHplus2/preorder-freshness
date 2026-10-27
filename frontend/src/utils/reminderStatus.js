import {invalidResponse} from './apiResponse.js';
const stamp=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
const count=value=>Number.isSafeInteger(value) && value>=0;
const outcomes=['running','incomplete','completed','send_failed','not_configured','worker_error'];
export function reminderStatus(data){
 if(!data || ['email_configured','customer_email_configured','scheduler_secret_configured','scheduler_activity_verified'].some(k=>typeof data[k]!=='boolean') || ['customer_reminders_due','customer_dispatch_due','customer_time_updates_due'].some(k=>!count(data[k])))throw invalidResponse();
 const activity=data.worker_activity;
 if(!activity || !stamp(activity.generated_at) || activity.retention_hours!==24 || activity.recent_threshold_minutes!==15 || !count(activity.authenticated_runs_24h) || !Array.isArray(activity.recent_runs) || activity.recent_runs.length>10 || activity.recent_runs.length>activity.authenticated_runs_24h)throw invalidResponse();
 if(activity.recent_runs.some((run,index)=>!stamp(run?.started_at) || !outcomes.includes(run.outcome)
  || (index && Date.parse(run.started_at)>Date.parse(activity.recent_runs[index-1].started_at))
  || (['running','incomplete'].includes(run.outcome)?run.completed_at!==null || run.sent!==null || run.failed!==null:
   !stamp(run.completed_at) || Date.parse(run.completed_at)<Date.parse(run.started_at)
    || (['completed','send_failed'].includes(run.outcome)?!count(run.sent) || !count(run.failed) || run.sent+run.failed>3 || (run.outcome==='completed' && run.failed!==0) || (run.outcome==='send_failed' && run.failed<1):run.sent!==null || run.failed!==null))))throw invalidResponse();
 return data;
}
export function activitySummary(activity){
 const last=activity.recent_runs[0];
 if(!last)return {title:'No authenticated run observed',detail:'No worker call is recorded in the retained 24-hour history. Check your scheduler’s execution history; email configuration alone does not establish that it is running.',stale:false};
 const titles={running:'Worker call started',incomplete:'No completion recorded',completed:'Last worker call completed',send_failed:'Last worker call had email failures',not_configured:'Last worker call found email setup unavailable',worker_error:'Last worker call could not complete'};
 const details={running:'Refresh shortly for its result.',incomplete:'It started more than two minutes before this check. Emails may have been accepted before execution stopped; review records before retrying.',completed:last.sent===0?'No email was attempted in this call. Check the queue and recent runs; zero does not prove that no reminders are waiting.':`${last.sent} email${last.sent===1?'':'s'} accepted by the provider. This does not prove inbox receipt.`,send_failed:`${last.failed} attempt${last.failed===1?'':'s'} failed; ${last.sent} accepted. Review email configuration and the next run.`,not_configured:'The request reached the server, but sending was not configured. No worker email was attempted.',worker_error:'Processing stopped unexpectedly. Some emails may already have been accepted. Check private server logs and the next run.'};
 return {title:titles[last.outcome],detail:details[last.outcome],stale:Date.parse(activity.generated_at)-Date.parse(last.started_at)>activity.recent_threshold_minutes*60000};
}
export const workerTime=value=>value?new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})+' (Malaysia)':'Not recorded';
export const workerOutcome=value=>({running:'Started',incomplete:'No completion',completed:'Completed',send_failed:'Email failure',not_configured:'Setup unavailable',worker_error:'Processing error'})[value] || 'Unknown';
