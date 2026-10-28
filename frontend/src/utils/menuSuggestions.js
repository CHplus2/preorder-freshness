import {validSellingDetails} from './sellingDetails.js';
import {invalidResponse} from './apiResponse.js';
export function menuSuggestions(data){
 if(!data || typeof data.session!=='string' || !data.session || !['history','popularity','menu'].includes(data.basis) || !Array.isArray(data.results) || data.results.length>3)throw invalidResponse();
 if(data.results.some(row=>!validSellingDetails(row?.selling_details) || !Number.isSafeInteger(row?.id) || row.id<1 || typeof row.name!=='string' || !row.name.trim() || typeof row.image_url!=='string' || !/^\d+(?:\.\d{1,2})?$/.test(String(row.price)) || !Array.isArray(row.reasons) || !row.reasons.length || row.reasons.some(reason=>typeof reason!=='string' || !reason.trim())) || new Set(data.results.map(row=>row.id)).size!==data.results.length)throw invalidResponse();
 return data;
}
export function openMenuFinder(){
 const finder=document.getElementById('menu-finder');
 if(finder){
  finder.open=true;
  const date=finder.querySelector('input[type="date"]');
  (date || finder).scrollIntoView({block:date?'center':'start'});
  date?.focus({preventScroll:true});
 }
}
