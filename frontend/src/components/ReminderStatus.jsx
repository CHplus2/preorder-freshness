import {useEffect,useState} from 'react';
import axios from 'axios';
export default function ReminderStatus(){
 const [status,setStatus]=useState(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();axios.get('/api/admin/reminder-status/',{signal:c.signal}).then(r=>setStatus(r.data)).catch(e=>{if(!axios.isCancel(e))setFailed(true)});return()=>c.abort()},[]);
 return <section className="settings-group"><h2>Email preparation reminders</h2>
 <p>{failed?'Unable to check email configuration.':!status?'Checking configuration...':status.email_configured?'SMTP and owner email are configured. Delivery has not been verified.':'Email is not configured yet.'}</p>
 <p>Reminders cover preparation and delivery due within 24 hours, including items overdue by up to 24 hours. Successful reminders are recorded to avoid routine duplicates.</p>
 <details><summary>Connect email and scheduling</summary><p>Set SMTP details, a verified sender, OWNER_NOTIFICATION_EMAIL and a random CRON_SECRET of at least 32 characters privately in your hosting environment. Do not put passwords in storefront settings.</p><p>Schedule a request every 15 minutes to /api/reminders/run/ with Authorization: Bearer followed by your secret. Each run sends up to 3 reminders; use a more frequent job for larger workloads. A scheduled worker can alternatively run manage.py send_order_reminders --send.</p><p>{status?.scheduler_secret_configured?'Scheduler secret is configured.':'Scheduler secret is not configured.'} An external scheduled job must still be set up; this page cannot confirm it is running.</p></details></section>
}
