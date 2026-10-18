import {useState} from 'react';
import {downloadModelBytes,SOURCE_ZIP,BACKUP_WORKFLOW} from '../utils/modelBackup';

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
 return <section id="backups" className="settings-group"><h2>Backups & recovery</h2><p>Keep your website code and original Genpact model outside Vercel. Model downloads use your staff login and are checked before saving.</p><div className="admin-toolbar"><a className="text-link" href={SOURCE_ZIP}>Download website code from GitHub</a><button type="button" disabled={busy} onClick={download}>{busy?'Checking model download…':'Download Genpact model backup'}</button></div>{error && <p role="alert">{error}</p>}{checksum && <><p role="status">Verified download started. Save the archive in your backup location.</p><details><summary>Downloaded file checksum</summary><code style={{overflowWrap:'anywhere'}}>{checksum}</code></details></>}<p>The model archive contains Genpact data and simulated operations. Kitchen records require a separate private database backup.</p><a className="text-link" href={BACKUP_WORKFLOW} target="_blank" rel="noreferrer">Open GitHub model-backup workflow →</a></section>;
}
