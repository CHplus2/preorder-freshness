import {changeExpiryBasis} from './expiryEvidence.js';

export const storageNames={chilled:'Chilled',frozen:'Frozen',ambient:'Ambient'};
export function validStorageGuidance(rows){
 return Array.isArray(rows) && rows.length<=3 && new Set(rows.map(row=>row?.storage_type)).size===rows.length && rows.every(row=>
  row && typeof row==='object' && !Array.isArray(row) && Object.keys(row).length===4 &&
  Object.hasOwn(storageNames,row.storage_type) && Number.isInteger(row.shelf_life_days) && row.shelf_life_days>=1 && row.shelf_life_days<=3650 &&
  typeof row.source==='string' && row.source.trim().length>0 && row.source.length<=140 &&
  typeof row.conditions==='string' && row.conditions.trim().length>0 && row.conditions.length<=155);
}
export function matchingStorageGuidance(value,material){
 if(!material || Number(value.raw_material)!==material.id || !validStorageGuidance(material.storage_guidance || []))return null;
 return material.storage_guidance?.find(row=>row.storage_type===(value.storage_type || 'chilled')) || null;
}
export function applyStorageGuidance(value,material){
 const row=matchingStorageGuidance(value,material);
 if(!row)return null;
 return {...changeExpiryBasis(value,'storage'),shelf_life_days:row.shelf_life_days,guidance_note:`${row.source}; ${row.conditions}`};
}
export function changeBatchStorage(value,storageType){
 if((value.storage_type || 'chilled')===storageType)return {...value,storage_type:storageType};
 // A duration/source for the previous temperature is not guidance for the new
 // one. Keep earlier printed/handling limits and holds until reviewed.
 return {...value,storage_type:storageType,shelf_life_days:null,guidance_note:''};
}
export function changeBatchMaterial(value,materialId){
 if(Number(value.raw_material)===Number(materialId))return {...value,raw_material:materialId};
 return {...value,raw_material:materialId,expiry_basis:'label',expiry_date:'',original_expiry_date:null,
  manufactured_date:null,shelf_life_days:null,guidance_note:'',label_date_type:'not_recorded',
  opened_date:null,after_open_days:null,thawed_date:null,after_thaw_days:null,
  handling_history:'not_recorded',handling_note:''};
}
