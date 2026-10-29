import {invalidResponse} from './apiResponse.js';
import {emailDelivery} from './emailDelivery.js';
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
 if(data.email_delivery!==undefined)emailDelivery(data.email_delivery);
 return data;
}
export function activitySummary(activity){
 const last=activity.recent_runs[0];
 if(!last)return {title:'No recent email checks',detail:'No checks recorded here in the last 24 hours. Review your sending schedule below.',stale:false};
 const titles={running:'Email check in progress',incomplete:'No result recorded',completed:'Last email check completed',send_failed:'Last check had sending errors',not_configured:'Email setup needs attention',worker_error:'Last email check stopped'};
 const details={running:'Refresh shortly for the result.',incomplete:'Some emails may have been accepted before the check stopped. Review the history before retrying.',completed:last.sent===0?'No email was attempted during this check.':`${last.sent} email${last.sent===1?'':'s'} accepted for sending. Inbox delivery is not confirmed.`,send_failed:`${last.failed} failed; ${last.sent} accepted for sending. Review your email settings.`,not_configured:'No email was attempted. Review your email settings below.',worker_error:'The check stopped unexpectedly. Some emails may already have been accepted; review the sending history.'};
 return {title:titles[last.outcome],detail:details[last.outcome],stale:Date.parse(activity.generated_at)-Date.parse(last.started_at)>activity.recent_threshold_minutes*60000};
}
export const workerTime=value=>value?new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})+' (Malaysia)':'Not recorded';
export const workerOutcome=value=>({running:'Started',incomplete:'No completion',completed:'Completed',send_failed:'Email failure',not_configured:'Setup unavailable',worker_error:'Processing error'})[value] || 'Unknown';
