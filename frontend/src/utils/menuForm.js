import {apiError} from './apiError.js';

export function menuFieldErrors(menu){
 const errors={};
 if(!String(menu.name || '').trim())errors.name='Enter a menu name.';
 else if([...menu.name].length>200)errors.name='Keep the menu name within 200 characters.';
 const raw=String(menu.price ?? '').trim(),price=Number(raw);
 if(!raw)errors.price='Enter a price.';
 else if(!Number.isFinite(price) || price<0.01)errors.price='Enter a price of at least RM 0.01.';
 else if(price>=100000000)errors.price='Enter a price below RM 100,000,000.';
 else if(Math.abs(price*100-Math.round(price*100))>0.000001)errors.price='Use no more than 2 decimal places.';
 if(!Number.isSafeInteger(Number(menu.category)) || Number(menu.category)<1)errors.category='Choose a category.';
 return errors;
}

export function menuSaveError(error){
 if(!error?.response || error.response.status>=500)return {fields:{},uncertain:true,message:'We could not confirm whether this menu was saved. Close this dialog and check the menu list before trying again. Your entries are still shown here.'};
 const data=error.response.data || {},fields={};
 const messages={name:'Enter a menu name of up to 200 characters.',price:'Enter a valid price of at least RM 0.01, with up to 2 decimal places.',category:'Choose an available category.',image_url:'Use a public image URL or upload a photo from your device.'};
 for(const key of Object.keys(messages))if(Object.hasOwn(data,key))fields[key]=messages[key];
 if(Object.keys(fields).length)return {fields,uncertain:false,message:'Check the highlighted fields.'};
 if(data.ingredients)return {fields:{},uncertain:false,message:'Review the recipe ingredients and quantities. Choose an ingredient and a positive quantity for each row.'};
 return {fields:{},uncertain:false,message:apiError(error,'These menu details could not be saved. Review them and try again.')};
}
