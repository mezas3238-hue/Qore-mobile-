import test from 'node:test';
import assert from 'node:assert/strict';
import {createG142AdminMotoTraceGateway} from './g142-admin-moto-trace-gateway.mjs';

const id=n=>'21200000-0000-4212-8212-'+String(n).padStart(12,'0');
const trip=id(1),admin=id(2),session=id(3),booking=id(4),quote=id(5);
const at=10_000_000;
const path='/v1/staging/admin/services/MOTO_RIDE/'+trip+'/trace';
const token='moto-admin-aal2-independently-verified-qa-00001';
const states=['searching','assigned','arriving','in_progress','completed'];
function row(status='completed'){
 const i=states.indexOf(status);
 return {mode:'STAGING_DEMO_ONLY',viewerId:admin,serviceId:trip,
  serviceKind:'MOTO_RIDE',bookingRequestKey:booking,quoteId:quote,
  status,revision:i+1,observedAt:at-100,expiresAt:at+29900,
  serverPersisted:true,productionEnabled:false,
  assignment:{state:status==='completed'?'QA_COMPLETED':'QA_ACCEPTED',
   legalGate:'EXTERNAL_NOT_CERTIFIED'},
  events:states.slice(0,i+1).map((state,index)=>({
   eventId:id(index+10),serviceId:trip,sequence:index+1,
   status:state,at:at-1000+index*100
  })),
  ledger:{serviceId:trip,currency:'PYG',grossGs:12000,
   platformCommissionGs:2000,customerSubsidyGs:1000,
   driverPayoutGs:10000,reconciliationStatus:'PENDING'}};
}
function setup({read=()=>row(),revoked=false,role='admin',mfa=true}={}){
 let reads=0;
 const gateway=createG142AdminMotoTraceGateway({
  projectRef:'staging1234567890abcd',
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>at,
  verifyAccessToken:async supplied=>{
   if(supplied!==token)throw Error('foreign');
   return {id:admin,sessionId:session,is_anonymous:false,expiresAtMs:at+60000};
  },
  verifySessionNotRevoked:async()=>!revoked,
  loadExclusiveBackofficeRole:async()=>role,
  verifyBackofficeMfa:async()=>({verifiedByProvider:mfa,
   assuranceLevel:'aal2',userId:admin,sessionId:session,
   verifiedAtMs:at-1000,expiresAtMs:at+10000}),
  allowRequest:()=>true,
  loadMotoTraceReceipt:async()=>{reads++;return read();}
 });
 const get=(bearer=token)=>gateway({method:'GET',path,
  headers:{authorization:'Bearer '+bearer}});
 return {get,reads:()=>reads};
}
test('G212 Admin AAL2 accepts only same original assigned MOTO event sequence as QA',async()=>{
 for(const status of ['assigned','arriving','in_progress','completed']){
  const x=setup({read:()=>row(status)});
  const res=await x.get();
  assert.equal(res.status,200,status+': '+JSON.stringify(res.body));
  assert.equal(res.body.serviceId,trip);
  assert.equal(res.body.bookingRequestKey,booking);
  assert.equal(res.body.revision,states.indexOf(status)+1);
  assert.equal(res.body.assignment.legalGate,'EXTERNAL_NOT_CERTIFIED');
  assert.equal(res.body.productionEnabled,false);
  assert.equal(x.reads(),1);
 }
});
test('G212 Admin rejects fake MOTO sequence, cleared legal gate and stolen quote',async()=>{
 for(const mutate of [
  d=>d.events[1].status='completed',
  d=>d.events[2].sequence=9,
  d=>d.events[3].eventId=d.events[1].eventId,
  d=>d.assignment.legalGate='CLEARED',
  d=>d.assignment.state='ASSIGNED',
  d=>d.serviceId=id(88),
  d=>d.viewerId=id(89),
  d=>d.bookingRequestKey='forged',
  d=>d.events.pop()
 ]){
  const dto=row();mutate(dto);
  const x=setup({read:()=>dto});
  const res=await x.get();
  assert.equal(res.status,503,JSON.stringify(res.body));
  assert.equal(res.body.code,'G142_TRACE_PROVENANCE_INVALID');
 }
});
test('G212 JWT, revocation, exclusive Admin and MFA all precede MOTO SQL',async()=>{
 for(const [opts,expected] of [
  [{revoked:true},401],[{role:'owner'},403],[{mfa:false},403]
 ]){
  const x=setup(opts);
  assert.equal((await x.get()).status,expected);
  assert.equal(x.reads(),0);
 }
 const x=setup();
 assert.equal((await x.get('wrong-bearer-00000000000000000')).status,401);
 assert.equal(x.reads(),0);
});
