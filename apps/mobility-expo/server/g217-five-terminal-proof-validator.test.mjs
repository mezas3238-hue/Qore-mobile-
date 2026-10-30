import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyG217TerminalRead} from './g217-five-terminal-proof-validator.mjs';
const id='21700000-0000-4217-8217-000000000001';
const key='21700000-0000-4217-8217-000000000002';
const quote='21700000-0000-4217-8217-000000000003';
const admin='21700000-0000-4217-8217-000000000004';
const at=1793300000000;
const original=kind=>({serviceKind:kind,originalServiceId:id,
 originalRequestKey:key,sourcePersisted:true,clientToAdminSameOriginal:true});
function receipt(kind='DELIVERY_AUTO'){
 const states=kind.endsWith('_RIDE')
  ?['searching','assigned','arriving','in_progress','completed']:
  ['requested','accepted','picked_up','delivered'];
 return {mode:'STAGING_DEMO_ONLY',productionEnabled:false,
  serverPersisted:true,viewerId:admin,serviceId:id,
  serviceKind:kind,bookingRequestKey:key,quoteId:quote,
  status:states.at(-1),revision:states.length,
  observedAt:at-100,expiresAt:at+30000,
  assignment:{state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'},
  events:states.map((status,i)=>({
   serviceId:id,eventId:i===0?id:'21700000-0000-4217-8217-'+
     String(i+10).padStart(12,'0'),sequence:i+1,status,at:at-5000+i*1000
  })),
  ledger:kind.endsWith('_RIDE')?{serviceId:id,currency:'PYG',
   reconciliationStatus:'PENDING'}:null};
}
test('G217 independently verifies both Driver rides with full ordered events',()=>{
 for(const kind of ['AUTO_RIDE','MOTO_RIDE']){
  assert.equal(verifyG217TerminalRead({source:original(kind),
   receipt:receipt(kind),now:at}).ok,true);
 }
});
test('G217 independently verifies both courier deliveries without PSP',()=>{
 for(const kind of ['DELIVERY_AUTO','DELIVERY_MOTO']){
  assert.equal(verifyG217TerminalRead({source:original(kind),
   receipt:receipt(kind),now:at}).ok,true);
 }
});
test('G217 refuses a forged completion without acceptance, pickup or any event',()=>{
 for(const kind of ['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']){
  const d=receipt(kind);
  for(const forged of [
   {...d,events:d.events.slice(1)},
   {...d,events:[...d.events].reverse()},
   {...d,events:d.events.map((e,i)=>i===1?{...e,eventId:id}:e)},
   {...d,events:d.events.map((e,i)=>i===2?{...e,serviceId:admin}:e)},
   {...d,events:d.events.map((e,i)=>i===2?{...e,status:'cancelled'}:e)},
   {...d,serviceId:admin},{...d,bookingRequestKey:quote},
   {...d,assignment:{state:'QA_COMPLETED',legalGate:'CLEARED'}},
   {...d,productionEnabled:true}
  ])assert.equal(verifyG217TerminalRead({
   source:original(kind),receipt:forged,now:at}).ok,false);
 }
});
test('G217 never interprets courier-only delivery, unbound recipient or stale receipt as completion',()=>{
 const d=receipt('DELIVERY_AUTO');
 assert.equal(verifyG217TerminalRead({source:original('DELIVERY_AUTO'),
  receipt:{...d,status:'picked_up',revision:3},now:at}).ok,false);
 assert.equal(verifyG217TerminalRead({source:original('DELIVERY_AUTO'),
  receipt:{...d,expiresAt:at-1},now:at}).ok,false);
 assert.equal(verifyG217TerminalRead({source:original('DELIVERY_AUTO'),
  receipt:{...d,ledger:{currency:'PYG'}},now:at}).ok,false);
});
test('G217 Commerce requires original G45 ready order and same linked G5 terminal receipt',()=>{
 const order={...receipt('DELIVERY_AUTO'),serviceKind:'COMMERCE',status:'ready',
 revision:5,deliveryId:id,vehicleKind:'AUTO',assignment:{
  state:'NOT_ASSIGNABLE',legalGate:'G38_BLOCKED'}};
 const originalOrder={...original('COMMERCE'),linkedCommerceDeliveryId:id};
 assert.equal(verifyG217TerminalRead({source:originalOrder,
  receipt:order,linkedDeliveryReceipt:receipt('DELIVERY_AUTO'),now:at}).ok,true);
 assert.equal(verifyG217TerminalRead({source:originalOrder,
  receipt:order,now:at}).ok,false);
 assert.equal(verifyG217TerminalRead({source:originalOrder,
  receipt:order,linkedDeliveryReceipt:receipt('DELIVERY_MOTO'),now:at}).ok,false);
 assert.equal(verifyG217TerminalRead({source:originalOrder,
  receipt:{...order,deliveryId:quote},
  linkedDeliveryReceipt:receipt('DELIVERY_AUTO'),now:at}).ok,false);
});

test('G217 requires G202 original source provenance, never a fabricated passed flag',()=>{
 const d=receipt('MOTO_RIDE');
 for(const corruption of [
  {sourcePersisted:false},
  {clientToAdminSameOriginal:false},
  {originalServiceId:quote},
  {originalRequestKey:id}
 ]){
  const source={...original('MOTO_RIDE'),...corruption};
  assert.equal(verifyG217TerminalRead({
   source,receipt:d,now:at}).ok,false);
 }
});
