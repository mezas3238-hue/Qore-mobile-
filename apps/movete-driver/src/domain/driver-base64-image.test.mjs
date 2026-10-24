import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePrivateImageBase64} from './driver-base64-image.mjs';
const jpeg=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,
 0,0,0,0,0,0,255,217]);
test('bounded temporary native camera image bytes are decoded exactly',()=>{
 const encoded=Buffer.from(jpeg).toString('base64');
 assert.deepEqual(decodePrivateImageBase64(encoded),jpeg);
 assert.equal(decodePrivateImageBase64(encoded).length,jpeg.length);
});
test('camera rejects truncated, forged, too-large or non-base64 images',()=>{
 for(const value of [
  'data:image/jpeg;base64,'+Buffer.from(jpeg).toString('base64'),
  'a'.repeat(12),'/'.repeat(32)+'=',
  'á'.repeat(32),'='.repeat(32),'A'.repeat(7000000),
  Buffer.from(jpeg).toString('base64').slice(0,-2),null
 ]){
  assert.throws(()=>decodePrivateImageBase64(value));
 }
 assert.throws(()=>decodePrivateImageBase64(Buffer.from(jpeg).toString('base64'),10));
});
