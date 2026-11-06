export const costUnits=unit=>unit==='g'?[{factor:1000,label:'kg'},{factor:1,label:'g'}]:unit==='ml'?[{factor:1000,label:'litre'},{factor:1,label:'ml'}]:[{factor:1,label:unit}];
export const displayUnitCost=(value,factor)=>value==null||value===''?'':String(Number((Number(value)*factor).toFixed(6)));
export function inventoryUnitCost(value,factor){
 if(String(value).trim()==='')return null;
 const number=Number(value);
 if(!Number.isFinite(number)||number<0||![1,1000].includes(factor))throw new Error('Enter a valid cost of zero or more.');
 const cost=(number/factor).toFixed(6);
 if(number>0&&Number(cost)===0)throw new Error('This price is too small to record accurately. Check the price and unit.');
 return cost;
}
