import axios from 'axios';
import {getCookie} from './cookieUtils';
import {rememberSuggestion} from './guideResponse';
export function recommendationEvent(session,event,product=null){
 if(!session)return Promise.resolve();
 try{return axios.post('/api/recommendation/events/',{session,event,product,request_id:crypto.randomUUID()},{timeout:10000,headers:{'X-CSRFToken':getCookie('csrftoken')}}).catch(()=>{});}catch{return Promise.resolve();}
}
export function selectRecommendation(session,product){
 rememberSuggestion('recommendationSession',session);
 void recommendationEvent(session,'click',product);
}
