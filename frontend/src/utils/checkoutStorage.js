function storageError() {
 const error=new Error('Checkout storage is unavailable or damaged.');
 error.code='CHECKOUT_STORAGE';
 return error;
}
export function readCheckout(storage,key,fallback) {
 try { const raw=storage.getItem(key);return raw===null?fallback:JSON.parse(raw); }
 catch {throw storageError();}
}
export function checkoutAttempt(storage,key,newId) {
 const previous=readCheckout(storage,'checkoutAttempt',null);
 if(previous!==null && (typeof previous!=='object' || typeof previous.key!=='string' || typeof previous.id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(previous.id)))throw storageError();
 if(previous?.key===key)return previous;
 const attempt={key,id:newId()};
 try {storage.setItem('checkoutAttempt',JSON.stringify(attempt));}catch{throw storageError();}
 return attempt;
}
