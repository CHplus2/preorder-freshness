import {useEffect,useState} from 'react';
import axios from 'axios';
export default function ReminderStatus(){
 const [status,setStatus]=useState(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();axios.get('/api/admin/reminder-status/',{signal:c.signal}).then(r=>setStatus(r.data)).catch(e=>{if(!axios.isCancel(e))setFailed(true)});return()=>c.abort()},[]);
 return <section className="settings-group"><h2>Order email reminders</h2>
 <p role="status">{failed?'Unable to check reminder settings. Reload this page to retry.':!status?'Checking reminder settings…':!status.email_configured?'Email reminders need setup. Ask your site administrator to connect the owner email.':!status.scheduler_secret_configured?'Owner email is configured. Scheduled reminders still need setup by your site administrator.':'Reminder settings are configured. Check your inbox and scheduler history to confirm recent delivery.'}</p>
 <p>Reminders go to the owner when preparation or requested delivery is within 24 hours. They also cover events overdue by up to 24 hours.</p>
 <details><summary>When will I receive an email?</summary><p>The scheduler checks for due reminders; it does not send an email on every check. Each run attempts up to three messages. An order can have one preparation reminder and one delivery reminder.</p><p>Preparation reminders apply while an order is pending. Cancelled and delivered orders are excluded. Requests awaiting kitchen confirmation can receive a requested-delivery reminder even when preparation has not been scheduled.</p><p>Successful sends are recorded to avoid routine duplicates. Changing an order’s times does not reset a reminder already sent. These settings do not monitor scheduler activity or prove that a message reached your inbox.</p></details></section>
}
