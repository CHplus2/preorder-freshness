import {invalidResponse} from './apiResponse.js';
const topics=['menu','preorder','delivery','payment','freshness','allergy','orders','review','contact'];
const money=value=>typeof value==='string'&&/^\d+(?:\.\d{1,2})?$/.test(value)&&Number.isFinite(Number(value));
export function helpCapabilities(data){
 if(!data||typeof data.ai_available!=='boolean'||!Array.isArray(data.languages)||data.languages.length!==3||new Set(data.languages).size!==3||data.languages.some(language=>!['en','ms','zh'].includes(language)))throw invalidResponse();
 return data;
}
export function helpAnswer(data){
 if(!data||typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>15000||!topics.includes(data.topic)||!['guided','ai','fallback'].includes(data.mode)||!['/orders','/menu','/contact'].includes(data.href)||!Array.isArray(data.menus)||data.menus.length>3)throw invalidResponse();
 const paths=new Set();
 for(const menu of data.menus){
  if(typeof menu?.name!=='string'||!menu.name.trim()||menu.name.length>200||!/^\/products\/[1-9]\d{0,14}$/.test(menu.href)||paths.has(menu.href)||!money(menu.price)||!money(menu.food_total)||!Number.isInteger(menu.portions)||menu.portions<1||menu.portions>1000||Math.round(Number(menu.price)*100)*menu.portions!==Math.round(Number(menu.food_total)*100))throw invalidResponse();
  paths.add(menu.href);
 }
 return data;
}
