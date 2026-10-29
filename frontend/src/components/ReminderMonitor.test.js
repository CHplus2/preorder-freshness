import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {reminderStatus,activitySummary,workerTime} from '../utils/reminderStatus.js';
const generated='2030-01-10T10:00:00+08:00';
const status={email_configured:false,customer_email_configured:true,scheduler_secret_configured:true,scheduler_activity_verified:false,customer_reminders_due:0,customer_dispatch_due:0,customer_time_updates_due:0,worker_activity:{generated_at:generated,retention_hours:24,recent_threshold_minutes:15,authenticated_runs_24h:0,recent_runs:[]}};
const row={started_at:'2030-01-10T09:59:00+08:00',completed_at:'2030-01-10T09:59:20+08:00',outcome:'completed',sent:0,failed:0};
const withRun=(changes={})=>({...status,worker_activity:{...status.worker_activity,authenticated_runs_24h:1,recent_runs:[{...row,...changes}]}});
assert.equal(reminderStatus(status).customer_reminders_due,0);assert.match(activitySummary(status.worker_activity).title,/No recent email checks/);
assert.match(activitySummary(withRun().worker_activity).detail,/No email was attempted/);assert.equal(activitySummary(withRun().worker_activity).stale,false);
const stale=withRun({started_at:'2030-01-10T09:00:00+08:00'});assert.equal(activitySummary(stale.worker_activity).stale,true);
assert.match(workerTime(generated),/Malaysia/);
for(const bad of [null,{}, {...status,customer_dispatch_due:-1},{...status,email_configured:'true'},{...withRun(),worker_activity:{...status.worker_activity,recent_runs:[row]}},withRun({outcome:'healthy'}),withRun({failed:1}),withRun({sent:4}),withRun({outcome:'running'}),withRun({completed_at:'bad'}),withRun({completed_at:'2030-01-10T08:00:00+08:00'})])assert.throws(()=>reminderStatus(bad),{code:'INVALID_RESPONSE'});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Monitor,ReminderEvidence}=await server.ssrLoadModule('/src/components/ReminderStatus.jsx');
 assert.match(renderToStaticMarkup(h(Monitor)),/Checking email status/);
 const render=data=>renderToStaticMarkup(h(ReminderEvidence,{status:reminderStatus(data)}));
 const quiet=render(withRun());assert.match(quiet,/<details class="reminder-settings-details"><summary>Email settings &amp; history<\/summary>/);assert.doesNotMatch(quiet,/REMINDER_CRON_SECRET|CRON_SECRET|Worker authentication|authenticated HTTP/);assert.match(quiet,/No email was attempted/);assert.match(quiet,/Includes manual checks/);assert.doesNotMatch(quiet,/scheduler is running|Scheduler healthy/);
 const ownerOnly=render({...withRun(),email_configured:true,customer_email_configured:false});assert.match(ownerOnly,/Customer updates/);assert.match(ownerOnly,/Customer updates are not configured/);
 const failure=render(withRun({outcome:'send_failed',sent:2,failed:1}));assert.match(failure,/1 failed; 2 accepted for sending/);assert.match(failure,/<div(?=[^>]*aria-label="Recent email check history")(?=[^>]*tabindex="0")/);
 const incomplete=render(withRun({outcome:'incomplete',completed_at:null,sent:null,failed:null}));assert.match(incomplete,/emails may have been accepted/);
 const blocked=render(withRun({outcome:'not_configured',sent:null,failed:null}));assert.match(blocked,/No email was attempted/);
 assert.match(render(stale),/last 15 minutes/);
 const backlog=render({...withRun(),customer_dispatch_due:10});assert.match(backlog,/need another check/);
 console.log('Reminder monitor: private bounded history, unknown vs zero, failed/incomplete/stale calls and non-sending refresh presentation passed.');
}finally{await server.close();}
