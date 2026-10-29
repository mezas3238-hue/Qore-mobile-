import test from 'node:test';
import assert from 'node:assert/strict';
import {createG169DriverMotoJourneyGateway} from './g169-driver-moto-journey-gateway.mjs';
const id=n=>'16900000-0000-4169-8169-'+String(n).padStart(12,'0');
const driver=id(1),foreign=id(2),booking=id(3),trip=id(4),event=id(5);
const path='/v1/staging/driver/moto/bookings/'+booking;
let state;
function setup({owner=driver,role='driver',revoked=false,sqlFailure=false}={}){
 state={mode:'STAGING_DEMO_ONLY',qaOnly:true,productionEnabled:false,
  serviceKind:'MOTO_RIDE',driverId:owner,bookingKey:booking,
  tripId:trip,tripState:'accepted',tripRevision:2,serverPersisted:true};
 let calls=0;
 const gateway=createG169DriverMotoJourneyGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>10000000,
  verifyAccessToken:async()=>({id:driver,sessionId:id(6),
   tokenIatMs:9999000,is_anonymous:false,expiresAtMs:11000000}),
  verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>role,allowRequest:()=>true,
  readMoto:async()=>owner===driver?state:null,
  advanceMoto:async({driverId,sessionId,tokenIatMs,bookingKey,expectedRevision,nextState,commandKey})=>{
   calls++;assert.deepEqual({driverId,sessionId,tokenIatMs,bookingKey,expectedRevision,commandKey},
    {driverId:driver,sessionId:id(6),tokenIatMs:9999000,
     bookingKey:booking,expectedRevision:2,commandKey:event});
   if(sqlFailure)throw Error('Unknown DB COMMIT');
   state={...state,tripState:nextState,tripRevision:expectedRevision+1};
  }
 });
 const request=(method,body,headers={authorization:'Bearer '+'a'.repeat(24)})=>
  gateway({method,path:path+(method==='GET'?'/status':'/advance'),body,headers});
 return {request,calls:()=>calls};
}
const command={expectedRevision:2,nextState:'arriving',commandKey:event};
test('G169 assigned MOTO follows exactly Driver-owned original ID and revision',async()=>{
 const x=setup();
 const first=await x.request('GET');
 assert.equal(first.status,200);assert.equal(first.body.tripId,trip);
 assert.equal(first.body.tripState,'accepted');
 assert.equal(first.body.gpsVerified,false);
 assert(!JSON.stringify(first.body).includes('ownerId'));
 const stepped=await x.request('POST',command);
 assert.equal(stepped.status,200);assert.equal(stepped.body.tripRevision,3);
 assert.equal(stepped.body.tripState,'arriving');
 const old=await x.request('POST',command);
 assert.equal(old.status,409);assert.equal(x.calls(),1);
});
test('G169 foreign Driver, revoked IdP, Owner role and bad command never touch SQL',async()=>{
 for(const setupArgs of [{owner:foreign,status:404},
  {role:'owner',status:403},{revoked:true,status:401}]){
  const {status,...args}=setupArgs;
  const x=setup(args);
  assert.equal((await x.request('GET')).status,status);
  assert.equal(x.calls(),0);
 }
 const x=setup();
 for(const body of [{...command,expectedRevision:4},
  {...command,nextState:'completed'}, {...command,commandKey:'invalid'},
  {...command,extra:'forged'}]){
  const r=await x.request('POST',body);
  assert([400,409].includes(r.status));
 }
 assert.equal(x.calls(),0);
});
test('G169 ambiguous original SQL command cannot be called again automatically',async()=>{
 const x=setup({sqlFailure:true});
 assert.equal((await x.request('POST',command)).status,503);
 assert.equal(x.calls(),1);
 assert.equal((await x.request('GET')).body.tripState,'accepted');
});

test('G189 current MOTO recovery is read-only and locked to revocable Driver identity',async()=>{
 const row={mode:'STAGING_DEMO_ONLY',qaOnly:true,productionEnabled:false,
  serviceKind:'MOTO_RIDE',driverId:driver,bookingKey:booking,
  tripId:trip,tripState:'accepted',tripRevision:2,serverPersisted:true};
 let actor=driver,role='driver',revoked=false,reads=0;
 const gateway=createG169DriverMotoJourneyGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>10000000,
  verifyAccessToken:async()=>({id:actor,sessionId:id(6),
   tokenIatMs:9999000,is_anonymous:false,expiresAtMs:11000000}),
  verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>role,allowRequest:()=>true,
  readMoto:async()=>{throw Error('G189 cannot guess any booking key');},
  advanceMoto:async()=>{throw Error('G189 cannot send driver mutations');},
  readCurrentMoto:async({driverId})=>{
   reads++;return driverId===driver?row:null;
  }
 });
 const req=()=>gateway({method:'GET',path:'/v1/staging/driver/moto/current',
  headers:{authorization:'Bearer '+'z'.repeat(24)}});
 const ok=await req();
 assert.equal(ok.status,200);
 assert.equal(ok.body.activeBooking.bookingKey,booking);
 assert.equal(ok.body.activeBooking.tripId,trip);
 assert.equal(ok.body.activeBooking.nextState,'arriving');
 assert(!JSON.stringify(ok.body).includes('passengerId'));
 actor=foreign;
 assert.equal((await req()).body.activeBooking,null);
 actor=driver;revoked=true;
 assert.equal((await req()).status,401);
 role='passenger';revoked=false;
 assert.equal((await req()).status,403);
 assert.equal(reads,2);
});
test('G189 malformed, completed or ambiguous MOTO owner RPC fails closed',async()=>{
 const row={mode:'STAGING_DEMO_ONLY',qaOnly:true,productionEnabled:false,
  serviceKind:'MOTO_RIDE',driverId:driver,bookingKey:booking,
  tripId:trip,tripState:'accepted',tripRevision:2,serverPersisted:true};
 for(const returned of [[row],{...row,driverId:foreign},
  {...row,tripState:'completed',tripRevision:5},
  {...row,passengerPhone:'private'},undefined]){
  const gateway=createG169DriverMotoJourneyGateway({
   environment:'isolated_staging',qaOnly:true,liveEnabled:false,
   now:()=>10000000,
   verifyAccessToken:async()=>({id:driver,sessionId:id(6),
    is_anonymous:false,expiresAtMs:11000000}),
   verifySessionNotRevoked:async()=>true,
   resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
   readMoto:async()=>null,advanceMoto:async()=>{},
   readCurrentMoto:async()=>returned
  });
  const result=await gateway({method:'GET',
   path:'/v1/staging/driver/moto/current',
   headers:{authorization:'Bearer '+'z'.repeat(24)}});
  assert.equal(result.status,503,'No active assignment may be inferred');
 }
});
