import {timeLabel} from './fulfilment.js';
export const malaysiaInput=stamp=>new Date(stamp+8*3600000).toISOString().slice(0,16);
export function defaultDeliveryDay(closing,now=Date.now()){
 const local=malaysiaInput(now);
 return local.slice(11)>=closing?malaysiaInput(now+86400000).slice(0,10):local.slice(0,10);
}
export function simpleTimeIssue(day,clock,opening,closing,now=Date.now()){
 if(!day||!clock)return '';
 const stamp=Date.parse(day+'T'+clock+':00+08:00');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(clock)||!Number.isFinite(stamp)||malaysiaInput(stamp)!==day+'T'+clock)return 'Choose a valid date and time.';
 if(stamp<=now)return 'This time has passed. Choose a later time or another date.';
 if(stamp>now+90*86400000)return 'Choose a date and time within the next 90 days.';
 if(clock<opening||clock>closing)return `Choose a time between ${timeLabel(opening)} and ${timeLabel(closing)} (Malaysia time).`;
 return '';
}
