import test from 'node:test';
import assert from 'node:assert/strict';
import {createG214AdminDeliveryHandoffGateway} from './g214-admin-delivery-handoff-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const admin='21400000-0000-4214-8214-000000000001';
const session='21400000-0000-4214-8214-000000000002';
const delivery='21400000-0000-4214-8214-000000000003';
const key='21400000-0000-4214-8214-000000000004';
const quote='21400000-0000-4214-8214-000000000005';
const token='g214-verified-provider-token-000000000000';
const at=1793300000000;
const path=kind=>'/v1/staging/admin/services/'+kind+'/'+delivery+'/handoff';
const request=(kind,method='GET',body)=>({path:path(kind),method,
 headers:{authorization:'Bearer '+token},...(body?{body}:{})});
const receipt=(kind,delta={})=>({
 mode:'STAGING_DEMO_ONLY',viewerId:admin,serviceId:delivery,serviceKind:kind,
 bookingRequestKey:key,quoteId:quote,deliveryState:'delivered',revision:4,
 courierAccepted:true,courierProofCommitted:true,recipientBound:true,
 recipientConfirmed:true,eligibleForSettlement:true,paymentAuthorized:false,
 commerciallyCertified:false,legalGate:'EXTERNAL_NOT_CERTIFIED',
 commerceOrderId:null,observedAt:at-100,expiresAt:at+30000,
 serverPersisted:true,qaOnly:true,productionEnabled:false,...delta
});
function fixture({kind='DELIVERY_MOTO',overrides={},sql=null}={}){
 let revoked=false,role='admin',aal2=true,called=0,afterSQL=false;
 const deps={environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async t=>{
   if(t!==token)throw Error('invalid token');
   return {id:admin,sessionId:session,expiresAtMs:at+60000,is_anonymous:false};
  },verifySessionNotRevoked:async()=>!revoked,
  loadExclusiveBackofficeRole:async()=>role,
  verifyBackofficeMfa:async()=>({verifiedByProvider:aal2,
   assuranceLevel:'aal2',userId:admin,sessionId:session,
   verifiedAtMs:at-1000,expiresAtMs:at+30000}),
  allowRequest:()=>true,loadHandoffReceipt:async()=>{
   called++;if(afterSQL)revoked=true;
   return sql??receipt(kind);
  },...overrides};
 return {gateway:createG214AdminDeliveryHandoffGateway(deps),
  revoke:v=>{revoked=v},changeRole:v=>{role=v},mfa:v=>{aal2=v},
  afterSQL:v=>{afterSQL=v},reads:()=>called};
}
test('G214 AUTO/MOTO source-backed terminal proof after independent recipient, no PSP',async()=>{
 for(const kind of ['DELIVERY_AUTO','DELIVERY_MOTO']){
  const f=fixture({kind}),result=await f.gateway(request(kind));
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.recipientConfirmed,true);
  assert.equal(result.body.eligibleForSettlement,true);
  assert.equal(result.body.paymentAuthorized,false);
  assert.equal(result.body.commerciallyCertified,false);
  assert.equal(f.reads(),1);
 }
});
test('G214 courier-only never becomes recipient-confirmed or settled',async()=>{
 const kind='DELIVERY_AUTO';
 const f=fixture({kind,sql:receipt(kind,{recipientBound:false,recipientConfirmed:false,
  eligibleForSettlement:false})});
 const out=await f.gateway(request(kind));
 assert.equal(out.status,200);
 assert.equal(out.body.recipientConfirmed,false);
 assert.equal(out.body.eligibleForSettlement,false);
});
test('G214 disputes preserve independent ACK but forbid settlement eligibility',async()=>{
 const kind='DELIVERY_MOTO';
 for(const [status,revision] of [['disputed',5],['returned',6]]){
  const f=fixture({kind,sql:receipt(kind,{deliveryState:status,revision,
   recipientConfirmed:true,eligibleForSettlement:false})});
  assert.equal((await f.gateway(request(kind))).status,200);
 }
});
test('G214 cannot accept a forged SQL delivery, fake settlement or wrong kind',async()=>{
 const kind='DELIVERY_AUTO';
 for(const fake of [
  {recipientConfirmed:false,eligibleForSettlement:true},
  {recipientConfirmed:true,recipientBound:false},
  {paymentAuthorized:true},
  {commerciallyCertified:true},
  {courierProofCommitted:false},
  {legalGate:'CLEARED'},
  {deliveryState:'disputed',revision:5,eligibleForSettlement:true},
  {commerceOrderId:'not-a-uuid'},
  {serviceKind:'DELIVERY_MOTO'},
  {viewerId:delivery},
  {serviceId:admin},
  {unknown:'malicious'},
 ]){
  const f=fixture({kind,sql:receipt(kind,fake)});
  assert.equal((await f.gateway(request(kind))).status,503,
   'forge rejected: '+JSON.stringify(fake));
 }
});
test('G214 revocation, missing AAL2 and wrong Admin role deny before SQL; revoke after SQL hides receipt',async()=>{
 const kind='DELIVERY_AUTO';
 for(const [modifier,expected] of [
  [f=>f.revoke(true),401],[f=>f.mfa(false),403],
  [f=>f.changeRole('passenger'),403]
 ]){
  const f=fixture({kind});modifier(f);
  assert.equal((await f.gateway(request(kind))).status,expected);
  assert.equal(f.reads(),0);
 }
 const f=fixture({kind});f.afterSQL(true);
 assert.equal((await f.gateway(request(kind))).status,503);
 assert.equal(f.reads(),1);
 assert.equal((await f.gateway(request(kind,'POST',{foo:'bar'}))).status,404);
});
test('G214 HTTP loopback mounts only read-only Admin handoff and fails closed without authority',async t=>{
 const none=async()=>({status:404,body:{error:'Not found'}});
 const make=handler=>createQoreRadarLoopbackTransport({
  riderHandler:none,offerHandler:none,tripCommandHandler:none,
  deliveryHandler:none,merchantHandler:none,financeHandler:none,
  safetyHandler:none,merchantManagementHandler:none,deliveryOfferHandler:none,
  ...(handler?{adminDeliveryHandoffHandler:handler}:{})
 });
 const server=make(null),origin=await listenQoreRadarLoopback(server);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 let raw=await fetch(origin+path('DELIVERY_AUTO'),{
  headers:{authorization:'Bearer '+token}});
 assert.equal(raw.status,503);
 raw=await fetch(origin+path('DELIVERY_MOTO'),{
  method:'POST',headers:{authorization:'Bearer '+token,
   'content-type':'application/json'},body:'{}'});
 assert.equal(raw.status,404);
 const f=fixture({kind:'DELIVERY_MOTO'});
 const server2=make(f.gateway),second=await listenQoreRadarLoopback(server2);
 t.after(()=>new Promise(resolve=>server2.close(resolve)));
 raw=await fetch(second+path('DELIVERY_MOTO'),{
  headers:{authorization:'Bearer '+token}});
 assert.equal(raw.status,200);
 assert.equal((await raw.json()).paymentAuthorized,false);
});
