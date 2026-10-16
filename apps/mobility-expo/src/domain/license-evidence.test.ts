import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLicenseImage} from './license-evidence.ts';
const jpg=Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(1500,1)]).toString('base64');
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(1500,2)]).toString('base64');
test('JPG conserva extensión y MIME correctos',()=>{
 const f=inspectLicenseImage(jpg);
 assert.equal(f.mimeType,'image/jpeg');assert.equal(f.extension,'jpg');assert.equal(f.bytes,1504);
});
test('PNG se conserva como PNG; no se finge JPEG',()=>{
 const f=inspectLicenseImage(png);
 assert.equal(f.mimeType,'image/png');assert.equal(f.extension,'png');assert.equal(f.bytes,1508);
});
test('rechaza fotos vacías, MIME no soportado y datos demasiado cortos',()=>{
 for(const s of ['', 'aGVsbG8=', Buffer.alloc(1500).toString('base64'), 'data:image/jpeg;base64,'+jpg])assert.throws(()=>inspectLicenseImage(s));
});
test('base64 adulterado o imagen demasiado grande falla cerrado',()=>{
 assert.throws(()=>inspectLicenseImage(jpg.slice(0,100)+'!'+jpg.slice(101)));
 assert.throws(()=>inspectLicenseImage('/9j/'+ 'A'.repeat(14_000_000)));
});
