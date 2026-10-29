import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverVerifiedRating,validDriverClientRating}
 from './driver-verified-rating.mjs';
const service='15500000-0000-4155-8155-000000000001';
const key='15500000-0000-4155-8155-000000000002';
const driver='15500000-0000-4155-8155-000000000003';
const ratingId='15500000-0000-4155-8155-000000000004';
const body={requestKey:key,serviceKind:'AUTO_RIDE',serviceId:service,
 ratedKind:'CLIENT',stars:4,incidentCode:null};
const session={role:'driver',userId:driver,
 accessToken:'driver-verified-g155-test-token-abcdefghijklmnopqrstuvwxyz'};
const receipt={ratingId,serviceId:service,serviceKind:'AUTO_RIDE',
 ratedKind:'CLIENT',stars:4,requestKey:key,serverPersisted:true,
 qaOnly:true,productionEnabled:false,dispatchPriorityChanged:false,
 automatedSuspension:false};
const mk=(more={})=>createDriverVerifiedRating({
 enabled:true,ownerApproved:true,contractVerified:true,
 originalCompletionVerified:true,externalRuntimeVerified:true,
 providerRevocationVerified:true,apiOrigin:'https://qore-qa.onrender.com',
 pinnedOrigin:'https://qore-qa.onrender.com',
 getSession:async()=>session,
 request:async()=>new Response(JSON.stringify(receipt),{
  status:201,headers:{'content-type':'application/json'}}),...more
});
test('Driver can review only CLIENT of original ride or cargo UUID',()=>{
 assert.equal(validDriverClientRating(body),true);
 assert.equal(validDriverClientRating({...body,serviceKind:'DELIVERY_MOTO'}),true);
 for(const invalid of [
  {...body,ratedKind:'DRIVER'}, {...body,serviceKind:'COMMERCE'},
  {...body,stars:0}, {...body,stars:6},
  {...body,comment:'private statement'}, {...body,requestKey:'wrong'},
  {...body,incidentCode:'FALSE_CLAIM'}])
  assert.equal(validDriverClientRating(invalid),false);
});
test('external flags and HTTPS pinned host required before POST',async()=>{
 for(const change of [{enabled:false},{ownerApproved:false},
  {contractVerified:false},{originalCompletionVerified:false},
  {externalRuntimeVerified:false},{providerRevocationVerified:false},
  {apiOrigin:'http://qore-qa.onrender.com'},
  {pinnedOrigin:'https://different-qa.onrender.com'}]){
  const client=mk(change);
  assert.equal(client.isConfigured(),false);
  assert.equal((await client.submit(body)).code,'G155_EXTERNAL_CERTIFICATION_REQUIRED');
 }
});
test('sends one authenticated Driver POST and verifies exact G155 SQL receipt',async()=>{
 let calls=0;
 const client=mk({request:async(url,opts)=>{
  calls++;
  assert.equal(url,'https://qore-qa.onrender.com/v1/staging/reputation/ratings');
  assert.equal(opts.method,'POST');
  assert.equal(opts.headers.authorization,'Bearer '+session.accessToken);
  assert.deepEqual(JSON.parse(opts.body),body);
  return new Response(JSON.stringify(receipt),{status:201,
   headers:{'content-type':'application/json'}});
 }});
 assert.equal(client.isConfigured(),true);
 assert.deepEqual(await client.submit(body),{ok:true,ratingId,
  qaOnly:true,productionEnabled:false,dispatchPriorityChanged:false});
 assert.equal(calls,1);
});
test('rejects wrong driver identity, changed user, altered receipt, already rated',async()=>{
 assert.equal((await mk({getSession:async()=>({...session,role:'passenger'})})
  .submit(body)).code,'G155_DRIVER_AUTH_REQUIRED');
 let reads=0;
 assert.equal((await mk({getSession:async()=>++reads===1?session:
  {...session,userId:service}}).submit(body)).code,'G155_AUTH_CHANGED');
 assert.equal((await mk({request:async()=>new Response(JSON.stringify({
  ...receipt,ratedKind:'DRIVER'
 }),{status:201,headers:{'content-type':'application/json'}})})
  .submit(body)).code,'G155_INVALID_RECEIPT');
 assert.equal((await mk({request:async()=>new Response('{}',{status:409})})
  .submit(body)).code,'G155_UNVERIFIED_OR_ALREADY_RATED');
});
test('concurrent send locked; bad response never confirms result',async()=>{
 let resolve;
 const client=mk({request:()=>new Promise(r=>{resolve=r;})});
 const first=client.submit(body);
 await new Promise(r=>setImmediate(r));
 assert.equal((await client.submit(body)).code,'G155_BUSY');
 resolve(new Response('not json',{status:201,
  headers:{'content-type':'application/json'}}));
 assert.equal((await first).code,'G155_INVALID_RECEIPT');
});
