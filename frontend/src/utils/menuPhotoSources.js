import catalog from '../assets/menuPhotoCatalog.json' with {type:'json'};

export const PHOTO_WIDTHS = [360, 720, 1200];
export function variantWidths(width) {
  return [...new Set(PHOTO_WIDTHS.map(value=>Math.min(value,width)))];
}

// Only this project's bundled photos are optimized. Never turn an arbitrary
// external URL or a URL carrying query/fragment parameters into a local photo.
export function menuPhotoSources(src, base='/', origin) {
  if (typeof src!=='string') return null;
  let path=src;
  if (/^https?:\/\//i.test(src)) {
    let url;
    try {url=new URL(src);} catch {return null;}
    if (url.username || url.password || url.search || url.hash ||
        ![origin,'https://preorder-freshness.vercel.app'].includes(url.origin)) return null;
    path=url.pathname;
  }
  const prefix=[`${base}menu-images/`,'/static/menu-images/'].find(value=>path.startsWith(value));
  if (!prefix) return null;
  const name=path.slice(prefix.length);
  if (!Object.hasOwn(catalog,name)) return null;
  const photo=catalog[name];
  return {
    width:photo.width, height:photo.height,
    srcSet:variantWidths(photo.width).map(width=>`${base}menu-images/responsive/${name.slice(0,-4)}-${width}.webp ${width}w`).join(', '),
  };
}
