import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseTerminalDeliveryKeys} from './g68-terminal-delivery-release.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const uuid=n=>'25500000-0000-4255-8255-'+String(n).padStart(12,'0');
const owner=uuid(1),other=uuid(2),deliveryId=uuid(3),requestKey=uuid(4);
const quoteKey=uuid(5),host='https://qore-b25-terminal.onrender.com';
const g121=(state='delivered',kind='MOTO')=>({
 mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,serverPersisted:true,
 ownerId:owner,requestKey,deliveryId,vehicleKind:kind,
 status:state,revision:4
});
const g68=(state='delivered',kind='MOTO',proved=true)=>({
 mode:'STAGING_DEMO_ONLY',deliveryId,ownerId:owner,
 state,revision:4,vehicleKind:kind,assignmentPersisted:true,
 proofVerified:proved,qaOnly:true,productionEnabled:false,
 liveDeliveriesEnabled:false
});
const response=(body,status=200)=>({ok:true,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(body)});
const history=()=>({ownerId:owner,generatedAt:T-100,expiresAt:T+10000,
 nextCursor:null,items:[{kind:'DELIVERY',serviceId:deliveryId,
 status:'completed',createdAt:T-2000,revision:2}]});
const deliveryBody=(key=requestKey)=>({
 requestKey:key,vehicleKind:'MOTO',category:'PARCEL',
 grams:1000,lengthCm:20,widthCm:10,heightCm:6,
 pickupTag:'PICKUP_NORTH',deliveryTag:'DELIVERY_SOUTH',
 restrictedItemDeclared:false
});
function vault({withQuote=true,failDelete=false,foreignQuote=false}={}){
 let saved={version:1,ownerId:owner,requestKey,createdAt:T};
 let quote=withQuote?{version:1,ownerId:owner,
  deliveryId:foreignQuote?other:deliveryId,deliveryRequestKey:requestKey,
  quoteRequestKey:quoteKey,vehicleKind:'MOTO',createdAt:T,
  stage:'consent_attempted'}:null;
 const cleared=[];
 const g5={
  read:async()=>saved,write:async rec=>{saved=rec;},
  clear:async()=>{saved=null;},
  clearMatching:async(o,k)=>{
   if(failDelete)throw Error('native keystore failed');
   if(!saved||saved.ownerId!==o||saved.requestKey!==k)throw Error('G5 mismatch');
   saved=null;cleared.push('g5');return true;
  }
 };
 const g7={
  read:async()=>quote,
  write:async()=>{},
  mark:async()=>{},
  clearMatching:async(o,d,k)=>{
   if(!quote||quote.ownerId!==o||quote.deliveryId!==d
    ||quote.deliveryRequestKey!==k)throw Error('G7 mismatch');
   quote=null;cleared.push('g7');return true;
  }
 };
 return {g5,g7,cleared,hasG5:()=>saved!==null,hasG7:()=>quote!==null};
}
function fixture({status='delivered',custodyState='delivered',
 kind='MOTO',custodyKind='MOTO',proved=true,db=vault()}={}){
 let readsG121=0,readsG68=0,token='b25-passenger-jwt-123456789012';
 const app=createClientExperience({now:()=>T,
  deliveryRecoveryStore:db.g5,deliveryQuoteKeyStore:db.g7,
  authProvider:{
   readSession:async()=>({role:'passenger',subject:owner,token,expiresAt:T+60000}),
   signOut:async()=>{}
  },
  deliveryRegistrationOptions:{enabled:true,contractCertified:true,
   externalRuntimeVerified:true,passengerRlsVerified:true,
   ownerApproved:true,origin:host,pinnedOrigin:host,
   fetchImpl:async()=>{readsG121++;return response(g121(status,kind));}},
  senderCustodyOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,
   readOwnDelivery:async()=>{readsG68++;
    return {ok:true,status:200,data:g68(custodyState,custodyKind,proved)};}}
 });
 return {app,db,g121Reads:()=>readsG121,g68Reads:()=>readsG68,
  rotate:()=>{token='b25-other-rotated-token-123456789';}};
}
async function load(f){
 assert.equal((await f.app.refreshSession()).ok,true);
 assert.equal(f.app.snapshot().mutation.requestKey,requestKey);
 assert.equal((await f.app.readUnconfirmedDeliveryRegistration()).ok,true);
 assert.equal(f.app.acceptHistory(history()),true);
 assert.equal((await f.app.readOwnDeliveryCustody(deliveryId)).ok,true);
}
test('B25 terminal delivered G121 + fresh G68 proof allows new QA delivery',async()=>{
 const f=fixture();await load(f);
 assert.equal(f.app.snapshot().deliveryRegistration.status,'delivered');
 assert.equal(f.app.snapshot().deliveryTerminalRelease.canFinalize,true);
 const before=f.g121Reads(), beforeCustody=f.g68Reads();
 const result=await f.app.finalizeDeliveredDeliveryQa();
 assert.equal(result.ok,true);
 assert.equal(result.localKeysReleased,true);
 assert.equal(f.g121Reads(),before+1);
 assert.equal(f.g68Reads(),beforeCustody+1);
 assert.deepEqual(f.db.cleared,['g7','g5']);
 assert.equal(f.db.hasG5(),false);
 assert.equal(f.db.hasG7(),false);
 assert.equal(f.app.snapshot().mutation.phase,'idle');
 assert.equal(f.app.snapshot().deliveryRecovery.phase,'clear');
 assert.equal(f.app.snapshot().deliveryRegistration.deliveryId,null);
 assert.equal(f.app.prepareDelivery(deliveryBody(uuid(9))).ok,true);
 assert.equal(f.app.snapshot().mutation.requestKey,uuid(9));
});
test('B25 returned G121 and independently proved G68 allow terminal local release',async()=>{
 const f=fixture({status:'returned',custodyState:'returned'});await load(f);
 assert.equal(f.app.snapshot().deliveryTerminalRelease.canFinalize,true);
 assert.equal((await f.app.finalizeDeliveredDeliveryQa()).ok,true);
 assert.deepEqual(f.db.cleared,['g7','g5']);
});
test('B25 pending, cancelled, disputed and proofless states cannot unlock',async()=>{
 for(const status of ['accepted','picked_up','cancelled','disputed']){
  const f=fixture({status,custodyState:status,
   proved:status==='disputed'||status==='delivered'});
  await load(f);
  assert.equal(f.app.snapshot().deliveryTerminalRelease.canFinalize,false,status);
  assert.equal((await f.app.finalizeDeliveredDeliveryQa()).ok,false);
  assert.deepEqual(f.db.cleared,[]);
 }
});
test('B25 different G121/G68 vehicle or state is not evidence',async()=>{
 for(const opts of [
  {kind:'AUTO'}, {custodyKind:'AUTO'},
  {custodyState:'returned'}, {proved:false}
 ]){
  const f=fixture(opts);await f.app.refreshSession();
  await f.app.readUnconfirmedDeliveryRegistration();
  f.app.acceptHistory(history());
  await f.app.readOwnDeliveryCustody(deliveryId);
  assert.equal(f.app.snapshot().deliveryTerminalRelease.canFinalize,false);
  assert.equal((await f.app.finalizeDeliveredDeliveryQa()).ok,false);
  assert.deepEqual(f.db.cleared,[]);
 }
});
test('B25 G7 pending quote for another delivery blocks all terminal deletion',async()=>{
 const f=fixture({db:vault({foreignQuote:true})});await load(f);
 assert.equal(f.app.snapshot().deliveryTerminalRelease.canFinalize,true);
 const x=await f.app.finalizeDeliveredDeliveryQa();
 assert.equal(x.code,'TERMINAL_SAVED_SCOPE_CONFLICT');
 assert.deepEqual(f.db.cleared,[]);
 assert.equal(f.app.snapshot().mutation.phase,'failed');
});
test('B25 storage failure remains fail-closed; G5 key cannot be discarded',async()=>{
 const f=fixture({db:vault({withQuote:false,failDelete:true})});await load(f);
 const result=await f.app.finalizeDeliveredDeliveryQa();
 assert.equal(result.ok,false);
 assert.equal(f.db.hasG5(),true);
 assert.equal(f.app.snapshot().mutation.phase,'failed');
 assert.equal(f.app.prepareDelivery(deliveryBody(uuid(9))).ok,false);
});
test('B25 fresh G68 proof, Owner+identity revocation stops release',async()=>{
 const f=fixture();await load(f);
 f.rotate();
 await f.app.refreshSession(); // Re-auth revokes old G121/G68 proof
 const result=await f.app.finalizeDeliveredDeliveryQa();
 assert.equal(result.ok,false);
 assert.equal(f.db.hasG5(),true);
 assert.equal(f.db.hasG7(),true);
});
test('B25 pure release never trusts mere G121 delivered without proof or typed IDs',async()=>{
 const db=vault();
 const base={ownerId:owner,deliveryId,requestKey,vehicleKind:'MOTO',
  g121:{deliveryId,requestKey,vehicleKind:'MOTO',status:'delivered',revision:4},
  g68:{deliveryId,vehicleKind:'MOTO',state:'delivered',proofVerified:true,revision:4},
  g5Store:db.g5,g7Store:db.g7,stillAuthorized:()=>true};
 for(const patch of [
  {g68:{...base.g68,proofVerified:false}},
  {g121:{...base.g121,status:'requested'}},
  {g121:{...base.g121,requestKey:other}},
  {g68:{...base.g68,deliveryId:other}},
  {g68:{...base.g68,revision:3}},
  {stillAuthorized:()=>false}
 ]){
  assert.equal((await releaseTerminalDeliveryKeys({...base,...patch})).ok,false);
 }
 assert.deepEqual(db.cleared,[]);
});
