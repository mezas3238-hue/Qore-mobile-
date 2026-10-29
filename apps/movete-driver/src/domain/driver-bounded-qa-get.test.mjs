import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverDocumentStatuses} from './driver-documents.mjs';
import {readDriverLicenseReadiness} from './driver-license-readiness.mjs';
const opts={apiOrigin:'http://127.0.0.1:4141',accessToken:'a'.repeat(60)};
const read=[readDriverDocumentStatuses,readDriverLicenseReadiness];
test('G168 both Driver KYC panels timeout even when fetch ignores AbortSignal',async()=>{
 for(const getter of read){
  let signal=null;
  const start=Date.now();
  await assert.rejects(getter({...opts,timeoutMs:100,
   request:(_url,init)=>{signal=init.signal;return new Promise(()=>{});}
  }),/unavailable/);
  assert.equal(signal.aborted,true);
  assert(Date.now()-start<3000);
 }
});
test('G168 both Driver KYC panels bound hanging JSON and reject oversized bodies',async()=>{
 for(const getter of read){
  let signal;
  await assert.rejects(getter({...opts,timeoutMs:100,
   request:async(_url,init)=>{signal=init.signal;return{
    status:200,json:()=>new Promise(()=>{})
   };}
  }),/unavailable/);
  assert.equal(signal.aborted,true);
  await assert.rejects(getter({...opts,request:async()=>({
   status:200,headers:{get:key=>key==='content-length'?'1000000':null},
   json:()=>{throw Error('must not read oversized body');}
  })}),/unavailable|too large/);
 }
});
