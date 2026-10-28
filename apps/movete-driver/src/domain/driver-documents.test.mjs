import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverDocumentStatuses,DRIVER_DOCUMENTS_LIVE_ENABLED}
 from './driver-documents.mjs';
const origin='http://127.0.0.1:4141',token='a'.repeat(60);
const now=Date.parse('2026-10-22T12:00:00Z');
const status={kind:'licencia',status:'pending',submittedAtMs:now,reviewedAtMs:null};
const response={mode:'STAGING_DEMO_ONLY',liveOperationsEnabled:false,
 documents:[status]};
function fake(data=response,statusCode=200){
 const seen={};
 const request=async(url,options)=>{
  seen.url=url;seen.options=options;return {status:statusCode,json:async()=>data};
 };
 return {seen,request};
}
const run=(change={})=>readDriverDocumentStatuses({
 apiOrigin:origin,accessToken:token,...change
});
test('Driver KYC status read requires localhost bearer and never enables LIVE',async()=>{
 assert.equal(DRIVER_DOCUMENTS_LIVE_ENABLED,false);
 const m=fake();
 const out=await run({request:m.request});
 assert.deepEqual(out,[status]);
 assert.ok(Object.isFrozen(out)&&Object.isFrozen(out[0]));
 assert.equal(m.seen.url,origin+'/v1/staging/driver/documents');
 assert.equal(m.seen.options.method,'GET');
 assert.equal(m.seen.options.credentials,'omit');
 assert.equal(m.seen.options.cache,'no-store');
 assert.equal(m.seen.options.headers.authorization,'Bearer '+token);
});
test('Driver KYC never sends to a remote host or includes another actor in body',async()=>{
 let count=0;
 const request=async()=>{count++;throw Error('MUST NOT CALL')};
 for(const apiOrigin of ['https://api.example','http://localhost:4141',
  'http://0.0.0.0:4141','http://127.0.0.1',
  'http://user:password@127.0.0.1:4141',
  'http://127.0.0.1:4141/api','http://127.0.0.1:4141/?driverId=someone']){
  await assert.rejects(()=>run({apiOrigin,request}));
 }
 await assert.rejects(()=>run({accessToken:'bad',request}));
 await assert.rejects(()=>run({accessToken:'',request}));
 assert.equal(count,0);
});
test('Driver KYC fails closed on credentials, network and invalid server state',async()=>{
 await assert.rejects(()=>run({request:fake(response,401).request}),/session expired/);
 await assert.rejects(()=>run({request:fake(response,403).request}),/role not authorized/);
 await assert.rejects(()=>run({request:fake(response,503).request}),/unavailable/);
 await assert.rejects(()=>run({request:async()=>{throw Error('private')}}),/unavailable/);
 for(const bad of [
  {...response,liveOperationsEnabled:true},
  {...response,documents:[status,status]},
  {...response,documents:[{...status,objectKey:'private'}]},
  {...response,documents:[{...status,kind:'admin'}]},
  {...response,documents:[{...status,status:'approved'}]},
  {...response,documents:[{...status,reviewedAtMs:1}]},
  {...response,documents:Array(8).fill(status)},
  {...response,documents:[{...status,submittedAtMs:'yesterday'}]},
  {...response,documents:null}
 ]){
  await assert.rejects(()=>run({request:fake(bad).request}));
 }
 const empty=await run({request:fake({...response,documents:[]}).request});
 assert.deepEqual(empty,[]);
});
test('Driver KYC response never includes storage metadata or administrator identity',async()=>{
 const out=await run({request:fake(response).request});
 const json=JSON.stringify(out);
 assert.doesNotMatch(json,/objectKey|bucket|sha256|reviewer|phone|image|raw/i);
});
