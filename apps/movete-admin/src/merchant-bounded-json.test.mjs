import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedMerchantJson as read} from './merchant-bounded-json.mjs';
const json={merchantId:'15600000-0000-4156-8156-000000000001',orders:[]};
const payload=new TextEncoder().encode(JSON.stringify(json));
const headers={get:()=>null};
test('G172 parses bounded streamed original merchant inbox, without trusting Content-Length',async()=>{
 let reads=0;
 const response={headers,body:{getReader:()=>({
  read:async()=>++reads===1?{done:false,value:payload.subarray(0,17)}:
   reads===2?{done:false,value:payload.subarray(17)}:{done:true},
  cancel:()=>{throw Error('Reader already ended');}
 })},text:()=>{throw Error('Stream must not use unbounded text');}};
 const result=await read(response,4096,new AbortController().signal);
 assert.deepEqual(result,json);
 assert.equal(reads,3);
});
test('G172 blocks oversized actual stream BEFORE JSON parsing, never waiting on cancel',async()=>{
 let cancelCalls=0,reads=0;
 const response={headers,body:{getReader:()=>({
  read:async()=>{reads++;return {done:false,value:new Uint8Array(1024)};},
  cancel:()=>{cancelCalls++;return new Promise(()=>{});}
 })}};
 await assert.rejects(()=>read(response,512,new AbortController().signal),/extensa/);
 assert.equal(reads,1);
 assert.equal(cancelCalls,1);
});
test('G172 aborts stalled reader even if broken fetch ignores AbortSignal',async()=>{
 const controller=new AbortController();
 let cancelCalls=0;
 const response={headers,body:{getReader:()=>({
  read:()=>new Promise(()=>{}),
  cancel:()=>{cancelCalls++;return new Promise(()=>{});}
 })}};
 const promise=read(response,4096,controller.signal);
 controller.abort();
 await assert.rejects(promise,/Tiempo de lectura agotado/);
 assert.equal(cancelCalls,1);
});
test('G172 prevents advertised oversized body without consuming it',async()=>{
 let consumes=0;
 const response={headers:{get:k=>k==='content-length'?'99999999':null},
  text:()=>{consumes++;return Promise.resolve('{}');}};
 await assert.rejects(()=>read(response,1024,new AbortController().signal),/extensa/);
 assert.equal(consumes,0);
});
test('G172 fallback without stream is abortable and enforces UTF-8 bytes',async()=>{
 const waiting={headers,text:()=>new Promise(()=>{})};
 const controller=new AbortController();
 const unresolved=read(waiting,4096,controller.signal);
 controller.abort();
 await assert.rejects(unresolved,/Tiempo de lectura agotado/);
 const overflow={headers,text:async()=>JSON.stringify({x:'á'.repeat(400)})};
 await assert.rejects(()=>read(overflow,512,new AbortController().signal),/extensa/);
});
test('G172 never accepts malformed receipt, rejected stream, or missing abort authority',async()=>{
 const invalid={headers,text:async()=>'{bad json'};
 await assert.rejects(()=>read(invalid,4096,new AbortController().signal));
 await assert.rejects(()=>read(invalid,4096,null),/authority/);
});
