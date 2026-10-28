import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerCommissionGateway} from './owner-commission-gateway.mjs';
import {certifyOwnerCommissionReadback}
 from './owner-commission-readback.mjs';
const owner='13600000-0000-4136-8136-000000000001';
const key='13600000-0000-4136-8136-000000000011';
const host='https://qore-g136-owner-policy-qa.invalid';
const source=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
const policy=(kind,bps=0,version=1)=>({
 serviceKind:kind,commissionBps:bps,subsidyBps:
  ['AUTO_RIDE','MOTO_RIDE'].includes(kind)?1000:0,
 version,mode:'STAGING_DEMO_ONLY',productionEnabled:false
});
test('G136 Admin Owner reads five services and independently verifies changed cargo/commerce',async()=>{
 const issued={role:'owner',mfaVerified:true,subject:owner,
  token:'g136-owner-provider-token-123456789',expiresAt:2000000600000};
 const stored=new Map(source.map(k=>[k,policy(k)]));
 const called=[];
 const gateway=createOwnerCommissionGateway({
  enabled:true,contractCertified:true,origin:host,pinnedOrigin:host,
  getSession:async()=>issued,now:()=>2000000000000,
  fetchImpl:async(url,opts)=>{
   const kind=url.split('/').at(-1);
   assert(source.includes(kind));
   called.push({kind,method:opts.method});
   if(opts.method==='POST'){
    const body=JSON.parse(opts.body);
    assert.equal(body.requestKey,key);
    const before=stored.get(kind);
    stored.set(kind,policy(kind,body.commissionBps,before.version+1));
   }
   return {ok:true,status:200,redirected:false,
    headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify(stored.get(kind))};
  }
 });
 for(const kind of source){
  const read=await gateway.read(kind);
  assert.equal(read.ok,true);
  assert.equal(read.data.subsidyBps,kind.endsWith('_RIDE')?1000:0);
 }
 for(const kind of source.slice(2)){
  const written=await gateway.change(kind,{requestKey:key,commissionBps:750});
  const persisted=await gateway.read(kind);
  assert.equal(written.ok,true);
  assert.equal(certifyOwnerCommissionReadback({written:written.data,
   readback:persisted.data,service:kind,previousVersion:1}).ok,true);
 }
 assert.equal(called.filter(x=>x.method==='POST').length,3);
 assert.equal((await gateway.change('AUTO_RIDE',{
  requestKey:key,commissionBps:900})).ok,false);
 assert.equal((await gateway.read('MERCHANT_ORDER')).ok,false);
});
test('G136 cargo/commerce rejects forged 10pct passenger subsidy and cross-service receipt',()=>{
 assert.equal(certifyOwnerCommissionReadback({
  written:policy('COMMERCE',1000,2),
  readback:{...policy('COMMERCE',1000,2),subsidyBps:1000},
  previousVersion:1,service:'COMMERCE'}).ok,false);
 assert.equal(certifyOwnerCommissionReadback({
  written:policy('DELIVERY_AUTO',1000,2),
  readback:policy('DELIVERY_MOTO',1000,2),
  previousVersion:1,service:'DELIVERY_AUTO'}).ok,false);
});
