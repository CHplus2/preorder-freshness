import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {prepareMenuPhotos} from './prepare-menu-photos.mjs';
import {menuPhotoSources,variantWidths} from '../src/utils/menuPhotoSources.js';
import catalog from '../src/assets/menuPhotoCatalog.json' with {type:'json'};

test('responsive photos decode at their declared width, retain aspect ratio and reduce bytes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'freshcast-photos-'));
  try {
    const summary=await prepareMenuPhotos(pathToFileURL(dir+'/'));
    assert.equal(summary.photos,17);
    assert.ok(summary.variantBytes<summary.originalBytes*.2);
    for (const [name,photo] of Object.entries(catalog)) {
      for (const width of variantWidths(photo.width)) {
        const bytes=await readFile(join(dir,`${name.slice(0,-4)}-${width}.webp`));
        const image=await sharp(bytes).metadata();
        assert.equal(image.format,'webp');assert.equal(image.width,width);
        assert.ok(Math.abs(image.height-width*photo.height/photo.width)<=1);
        assert.equal(image.exif,undefined);
      }
    }
    assert.equal((await readdir(dir)).length,summary.count);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('only known local/canonical photos get variants, with correct deployment base',()=>{
  for (const src of ['/static/menu-images/cookies.jpg','/menu-images/cookies.jpg',
      'https://preorder-freshness.vercel.app/static/menu-images/cookies.jpg',
      'https://fixture.test/static/menu-images/cookies.jpg']) {
    const photo=menuPhotoSources(src,'/','https://fixture.test');
    assert.equal(photo.width,479);
    assert.match(photo.srcSet,/\/menu-images\/responsive\/cookies-360.webp 360w/);
    assert.match(photo.srcSet,/cookies-479.webp 479w$/);
    assert.doesNotMatch(photo.srcSet,/720w|1200w/);
  }
  assert.match(menuPhotoSources('/static/menu-images/nasi-lemak.jpg','/static/').srcSet,/^\/static\/menu-images\/responsive\//);
  for (const src of [null,'https://%','https://other.test/static/menu-images/cookies.jpg',
      '//other.test/menu-images/cookies.jpg','/static/menu-images/cookies.jpg?custom=1',
      '/static/menu-images/cookies.jpg#original','/static/menu-images/../cookies.jpg',
      '/static/menu-images/unknown.jpg','javascript:alert(1)',
      'https://user:password@fixture.test/static/menu-images/cookies.jpg']) {
    assert.equal(menuPhotoSources(src,'/','https://fixture.test'),null,src);
  }
});
