import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {emailDelivery,emailCheckResult,emailCheckReason} from '../utils/emailDelivery.js';
import {reminderStatus} from '../utils/reminderStatus.js';
const ready={transport_ready:true,sender_address:'sender@example.test',owner_recipient:'owner@example.test',test_available:true};
assert.deepEqual(emailDelivery(ready),ready);
for(const value of [null,{}, {...ready,owner_recipient:3},{...ready,sender_address:'sender@example.test\r\nBcc:x@y.test'},{...ready,owner_recipient:null},{...ready,test_available:'true'}])assert.throws(()=>emailDelivery(value));
const accepted={outcome:'accepted',reason:null,reference:'FCMAIL-123456abcdef',recipient:ready.owner_recipient,retry_after:300};
assert.deepEqual(emailCheckResult(accepted,ready.owner_recipient,202),accepted);
assert.equal(emailCheckResult({...accepted,outcome:'unconfirmed',reason:'unknown'},ready.owner_recipient,503).outcome,'unconfirmed');
for(const [value,status] of [[accepted,200],[{...accepted,recipient:'other@example.test'},202],[{...accepted,reference:'bad'},202],[{...accepted,retry_after:0},202],[{...accepted,reason:'unknown'},202],[{...accepted,outcome:'not_accepted',reason:'unknown'},503]])assert.throws(()=>emailCheckResult(value,ready.owner_recipient,status));
assert.match(emailCheckReason('authentication'),/sign-in failed/);assert.match(emailCheckReason('sender_rejected'),/sender address was rejected/);
const base={email_configured:true,customer_email_configured:true,scheduler_secret_configured:true,scheduler_activity_verified:false,customer_reminders_due:0,customer_dispatch_due:0,customer_time_updates_due:0,worker_activity:{generated_at:'2030-01-10T10:00:00Z',retention_hours:24,recent_threshold_minutes:15,authenticated_runs_24h:0,recent_runs:[]}};
reminderStatus({...base,email_delivery:ready});assert.throws(()=>reminderStatus({...base,email_delivery:{...ready,owner_recipient:12}}));
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Check}=await server.ssrLoadModule('/src/components/EmailDeliveryCheck.jsx');
 const html=renderToStaticMarkup(h(Check,{configuration:ready}));
 assert.match(html,/owner@example.test/);assert.match(html,/sender@example.test/);assert.match(html,/Send test email/);
 assert.match(html,/Sends one message to the address above/);assert.match(html,/Wait five minutes between tests/);assert.doesNotMatch(html,/OWNER_NOTIFICATION_EMAIL|DEFAULT_FROM_EMAIL|SMTP/);
 const unavailable=renderToStaticMarkup(h(Check,{configuration:{...ready,sender_address:null,test_available:false}}));
 assert.match(unavailable,/sender approved by your email provider/);assert.match(unavailable,/<button[^>]*disabled/);
 console.log('Email diagnostic UI: staff routing, explicit single test, result/reference verification, unavailable sender and separate worker meaning passed.');
}finally{await server.close();}
