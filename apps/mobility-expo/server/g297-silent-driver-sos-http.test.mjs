/** G297 HTTP integration: default OFF; no public internet, no real SOS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG297SilentDriverSosGateway} from './g297-silent-driver-sos-gateway.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const no=async()=>({status:503,body:{error:'OFF'}});
const make=(handler)=>createQoreRadarLoopbackTransport({
 riderHandler:no,offerHandler:no,tripCommandHandler:no,deliveryHandler:no,
 merchantHandler:no,financeHandler:no,safetyHandler:no,
 merchantManagementHandler:no,deliveryOfferHandler:no,
 ...(handler?{driverSilentSosHandler:handler}:{})
});
const withServer=async(handler,run)=>{
 const server=make(handler),base=await listenQoreRadarLoopback(server);
 try{await run(base);}finally{await new Promise(r=>server.close(r));}
};
test('G297 HTTP returns 503 with no configured private identity/SOS adapter',async()=>{
 await withServer(undefined,async base=>{
  const r=await fetch(base+'/v1/staging/driver/sos',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({requestKey:uuid(5)})
  });
  assert.equal(r.status,503);
  assert.match((await r.json()).error,/G297/);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
 });
});
test('G297 HTTP forwards exactly one JSON request to private authenticated gateway',async()=>{
 let called=0;
 const privateGateway=createG297SilentDriverSosGateway({
  projectRef:'mrjzxftsdxzepzbcuids',environment:'isolated_staging',
  liveEnabled:false,qaApproved:true,
  verifyDriverSession:async()=>({userId:uuid(1),sessionId:uuid(2),tokenIatMs:1760000000000,role:'driver',
   providerVerified:true,sessionActive:true}),
  lookupAssignedTrip:async()=>({tripId:uuid(3),driverId:uuid(1),
   passengerId:uuid(4),status:'in_progress',vehicleKind:'AUTO'}),
  lookupIdentityReceipt:async()=>({status:'VERIFIED',receiptId:uuid(6)}),
  persistAtomicIncident:async()=>({incidentId:uuid(7),
   atomicCommitted:true,liveEnabled:false}),
  allowRequest:()=>true
 });
 await withServer(async scope=>{called++;return privateGateway(scope);},async base=>{
  const r=await fetch(base+'/v1/staging/driver/sos',{
   method:'POST',headers:{'content-type':'application/json',
    authorization:'Bearer '+'a'.repeat(80)},
   body:JSON.stringify({requestKey:uuid(5)})
  });
  assert.equal(r.status,201);
  const body=await r.json();
  assert.equal(body.journeyContinues,true);
  assert.equal(body.externalResponseDispatched,false);
  assert.equal(body.operatorAcknowledged,false);
  assert.equal('passengerId' in body,false);
  assert.equal('identityReceiptId' in body,false);
 });
 assert.equal(called,1);
});
test('G297 transport rejects browser/cookies, GET, URL-query and non-JSON before handler',async()=>{
 let calls=0;
 await withServer(async()=>{calls++;return {status:200,body:{ok:true}};},async base=>{
  const cases=[
   {path:'/v1/staging/driver/sos',method:'GET'},
   {path:'/v1/staging/driver/sos?x=1',method:'POST',contentType:'application/json'},
   {path:'/v1/staging/driver/sos',method:'POST',contentType:'text/plain'},
   {path:'/v1/staging/driver/sos',method:'POST',contentType:'application/json',origin:true},
   {path:'/v1/staging/driver/sos',method:'POST',contentType:'application/json',cookie:true}
  ];
  for(const one of cases){
   const headers={};
   if(one.contentType)headers['content-type']=one.contentType;
   if(one.origin)headers.origin='https://evil.example';
   if(one.cookie)headers.cookie='user=1';
   const resp=await fetch(base+one.path,{method:one.method,headers,
    ...(one.method==='POST'?{body:'{}'}:{})});
   assert.notEqual(resp.status,200);
  }
 });
 assert.equal(calls,0);
});
