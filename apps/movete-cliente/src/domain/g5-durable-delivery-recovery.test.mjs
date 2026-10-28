import test from 'node:test';
import assert from 'node:assert/strict';
import {createG5DurableDeliveryRecovery} from './g5-durable-delivery-recovery.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000,uuid=n=>'12500000-0000-4125-8125-'+String(n).padStart(12,'0');
const owner=uuid(1),other=uuid(2),requestKey=uuid(30),deliveryId=uuid(40);
const path='https://qore-b19-g5.onrender.com';
const payload=()=>({requestKey,vehicleKind:'MOTO',category:'PARCEL',
 grams:1200,lengthCm:20,widthCm:10,heightCm:8,
 pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST',
 restrictedItemDeclared:false});
const ack=()=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify({
  mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
  serverPersisted:true,ownerId:owner,requestKey,
  deliveryId,vehicleKind:'MOTO',status:'requested',revision:1
 })});
function vault(){
 const data=new Map(),writes=[];
 return {
  writes,data,
  store:{
   read:async subject=>data.get(subject)??null,
   write:async rec=>{
    const existing=data.get(rec.ownerId);
    if(existing&&existing.requestKey!==rec.requestKey)
     throw Error('Do not overwrite unresolved request');
    writes.push(rec);data.set(rec.ownerId,rec);
   },
   clear:async subject=>data.delete(subject)
  }
 };
}
function create({store,subject=owner,gateway=null,fetchImpl=null}={}){
 let posts=0,gets=0;
 const app=createClientExperience({now:()=>T,deliveryRecoveryStore:store,
  authProvider:{readSession:async()=>({role:'passenger',subject,
   token:'g5-authenticated-passenger-token-1234567890',expiresAt:T+60000}),
   signOut:async()=>{}},
  gateway:gateway??{isConfigured:()=>true,send:async()=>{
   posts++;return {ok:false,code:'NETWORK_OR_TIMEOUT'};
  }},
  deliveryRegistrationOptions:{
   enabled:true,contractCertified:true,externalRuntimeVerified:true,
   passengerRlsVerified:true,ownerApproved:true,
   origin:path,pinnedOrigin:path,
   fetchImpl:fetchImpl??(async()=>{
    gets++;return ack();
   })
  }
 });
 return {app,posts:()=>posts,gets:()=>gets};
}
test('B19 persists opaque G5 key BEFORE POST and crash restore does only private GET',async()=>{
 const {store,writes}=vault(),first=create({store});
 assert.equal((await first.app.refreshSession()).ok,true);
 assert.equal(first.app.snapshot().deliveryRecovery.phase,'clear');
 assert.equal(first.app.prepareDelivery(payload()).ok,true);
 assert.equal((await first.app.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(writes.length,1);
 assert.deepEqual(Object.keys(writes[0]).sort(),[
  'version','ownerId','requestKey','createdAt'].sort());
 assert.equal(writes[0].ownerId,owner);
 assert.equal(writes[0].requestKey,requestKey);
 assert.equal(JSON.stringify(writes[0]).includes('PICKUP_EAST'),false);
 assert.equal(first.posts(),1);
 const afterRestart=create({store});
 assert.equal((await afterRestart.app.refreshSession()).ok,true);
 const recovered=afterRestart.app.snapshot();
 assert.equal(recovered.mutation.phase,'failed');
 assert.equal(recovered.mutation.operation,'deliveryRequest');
 assert.equal(recovered.mutation.requestKey,requestKey);
 assert.equal(recovered.deliveryRecovery.unresolved,true);
 assert.equal(afterRestart.app.prepareDelivery({...payload(),requestKey:uuid(80)}).ok,false);
 assert.equal((await afterRestart.app.retry()).code,'NO_READY_REQUEST');
 assert.equal(afterRestart.posts(),0);
 const consulted=await afterRestart.app.readUnconfirmedDeliveryRegistration();
 assert.equal(consulted.ok,true);
 assert.equal(consulted.deliveryId,deliveryId);
 assert.equal(afterRestart.gets(),1);
 assert.equal(afterRestart.posts(),0);
 assert.equal(afterRestart.app.snapshot().deliveryRegistration.deliveryId,deliveryId);
 assert.equal(afterRestart.app.snapshot().mutation.phase,'failed');
 assert.equal(writes.length,1);
});
test('B19 restart blocked when store read fails or holds forged/malformed key',async()=>{
 const damaged=[{...vault().store,read:async()=>{throw Error('keystore locked')}},
  {...vault().store,read:async()=>({...{version:1,ownerId:owner,
    requestKey,createdAt:T},receiverPhone:'PRIVATE'})},
  {...vault().store,read:async()=>({version:1,ownerId:other,
    requestKey,createdAt:T})}];
 for(const store of damaged){
  const {app,posts}=create({store});
  assert.equal((await app.refreshSession()).ok,true);
  assert.equal(app.snapshot().deliveryRecovery.blocked,true);
  assert.equal(app.prepareDelivery(payload()).code,'G5_RECOVERY_READBACK_REQUIRED');
  assert.equal(posts(),0);
 }
});
test('B19 secure write failure prevents POST and cannot silently issue new key',async()=>{
 let writes=0,posts=0;
 const {store}=vault();
 const bad={...store,write:async()=>{writes++;throw Error('Keystore error')}};
 const {app}=create({store:bad,gateway:{
  isConfigured:()=>true,send:async()=>{posts++;return {ok:true}}
 }});
 await app.refreshSession();
 assert.equal(app.prepareDelivery(payload()).ok,true);
 assert.equal((await app.submit()).code,'G5_SECURE_SAVE_FAILED_NO_POST');
 assert.equal(writes,1);assert.equal(posts,0);
 assert.equal(app.snapshot().deliveryRecovery.blocked,true);
 assert.equal((await app.submit()).code,'G5_UNRESOLVED_DELIVERY_PRESENT');
 assert.equal(posts,0);
});
test('B19 different authenticated account cannot read the first owner key',async()=>{
 const {store}=vault(),a=create({store});
 await a.app.refreshSession();a.app.prepareDelivery(payload());await a.app.submit();
 const second=create({store,subject:other});
 assert.equal((await second.app.refreshSession()).ok,true);
 assert.equal(second.app.snapshot().mutation.phase,'idle');
 assert.equal(second.app.snapshot().deliveryRecovery.unresolved,false);
 assert.equal(second.app.snapshot().deliveryRegistration.deliveryId,null);
 assert.equal(second.gets(),0);
});
test('B19 logout and login cannot erase unresolved key without server terminal proof',async()=>{
 const {store}=vault(),a=create({store});
 await a.app.refreshSession();a.app.prepareDelivery(payload());await a.app.submit();
 assert.equal((await a.app.signOut()).ok,true);
 assert.equal(a.app.snapshot().deliveryRecovery.unresolved,false);
 const b=create({store});
 await b.app.refreshSession();
 assert.equal(b.app.snapshot().deliveryRecovery.unresolved,true);
 assert.equal(b.app.snapshot().mutation.requestKey,requestKey);
 assert.equal(b.posts(),0);
});
test('B19 durable controller blocks overwriting uncertain key with another UUID',async()=>{
 const {store}=vault(),c=createG5DurableDeliveryRecovery({store,now:()=>T});
 assert.equal((await c.restore(owner)).restored,false);
 assert.equal((await c.persist(owner,requestKey)).ok,true);
 assert.equal((await c.persist(owner,uuid(70))).code,'G5_UNRESOLVED_DELIVERY_PRESENT');
 c.clearMemory();
 assert.equal((await c.restore(owner)).requestKey,requestKey);
 assert.equal(c.snapshot(owner).blocked,true);
});
test('B19 secure recovery rejects bad owner, schema or time',async()=>{
 const store={read:async()=>({version:2,ownerId:owner,requestKey,createdAt:T}),
  write:async()=>{},clear:async()=>{}};
 const c=createG5DurableDeliveryRecovery({store,now:()=>T});
 assert.equal((await c.restore(owner)).code,'G5_INVALID_SAVED_KEY');
 assert.equal(c.snapshot(owner).blocked,true);
 assert.equal((await c.restore('../../evil')).code,'INVALID_OWNER_SCOPE');
});
