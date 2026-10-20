import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import catalog from '../src/assets/menuPhotoCatalog.json' with {type:'json'};
import {variantWidths} from '../src/utils/menuPhotoSources.js';

const source=new URL('../public/menu-images/',import.meta.url);
const output=new URL('responsive/',source);
// Bound native processing on small developer/build machines.
sharp.concurrency(1);

export async function prepareMenuPhotos(destination=output) {
  await mkdir(destination,{recursive:true});
  let originalBytes=0,variantBytes=0,count=0;
  for (const [name,photo] of Object.entries(catalog)) {
    const bytes=await readFile(new URL(name,source));
    if (createHash('sha256').update(bytes).digest('hex')!==photo.sha256) {
      throw Error(`Photo source changed: ${name}. Review its credits and update the photo catalog before building.`);
    }
    const metadata=await sharp(bytes).metadata();
    const oriented=metadata.autoOrient??metadata;
    if (oriented.width!==photo.width || oriented.height!==photo.height) throw Error(`Incorrect photo dimensions: ${name}`);
    originalBytes+=bytes.length;
    for (const width of variantWidths(photo.width)) {
      // Default metadata stripping avoids copying EXIF/location information.
      const encoded=await sharp(bytes).autoOrient().resize({width,withoutEnlargement:true}).webp({quality:78}).toBuffer();
      await writeFile(new URL(`${name.slice(0,-4)}-${width}.webp`,destination),encoded);
      variantBytes+=encoded.length;count++;
    }
  }
  return {photos:Object.keys(catalog).length,count,originalBytes,variantBytes};
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--update-catalog')) {
    const next={};
    for (const name of (await readdir(source)).filter(name=>/^[a-z0-9-]+\.jpg$/.test(name)).sort()) {
      const bytes=await readFile(new URL(name,source)),metadata=await sharp(bytes).metadata();
      const oriented=metadata.autoOrient??metadata;
      next[name]={width:oriented.width,height:oriented.height,sha256:createHash('sha256').update(bytes).digest('hex')};
    }
    await writeFile(new URL('../src/assets/menuPhotoCatalog.json',import.meta.url),JSON.stringify(next,null,2)+'\n');
    console.log('Photo catalog updated. Review image rights and credits before committing.');
  } else {
    console.log('Responsive menu photos:',await prepareMenuPhotos());
  }
}
