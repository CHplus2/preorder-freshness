import {useState} from 'react';
import {menuPhotoSources} from '../utils/menuPhotoSources';

export default function MenuPhoto({src, sizes='100vw', onError, ...props}) {
  const [failedSource,setFailedSource]=useState(null);
  const photo=menuPhotoSources(src,import.meta.env.BASE_URL,globalThis.location?.origin);
  const optimized=photo && failedSource!==src;
  return <img decoding="async" referrerPolicy="no-referrer"
    width={photo?.width} height={photo?.height} {...props} src={src}
    srcSet={optimized?photo.srcSet:undefined} sizes={optimized?sizes:undefined}
    onError={event=>{
      // Missing variants or an unsupported format fall back to the original.
      // Only a failed original invokes the caller's existing empty-photo UI.
      if (optimized) setFailedSource(src);
      else onError?.(event);
    }}/>
}
