import {useState} from 'react';
import {downloadModelBytes,SOURCE_ZIP,MODEL_RELEASE} from '../utils/modelBackup';

export default function BackupDownloads() {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[checksum,setChecksum]=useState('');
 const download=async()=>{
  if(busy)return;
  setBusy(true);setError('');setChecksum('');
  try {
   const result=await downloadModelBytes();
   const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/gzip'}));
   const link=document.createElement('a');link.href=url;link.download='freshcast-runtime-bundle.tar.gz';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);setChecksum(result.checksum);
  } catch(e){setError(e.message || 'Download failed. Check your connection and try again.');}
  finally{setBusy(false);}
 };
 return <details id="backups" className="settings-group" tabIndex={-1}><summary>Backups &amp; recovery</summary><p>Download a recovery copy of the website code or the original Genpact model. Model downloads are verified before saving.</p><div className="admin-toolbar"><a className="text-link" href={SOURCE_ZIP}>Download website code from GitHub</a><button type="button" disabled={busy} onClick={download}>{busy?'Checking model download…':'Download Genpact model backup'}</button></div>{error && <p role="alert">{error}</p>}{checksum && <><p role="status">Verified download started. Save the archive in your backup location.</p><details><summary>Downloaded file checksum</summary><code style={{overflowWrap:'anywhere'}}>{checksum}</code></details></>}<p>The model archive contains Genpact data and simulated operations. Kitchen records require a separate private database backup.</p><a className="text-link" href={MODEL_RELEASE} target="_blank" rel="noreferrer">View saved model on GitHub →</a></details>;
}
