import {deliveryDayIssue} from './deliveryDays.js';
import {validDeliveryDate} from './preorderWindows.js';
import {malaysiaInput} from './simpleDeliveryTime.js';

const dayMilliseconds=86400000;
export function basketDateIssue(cart,day,closing,now=Date.now()){
 if(!day)return '';
 if(!validDeliveryDate(day))return 'Choose a valid date.';
 const local=malaysiaInput(now),today=local.slice(0,10),last=malaysiaInput(now+90*dayMilliseconds).slice(0,10);
 if(day<today)return 'This date has passed. Choose an upcoming date.';
 if(day>last)return 'Choose a date within the next 90 days.';
 const offerIssue=deliveryDayIssue(cart,day,now);
 if(offerIssue)return offerIssue;
 return day===today&&local.slice(11)>=closing?'Today’s handover hours have ended. Choose another offered date.':'';
}

// These dates match menu weekdays, fixed dates and cutoffs, not stock availability.
export function upcomingBasketDates(cart,closing,now=Date.now(),limit=7){
 if(!cart?.length||deliveryDayIssue(cart,'',now))return [];
 const today=malaysiaInput(now).slice(0,10),start=Date.parse(today+'T12:00:00Z'),dates=[];
 for(let offset=0;offset<=90&&dates.length<limit;offset++){
  const day=new Date(start+offset*dayMilliseconds).toISOString().slice(0,10);
  if(!basketDateIssue(cart,day,closing,now))dates.push(day);
 }
 return dates;
}
