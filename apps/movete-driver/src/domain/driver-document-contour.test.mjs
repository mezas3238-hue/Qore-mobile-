import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDriverDocumentContour} from './driver-document-contour.mjs';
test('No contour for blank, short, noisy or fabricated-only geometry',()=>{
 assert.equal(detectDriverDocumentContour({width:80,height:80,luma:new Uint8Array(6400).fill(120)}),null);
 assert.equal(detectDriverDocumentContour({width:5,height:5,luma:new Uint8Array(25)}),null);
 assert.equal(detectDriverDocumentContour({width:80,height:80,luma:new Uint8Array(5)}),null);
});
test('Detects actual opposite edges of a rectangular document in image pixels',()=>{
 const width=160,height=120,luma=new Uint8Array(width*height).fill(65);
 for(let y=22;y<98;y++)for(let x=15;x<145;x++)luma[y*width+x]=175;
 const r=detectDriverDocumentContour({width,height,luma});
 assert(r!==null);
 assert(r.confidence>=.9);
 assert(Math.abs(r.x-.09)<.04);
 assert(Math.abs(r.y-.18)<.05);
 assert(r.width>.7);
 assert(r.height>.55);
});
test('Refuses one visible edge; cannot hallucinate full document outline',()=>{
 const width=160,height=120,luma=new Uint8Array(width*height).fill(65);
 for(let y=0;y<height;y++)for(let x=15;x<width;x++)luma[y*width+x]=175;
 assert.equal(detectDriverDocumentContour({width,height,luma}),null);
});
