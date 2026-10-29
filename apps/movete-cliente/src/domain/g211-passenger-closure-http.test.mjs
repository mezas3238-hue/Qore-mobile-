import test from 'node:test';
import assert from 'node:assert/strict';
import {createG198PassengerLostItemsHttp} from './g198-lost-items-http.mjs';
import {createG200PassengerMotoLostItemsHttp} from './g200-moto-lost-items-http.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const trip='22222222-2222-4222-8222-222222222222';
const caseId='33333333-3333-4333-8333-333333333333';
const token='a_valid_g211_staging_token_for_qa_only_12345';
const host='https://qore-stage.onrender.com';
const factories=[
 ['AUTO',createG198PassengerLostItemsHttp,'/v1/staging/lost-items/'],
 ['MOTO',createG200PassengerMotoLostItemsHttp,'/v1/staging/moto/lost-items/']
];
const scope={tripId:trip,caseId,expectedSubject:actor,
 expectedPrivateViewRevision:4};
for(const [kind,factory,path] of factories){
 function setup({state='CLOSED',sessionChanged=false}={}){
  const calls=[];let n=0;
  const getSession=async()=>{
   n++;
   return {role:'passenger',subject:actor,
    token:sessionChanged&&n>1?token+'_altered':token,
    privateViewRevision:4,expiresAt:Date.now()+60000};
  };
  const request=async(url,params)=>{
   calls.push({url,params});
   return new Response(JSON.stringify({
    mode:'STAGING_DEMO_ONLY',caseId,state,qaOnly:true,
    productionEnabled:false
   }),{status:200,headers:{'content-type':'application/json'}});
  };
  return {gateway:factory({
   enabled:true,ownerApproved:true,providerVerified:true,
   ...(kind==='AUTO'?{g198PostgresVerified:true}:{g200PostgresVerified:true}),
   origin:host,pinnedOrigin:host,getSession,request
  }),calls};
 }
 test('G211 '+kind+' explicit passenger close and block verify exact terminal receipt',async()=>{
  for(const block of [false,true]){
   const {gateway,calls}=setup({state:block?'BLOCKED':'CLOSED'});
   const out=await gateway.close({...scope,block});
   assert.equal(out.ok,true,JSON.stringify(out));
   assert.equal(out.data.state,block?'BLOCKED':'CLOSED');
   assert.equal(out.productionEnabled,false);
   assert.equal(calls.length,1);
   assert.equal(calls[0].url,host+path+caseId+'/close');
   assert.equal(calls[0].params.method,'POST');
   assert.deepEqual(JSON.parse(calls[0].params.body),{block});
   assert.equal(calls[0].params.credentials,'omit');
  }
 });
 test('G211 '+kind+' rejects malformed block, wrong SQL state and post-HTTP identity rotation',async()=>{
  const invalid=setup();
  assert.equal((await invalid.gateway.close({...scope})).ok,false);
  assert.equal(invalid.calls.length,0);
  const wrong=setup({state:'OPEN'});
  assert.equal((await wrong.gateway.close({...scope,block:false})).ok,false);
  const changed=setup({state:'BLOCKED',sessionChanged:true});
  assert.equal((await changed.gateway.close({...scope,block:true})).ok,false);
 });
}
