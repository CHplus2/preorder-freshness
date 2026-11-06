export function contactPhone(value){
 const text=String(value??'').trim();
 if(!text)return {number:'',error:'Enter your full phone number.'};
 if(!/^\+?[0-9 ()-]+$/.test(text))return {number:'',error:'Use digits, spaces or hyphens, with an optional country code.'};
 let digits=text.replace(/\D/g,'');
 if(!text.startsWith('+')&&digits.startsWith('0'))digits='60'+digits.slice(1);
 else if(!text.startsWith('+')&&!digits.startsWith('60'))return {number:'',error:'Include the country code, for example +60 11 1234 5678.'};
 if(digits.length<8)return {number:'',error:'Enter the full number, not only a prefix such as 011 (for example, 011 1234 5678).'};
 if(digits.length>15||digits.startsWith('0'))return {number:'',error:'Enter a valid full phone number, for example +60 11 1234 5678.'};
 return {number:'+'+digits,error:''};
}
