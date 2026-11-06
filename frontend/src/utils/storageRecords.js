import {invalidResponse} from './apiResponse.js';
import {validDeliveryDate} from './preorderWindows.js';

export function storageRecords(data){
 const counts=['recorded_batches','assessed_batches','within_date_batches','unknown_batches','expired_batches','held_batches'];
 if(!data||counts.some(key=>!Number.isSafeInteger(data[key])||data[key]<0||data[key]>data.recorded_batches)
  ||!validDeliveryDate(data.as_of)||typeof data.method!=='string'||!data.method.trim()||data.method.length>1000)throw invalidResponse();
 const {recorded_batches:total,assessed_batches:assessed,unknown_batches:unknown,within_date_batches:within,held_batches:held,expired_batches:expired,average_remaining_percent:average}=data;
 // Held and past-date batches can overlap; neither is in the within-date count.
 const excluded=total-within-unknown;
 if(assessed+unknown!==total||excluded<Math.max(held,expired)||excluded>held+expired
  ||(assessed===0?average!==null:typeof average!=='number'||!Number.isFinite(average)||average<0||average>100))throw invalidResponse();
 return data;
}
