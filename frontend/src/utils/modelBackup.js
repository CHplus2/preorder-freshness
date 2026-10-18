export const SOURCE_ZIP='https://github.com/CHplus2/preorder-freshness/archive/refs/heads/main.zip';
export const BACKUP_WORKFLOW='https://github.com/CHplus2/preorder-freshness/actions/workflows/backup-original-genpact.yml';

export async function downloadModelBytes(fetcher=globalThis.fetch,crypto=globalThis.crypto) {
 const response=await fetcher('/api/admin/predictive/model-backup/',{credentials:'same-origin',headers:{Accept:'application/gzip, application/json'}});
 if(!response.ok)throw new Error(response.status===403?'Sign in with a staff account to download the model.':response.status===503?'This deployment does not contain a verified model backup. Try the current production deployment.':'The model backup could not be downloaded. Try again.');
 const checksum=response.headers.get('X-Checksum-SHA256');
 if(!response.headers.get('Content-Type')?.includes('application/gzip') || !/^[a-f0-9]{64}$/.test(checksum || ''))throw new Error('The model download could not be verified. No file was saved.');
 const bytes=await response.arrayBuffer();
 if(!bytes.byteLength || bytes.byteLength>40*1024*1024)throw new Error('The model download has an invalid size. No file was saved.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(actual!==checksum)throw new Error('The model checksum did not match. No file was saved.');
 return {bytes,checksum};
}
