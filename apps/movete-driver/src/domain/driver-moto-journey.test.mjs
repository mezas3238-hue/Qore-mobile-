import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverMotoJourney,advanceDriverMotoJourney}
 from './driver-moto-journey-http.mjs';
import {createDriverMotoJourneyController}
 from './driver-moto-journey.mjs';
const id=n=>'18800000-0000-4188-8188-'+String(n).padStart(12,'0');
const booking=id(1),trip=id(2),owner=id(3),key=id(4);
const bearer='g188-private-driver-token-1234567890';
const origin='https://g188-driver-moto.example';
const scope={apiOrigin:origin,approvedStagingHost:'g188-driver-moto.example',
 allowedByOwner:true,accessToken:bearer,bookingKey:booking};
const states=['accepted','arriving','in_progress','completed'];
const next=['arriving','in_progress','completed',null];
const body=(idx=0)=>({mode:'STAGING_DEMO_ONLY',qaOnly:true,
 productionEnabled:false,serviceKind:'MOTO_RIDE',tripId:trip,
 bookingKey:booking,tripState:states[idx],tripRevision:idx+2,
 nextState:next[idx],serverPersisted:true,gpsVerified:false,pspCollected:false});
const response=b=>({status:200,redirected:false,json:async()=>b});
const dto=idx=>({bookingKey:booking,tripId:trip,status:states[idx],
 revision:idx+2,nextState:next[idx],qaOnly:true,productionEnabled:false});
test('G188 native MOTO GET and POST use original booking and pinned private origin',async()=>{
 const calls=[];
 const request=async(url,options)=>{
  calls.push({url,options});
  return response(options.method==='GET'?body(0):body(1));
 };
 const first=await readDriverMotoJourney({...scope,request});
 assert.deepEqual(first,dto(0));
 const updated=await advanceDriverMotoJourney({...scope,request,
  expectedRevision:2,nextState:'arriving',commandKey:key});
 assert.deepEqual(updated,dto(1));
 assert.deepEqual(calls.map(c=>c.url),[
  origin+'/v1/staging/driver/moto/bookings/'+booking+'/status',
  origin+'/v1/staging/driver/moto/bookings/'+booking+'/advance']);
 assert.deepEqual(JSON.parse(calls[1].options.body),
  {expectedRevision:2,nextState:'arriving',commandKey:key});
 assert(calls.every(c=>c.options.headers.authorization==='Bearer '+bearer));
 assert(!JSON.stringify(updated).includes(bearer));
 assert(!JSON.stringify(updated).includes(owner));
});
test('G188 rejects forged Driver MOTO state, wrong session host and illegal revision',async()=>{
 let posts=0;
 for(const broken of [
  {...body(0),serviceKind:'AUTO_RIDE'}, {...body(0),bookingKey:id(9)},
  {...body(0),tripId:id(9),tripRevision:1},
  {...body(0),gpsVerified:true}, {...body(0),pspCollected:true},
  {...body(0),qaOnly:false},{...body(0),senderPhone:'private'},
  {...body(0),nextState:'completed'}
 ])await assert.rejects(readDriverMotoJourney({...scope,
  request:async()=>response(broken)}),/unavailable/);
 for(const wrong of [{...scope,allowedByOwner:false},
  {...scope,apiOrigin:'http://g188-driver-moto.example'},
  {...scope,apiOrigin:'https://other.example'}])
  await assert.rejects(readDriverMotoJourney({...wrong,
   request:async()=>response(body())}));
 for(const invalid of [{expectedRevision:4,nextState:'arriving'},
  {expectedRevision:2,nextState:'completed'},
  {expectedRevision:5,nextState:'arriving'}]){
  await assert.rejects(advanceDriverMotoJourney({...scope,...invalid,
   commandKey:key,request:async()=>{posts++;return response(body(1));}}));
 }
 assert.equal(posts,0);
});
test('G188 original MOTO POST ambiguous transport never retried',async()=>{
 let writes=0;
 await assert.rejects(advanceDriverMotoJourney({...scope,commandKey:key,
  expectedRevision:2,nextState:'arriving',
  request:async(_,opts)=>{writes++;assert.equal(opts.method,'POST');
   throw Error('after COMMIT lost ACK');}}),/UNKNOWN/);
 assert.equal(writes,1);
});
function fixture({ambiguous=false,stale=false}={}){
 let index=0,writes=0,reads=0,changed=false;
 const controller=createDriverMotoJourneyController({
  readStatus:async()=>{
   reads++;
   return stale&&changed?dto(0):dto(index);
  },
  advanceState:async({expectedRevision,nextState})=>{
   writes++;
   assert.equal(expectedRevision,index+2);
   assert.equal(nextState,next[index]);
   index++;
   changed=true;
   if(ambiguous)throw Error('lost ACK');
   return dto(index);
  },
  makeRequestKey:()=>key
 });
 controller.setSession({role:'driver',userId:owner,accessToken:bearer});
 return {controller,counts:()=>({reads,writes}),setIndex:n=>{index=n}};
}
test('G188 Driver MOTO steps require fresh GET then one POST then fresh GET',async()=>{
 const f=fixture();
 assert.equal((await f.controller.open(booking)).status,'accepted');
 for(let i=1;i<=3;i++){
  const current=await f.controller.advance();
  assert.equal(current.status,states[i]);
  assert.equal(current.revision,i+2);
  assert.equal(current.phase,i===3?'terminal':'active');
 }
 await f.controller.advance();
 assert.deepEqual(f.counts(),{reads:7,writes:3});
});
test('G188 lost ACK keeps MOTO blocked until authenticated original GET proves revision',async()=>{
 const f=fixture({ambiguous:true});
 await f.controller.open(booking);
 assert.equal((await f.controller.advance()).phase,'uncertain');
 assert.equal(f.counts().writes,1);
 await f.controller.advance();
 assert.equal(f.counts().writes,1);
 const confirmed=await f.controller.refresh();
 assert.equal(confirmed.status,'arriving');
 assert.equal(confirmed.phase,'active');
 assert.equal(confirmed.uncertain,false);
 assert.equal(f.counts().writes,1);
});
test('G188 stale GET after a commit never replays MOTO POST; logout clears trip',async()=>{
 const f=fixture({stale:true});
 await f.controller.open(booking);
 assert.equal((await f.controller.advance()).phase,'uncertain');
 assert.equal((await f.controller.refresh()).phase,'uncertain');
 await f.controller.advance();
 assert.equal(f.counts().writes,1);
 f.controller.clear();
 assert.equal(f.controller.current().tripId,null);
 assert.equal(f.controller.current().phase,'signed-out');
 await f.controller.advance();
 assert.equal(f.counts().writes,1);
});
test('G188 no identity, invalid booking or LIVE cannot send MOTO POST',async()=>{
 const f=fixture();
 assert.equal((await f.controller.open('forged')).phase,'unverified');
 assert.equal(f.counts().reads,0);
 assert.equal(f.counts().writes,0);
 f.controller.setSession(null);
 assert.equal((await f.controller.open(booking)).phase,'signed-out');
 assert.throws(()=>createDriverMotoJourneyController({
  readStatus:async()=>{},advanceState:async()=>{},
  makeRequestKey:()=>key,liveEnabled:true
 }));
});
