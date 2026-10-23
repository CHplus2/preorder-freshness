import {isAddress} from 'ethers';
const storageKey='dapur-kita-escrow-references-v1';
const reference=value=>typeof value==='string' && /^0x[0-9a-f]{64}$/i.test(value);
function valid(row){
 return row && isAddress(row.contract) && reference(row.id) && reference(row.hash)
  && ['pending','confirmed','failed'].includes(row.status);
}
const publicRecord=row=>({contract:row.contract,id:row.id,hash:row.hash,status:row.status});
export function savedEscrows(storage){
 try{
  const rows=JSON.parse(storage.getItem(storageKey) || '[]');
  return Array.isArray(rows)?rows.filter(valid).slice(0,10).map(publicRecord):[];
 }catch{return [];}
}
export function saveEscrow(row,storage){
 if(!valid(row))return false;
 try{
  const rows=savedEscrows(storage).filter(previous=>previous.contract.toLowerCase()!==row.contract.toLowerCase() || previous.id!==row.id);
  storage.setItem(storageKey,JSON.stringify([publicRecord(row),...rows].slice(0,10)));return true;
 }catch{return false;}
}
