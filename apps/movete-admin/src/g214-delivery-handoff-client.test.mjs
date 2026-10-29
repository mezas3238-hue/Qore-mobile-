import test from 'node:test';
import assert from 'node:assert/strict';
import {createG214AdminHandoffClient,validateG214AdminHandoff}
 from './g214-delivery-handoff-client.mjs';
const admin='21400000-0000-4214-8214-000000000001';
const id='21400000-0000-4214-8214-000000000002';
const key='21400000-0000-4214-8214-000000000003';
const quote='21400000-0000-4214-8214-000000000004';
const token='g214-aal2-provider-token-00000000000000001';
const at=1793300000000,origin='https://qore-stage.onrender.com';
const receipt=(kind='DELIVERY_AUTO',extra={})=>({
 mode:'STAGING_DEMO_ONLY',viewerId:admin,serviceId:id,
 serviceKind:kind,bookingRequestKey:key,quoteId:quote,
 deliveryState:'delivered',revision:4,courierAccepted:true,
 courierProofCommitted:true,recipientBound:true,recipientConfirmed:true,
 eligibleForSettlement:true,paymentAuthorized:false,commerciallyCertified:false,
 legalGate:'EXTERNAL_NOT_CERTIFIED',commerceOrderId:null,
 observedAt:at-10,expiresAt:at+30000,serverPersisted:true,
 qaOnly:true,productionEnabled:false,...extra
});
const session=()=>({role:'admin',subject:admin,token,mfaVerified:true,
 expiresAt:at+60000});
function make({data=receipt(),originOverride=origin,sessionOverride=null,
 flags={},afterNetwork=null}={}){
 let requests=0,changed=false;
 const fetchImpl=async(url,params)=>{
  requests++;assert.equal(url,origin+'/v1/staging/admin/services/DELIVERY_AUTO/'+id+'/handoff');
  assert.equal(params.method,'GET');assert.equal(params.credentials,'omit');
  assert.equal(params.headers.Authorization,'Bearer '+token);
  if(afterNetwork)changed=true;
  return new Response(JSON.stringify(data),{status:200,
   headers:{'content-type':'application/json'}});
 };
 const gateway=createG214AdminHandoffClient({
  enabled:true,ownerApproved:true,contractVerified:true,
  externalRuntimeVerified:true,serverMfaVerified:true,
  serverRbacVerified:true,serverRevocationVerified:true,
  origin:originOverride,pinnedOrigin:origin,
  getSession:async()=>changed&&sessionOverride?sessionOverride:session(),
  now:()=>at,fetchImpl,...flags
 });
 return {gateway,calls:()=>requests};
}
test('G214 Admin D defaults off: no session or external certified HTTPS means no network',async()=>{
 const x=make({flags:{ownerApproved:false}});
 assert.equal(x.gateway.isConfigured(),false);
 assert.equal((await x.gateway.read('DELIVERY_AUTO',id)).ok,false);
 assert.equal(x.calls(),0);
 const external=make({originOverride:'https://attacker.example.com'});
 assert.equal(external.gateway.isConfigured(),false);
 assert.equal((await external.gateway.read('DELIVERY_AUTO',id)).ok,false);
 assert.equal(external.calls(),0);
});
test('G214 D observes exact original priced AUTO with independent recipient and without PSP',async()=>{
 const x=make(),r=await x.gateway.read('DELIVERY_AUTO',id);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.item.serviceId,id);assert.equal(r.item.quoteId,quote);
 assert.equal(r.item.recipientConfirmed,true);
 assert.equal(r.item.paymentAuthorized,false);
 assert.equal(x.calls(),1);
});
test('G214 courier-only, disputed and returned never authorize settlement',()=>{
 for(const partial of [
  {recipientBound:false,recipientConfirmed:false,eligibleForSettlement:false},
  {deliveryState:'disputed',revision:5,eligibleForSettlement:false},
  {deliveryState:'returned',revision:6,eligibleForSettlement:false},
 ]){
  const d=validateG214AdminHandoff(receipt('DELIVERY_AUTO',partial),{
   kind:'DELIVERY_AUTO',id,actor:admin,at});
  assert(d,JSON.stringify(partial));
  assert.equal(d.eligibleForSettlement,false);
 }
});
test('G214 D blocks forged terminal status, wrong order or fake legal/PSP certificate',()=>{
 for(const corrupt of [
  {paymentAuthorized:true},{commerciallyCertified:true},
  {legalGate:'CLEARED'},{quoteId:id,serviceId:quote},
  {recipientBound:false,recipientConfirmed:true},
  {recipientConfirmed:false,eligibleForSettlement:true},
  {deliveryState:'disputed',revision:4,eligibleForSettlement:false},
  {deliveryState:'returned',revision:6,eligibleForSettlement:true},
  {viewerId:id},{serviceKind:'COMMERCE'},{unknown:'extra'},
 ])assert.equal(validateG214AdminHandoff(receipt('DELIVERY_AUTO',corrupt),{
  kind:'DELIVERY_AUTO',id,actor:admin,at}),null,JSON.stringify(corrupt));
});
test('G214 D rejects identity rotation after network, never shows prior ACK',async()=>{
 const changed=make({afterNetwork:true,
  sessionOverride:{...session(),token:token+'_rotated'}});
 assert.equal((await changed.gateway.read('DELIVERY_AUTO',id)).ok,false);
 assert.equal(changed.calls(),1);
});
