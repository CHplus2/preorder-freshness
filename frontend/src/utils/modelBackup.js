export const SOURCE_ZIP='https://github.com/CHplus2/preorder-freshness/archive/refs/heads/main.zip';
export const MODEL_RELEASE='https://github.com/CHplus2/preorder-freshness/releases/tag/freshcast-model-backup-v1';

const MAX_BYTES=40*1024*1024;

export async function downloadModelBytes(fetcher=globalThis.fetch,crypto=globalThis.crypto,{signal,timeoutMs=30000}={}) {
 const controller=new AbortController();
 const cancel=()=>controller.abort();
 if(signal?.aborted)throw new DOMException('Download cancelled.','AbortError');
 signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,timeoutMs);
 let reader;
 try {
 const response=await fetcher('/api/admin/predictive/model-backup/',{credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/gzip, application/json'}});
 if(!response.ok)throw new Error(response.status===403?'Sign in with a staff account to download the model.':response.status===503?'This deployment does not contain a verified model backup. Try the current production deployment.':'The model backup could not be downloaded. Try again.');
 const checksum=response.headers.get('X-Checksum-SHA256');
 if(!response.headers.get('Content-Type')?.includes('application/gzip') || !/^[a-f0-9]{64}$/.test(checksum || ''))throw new Error('The model download could not be verified. No file was saved.');
 const length=response.headers.get('Content-Length');
 if(length!==null && (!/^\d+$/.test(length) || Number(length)<1 || Number(length)>MAX_BYTES)){
  await response.body?.cancel();
  throw new Error('The model download has an invalid size. No file was saved.');
 }
 if(!response.body?.getReader)throw new Error('This browser cannot safely stream the model download. No file was saved.');
 reader=response.body.getReader();
 const chunks=[];let total=0;
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  total+=value.byteLength;
  if(total>MAX_BYTES){await reader.cancel();throw new Error('The model download has an invalid size. No file was saved.');}
  chunks.push(value);
 }
 if(!total)throw new Error('The model download has an invalid size. No file was saved.');
 if(controller.signal.aborted)throw new DOMException('Download cancelled.','AbortError');
 const buffer=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
 const bytes=buffer.buffer;
 if(!crypto?.subtle?.digest)throw new Error('This browser cannot verify the model download. No file was saved.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(actual!==checksum)throw new Error('The model checksum did not match. No file was saved.');
 if(controller.signal.aborted)throw new DOMException('Download cancelled.','AbortError');
 return {bytes,checksum};
 } catch(error){
  if(controller.signal.aborted)throw new Error(signal?.aborted?'Download cancelled.':'The model download timed out. Try again.',{cause:error});
  throw error;
 } finally {
  clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();
  if(reader){try{await reader.cancel()}catch{/* The network may already have closed. */}reader.releaseLock();}
 }
}
