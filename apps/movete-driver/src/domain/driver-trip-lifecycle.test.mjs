import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrivateDriverTripStatus,transitionPrivateDriverTrip}
 from './driver-trip-lifecycle-http.mjs';
import {createDriverTripLifecycleController}
 from './driver-trip-lifecycle.mjs';
const id=n=>'65651000-0000-4656-8656-'+String(n).padStart(12,'0');
const driver=id(1),trip=id(2),key=id(3),receipt=id(4);
const bearer='private-verified-driver-token-000000000000';
const origin='https://api-staging.movetefacil.example';
const scope={apiOrigin:origin,
 approvedStagingHost:'api-staging.movetefacil.example',
 allowedByOwner:true,accessToken:bearer,tripId:trip};
function reply(data,status=200){
 return {status,redirected:false,json:async()=>data};
}
const next={accepted:'arrive',arriving:'pickup',
 in_progress:'complete',completed:null,cancelled:null};
const status=(state='accepted',revision=2)=>({
 mode:'STAGING_DEMO_ONLY',tripId:trip,state,revision,
 nextEvent:next[state],assignmentPersisted:true,
 qaOnly:true,productionEnabled:false,liveTripsEnabled:false,
 gpsVerified:false,passengerContactVisible:false});
const command=(event)=>({
 mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
 tripId:trip,event,eventId:receipt,serverPersisted:true
});
test('G65 Driver HTTP reads server status, posts exact event/eventKey, never passes actor',async()=>{
 const calls=[],request=async(url,options)=>{
  calls.push({url,options});
  return reply(options.method==='GET'?status():
   command(JSON.parse(options.body).event));
 };
 const s=await readPrivateDriverTripStatus({...scope,request});
 assert.equal(s.phase,'accepted');assert.equal(s.nextEvent,'arrive');
 const r=await transitionPrivateDriverTrip({...scope,request,
  event:'arrive',eventKey:key});
 assert.equal(r.serverPersisted,true);assert.equal(r.event,'arrive');
 assert.deepEqual(calls.map(x=>x.url),[
  origin+'/v1/staging/driver/trips/'+trip+'/status',
  origin+'/v1/staging/trips/'+trip+'/transition'
 ]);
 assert.deepEqual(JSON.parse(calls[1].options.body),{event:'arrive',eventKey:key});
 assert.equal(calls[1].options.headers.authorization,'Bearer '+bearer);
 assert.equal(calls[0].options.redirect,'error');
 assert(!JSON.stringify(s).includes(bearer));
 assert(!JSON.stringify(s).includes(driver));
});
test('G65 HTTP rejects redirect, forged assigned-trip fields, invalid event and production status',async()=>{
 for(const bad of [
  {...status(),tripId:id(99)}, {...status(),revision:1},
  {...status(),nextEvent:'complete'}, {...status(),gpsVerified:true},
  {...status(),productionEnabled:true}, {...status(),passengerPhone:'private'},
  {...status(),assignmentPersisted:false}
 ]){
  await assert.rejects(readPrivateDriverTripStatus({
   ...scope,request:async()=>reply(bad)}));
 }
 await assert.rejects(transitionPrivateDriverTrip({
  ...scope,event:'cancel',eventKey:key,request:async()=>reply(command('cancel'))
 }));
 await assert.rejects(transitionPrivateDriverTrip({
  ...scope,event:'arrive',eventKey:'bad',request:async()=>reply(command('arrive'))
 }));
 for(const bad of [
  {...command('arrive'),event:'complete'},
  {...command('arrive'),commercialRidesEnabled:true},
  {...command('arrive'),extra:'secret'}
 ])await assert.rejects(transitionPrivateDriverTrip({
  ...scope,event:'arrive',eventKey:key,request:async()=>reply(bad)
 }));
 for(const options of [
  {...scope,apiOrigin:'http://api-staging.movetefacil.example'},
  {...scope,apiOrigin:'https://evil.example'},
  {...scope,allowedByOwner:false}
 ])await assert.rejects(readPrivateDriverTripStatus({
  ...options,request:async()=>reply(status())
 }));
});
function driverScenario({unknownAt=null}={}){
 let current='accepted',revision=2,commands=0,reads=0,actor=driver;
 const keyMap={arrive:id(11),pickup:id(12),complete:id(13)};
 const transitions=[];
 const adapters={
  makeRequestKey:async()=>keyMap[
   current==='accepted'?'arrive':current==='arriving'?'pickup':'complete'
  ],
  readStatus:async({accessToken,tripId})=>{
   reads++;
   if(accessToken!==bearer||tripId!==trip)throw Error('unauthorized');
   return {tripId:trip,phase:current,revision,
    nextEvent:next[current],qaOnly:true,productionEnabled:false};
  },
  transition:async({accessToken,tripId,event,eventKey})=>{
   commands++;transitions.push({tripId,event,eventKey,accessToken});
   if(accessToken!==bearer||tripId!==trip)throw Error('not authorized');
   const expected=next[current];
   if(event!==expected)throw Error('wrong state');
   current={arrive:'arriving',pickup:'in_progress',complete:'completed'}[event];
   revision++;
   if(unknownAt===event)throw Error('HTTP lost AFTER DB COMMIT');
   return {tripId:trip,event,receiptId:id(99),
    serverPersisted:true,qaOnly:true,productionEnabled:false};
  }
 };
 const ctl=createDriverTripLifecycleController(adapters);
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 return {ctl,transitions,counts:()=>({commands,reads}),
  status:()=>current,swapped:()=>{actor=id(80);
   ctl.setSession({role:'driver',userId:actor,accessToken:bearer});}};
}
test('G65 trip lifecycle accepted -> arriving -> in_progress -> completed no skip',async()=>{
 const f=driverScenario();
 assert.equal((await f.ctl.open(trip)).status,'accepted');
 for(const [event,expected] of [
  ['arrive','arriving'],['pickup','in_progress'],['complete','completed']
 ]){
  assert.equal(f.ctl.current().nextEvent,event);
  const result=await f.ctl.advance();
  assert.equal(result.status,expected);
  assert.equal(result.uncertain,false);
 }
 assert.equal(f.ctl.current().phase,'terminal');
 assert.equal(f.ctl.current().nextEvent,null);
 await f.ctl.advance();
 assert.equal(f.counts().commands,3);
 assert.equal(f.counts().reads,4);
 assert.deepEqual(f.transitions.map(x=>x.event),['arrive','pickup','complete']);
 assert(!JSON.stringify(f.ctl.current()).includes(bearer));
});
test('G65 lost COMMIT blocks next POST until explicit authoritative status GET',async()=>{
 const f=driverScenario({unknownAt:'arrive'});
 await f.ctl.open(trip);
 const outcome=await f.ctl.advance();
 assert.equal(outcome.phase,'uncertain');
 assert.equal(outcome.nextEvent,null);
 await f.ctl.advance();
 assert.equal(f.counts().commands,1);
 const verified=await f.ctl.refresh();
 assert.equal(verified.status,'arriving');
 assert.equal(verified.phase,'active');
 assert.equal(verified.nextEvent,'pickup');
 assert.equal(f.counts().commands,1);
});
test('G65 wrong trip and missing Auth cannot issue lifecycle event',async()=>{
 const f=driverScenario();
 assert.equal((await f.ctl.open(id(99))).phase,'offline');
 assert.equal(f.counts().commands,0);
 f.ctl.clear();
 assert.equal((await f.ctl.open(trip)).phase,'signed-out');
 assert.equal((await f.ctl.advance()).phase,'signed-out');
});
test('G65 logout while POST is pending cannot restore private data or enable next event',async()=>{
 let finish;
 const posted=new Promise(r=>{finish=r});
 const ctl=createDriverTripLifecycleController({
  makeRequestKey:()=>key,
  readStatus:async()=>({tripId:trip,phase:'accepted',revision:2,
   nextEvent:'arrive',qaOnly:true,productionEnabled:false}),
  transition:async()=>posted
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 await ctl.open(trip);
 const flight=ctl.advance();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 ctl.clear();
 finish({tripId:trip,event:'arrive',receiptId:receipt,
  serverPersisted:true,qaOnly:true,productionEnabled:false});
 await flight;
 assert.equal(ctl.current().phase,'signed-out');
 assert.equal(ctl.current().tripId,null);
});
test('G65 unverified server status fails closed instead of advancing',async()=>{
 const ctl=createDriverTripLifecycleController({
  makeRequestKey:()=>key,transition:async()=>{throw Error('should not post');},
  readStatus:async()=>({tripId:trip,phase:'searching',revision:1,
   nextEvent:'arrive',qaOnly:true,productionEnabled:false})
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 assert.equal((await ctl.open(trip)).phase,'unverified');
 assert.equal((await ctl.advance()).phase,'unverified');
 assert.throws(()=>createDriverTripLifecycleController({liveEnabled:true,
  makeRequestKey:()=>key,readStatus:async()=>{},transition:async()=>{}}));
});
