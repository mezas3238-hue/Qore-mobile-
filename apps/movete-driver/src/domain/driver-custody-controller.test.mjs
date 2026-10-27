import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrivateCourierCustody,transitionPrivateCourierCustody}
 from './driver-custody-http.mjs';
import {createDriverCustodyController} from './driver-custody-controller.mjs';
const id=n=>'66661000-0000-4666-8666-'+String(n).padStart(12,'0');
const driver=id(1),delivery=id(2),key=id(3),proof=id(4),event=id(5);
const bearer='verified-qa-courier-token-000000000000';
const origin='https://api-staging.movetefacil.example';
const scope={apiOrigin:origin,approvedStagingHost:'api-staging.movetefacil.example',
 allowedByOwner:true,accessToken:bearer,deliveryId:delivery};
const steps={accepted:'pickup',picked_up:'deliver',delivered:null,
 disputed:'return',returned:null,cancelled:null};
const status=(state='accepted',revision=2,proofVerified=false)=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,state,revision,
 nextEvent:steps[state],assignmentPersisted:true,proofVerified,
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,
 senderContactVisible:false,gpsVerified:false});
const receipt=(type='pickup')=>({mode:'STAGING_DEMO_ONLY',
 deliveryId:delivery,event:type,eventId:event,serverPersisted:true,
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,retrySafe:false});
const response=(body,status=200)=>({status,redirected:false,json:async()=>body});
test('G66 HTTPS custody GET, pickup and delivery POST use same pinned origin and no actor fields',async()=>{
 const calls=[],request=async(url,init)=>{
  calls.push({url,init});
  return response(init.method==='GET'?status():receipt(JSON.parse(init.body).event));
 };
 const found=await readPrivateCourierCustody({...scope,request});
 assert.equal(found.nextEvent,'pickup');
 assert.equal(found.productionEnabled,false);
 const picked=await transitionPrivateCourierCustody({...scope,
  event:'pickup',eventKey:key,request});
 const delivered=await transitionPrivateCourierCustody({...scope,
  event:'deliver',eventKey:key,proofRef:proof,request});
 assert.equal(picked.serverPersisted,true);
 assert.equal(delivered.event,'deliver');
 assert.deepEqual(calls.map(c=>c.url),[
  origin+'/v1/staging/courier/deliveries/'+delivery+'/custody',
  origin+'/v1/staging/courier/deliveries/'+delivery+'/custody-transition',
  origin+'/v1/staging/courier/deliveries/'+delivery+'/custody-transition'
 ]);
 assert.deepEqual(JSON.parse(calls[1].init.body),{event:'pickup',eventKey:key});
 assert.deepEqual(JSON.parse(calls[2].init.body),{event:'deliver',eventKey:key,proofRef:proof});
 assert(calls.every(c=>c.init.headers.authorization==='Bearer '+bearer));
 assert(!JSON.stringify(found).includes(bearer));
 assert(!JSON.stringify(found).includes(driver));
});
test('G66 HTTP rejects fake proof, unauthorized origin, malformed status, spoofed receipt',async()=>{
 for(const options of [
  {...scope,allowedByOwner:false},
  {...scope,apiOrigin:'http://api-staging.movetefacil.example'},
  {...scope,apiOrigin:'https://attacker.example'}
 ])await assert.rejects(readPrivateCourierCustody({...options,
  request:async()=>response(status())}));
 for(const bad of [
  {...status(),gpsVerified:true}, {...status(),productionEnabled:true},
  {...status(),revision:1},{...status(),nextEvent:'deliver'},
  {...status(),senderPhone:'private'},
  status('delivered',4,false)
 ])await assert.rejects(readPrivateCourierCustody({...scope,
  request:async()=>response(bad)}));
 await assert.rejects(transitionPrivateCourierCustody({...scope,
  event:'deliver',eventKey:key,request:async()=>response(receipt('deliver'))}));
 await assert.rejects(transitionPrivateCourierCustody({...scope,
  event:'pickup',eventKey:key,proofRef:proof,request:async()=>response(receipt())}));
 for(const fake of [
  {...receipt(),liveDeliveriesEnabled:true},
  {...receipt(),eventId:'bad'},
  {...receipt(),senderId:driver},
  {...receipt(),event:'deliver'}
 ])await assert.rejects(transitionPrivateCourierCustody({...scope,
  event:'pickup',eventKey:key,request:async()=>response(fake)}));
});
function scenario({lost=null,proofSource=true}={}){
 let phase='accepted',revision=2,mutations=0,reads=0;
 const posted=[];
 const cfg={
  readStatus:async({accessToken,deliveryId})=>{
   reads++;
   if(accessToken!==bearer||deliveryId!==delivery)throw Error('not assigned');
   return {deliveryId,phase,revision,nextEvent:steps[phase],
    proofVerified:phase==='delivered'||phase==='returned',
    qaOnly:true,productionEnabled:false};
  },
  transition:async args=>{
   posted.push(args);mutations++;
   if(args.accessToken!==bearer||args.deliveryId!==delivery||
    args.event!==steps[phase])throw Error('out of order');
   if(args.event==='deliver'&&args.proofRef!==proof)
    throw Error('missing verified proof');
   phase={pickup:'picked_up',deliver:'delivered',return:'returned'}[args.event];
   revision++;
   if(lost===args.event)throw Error('network lost after COMMIT');
   return {deliveryId:delivery,event:args.event,receiptId:event,
    serverPersisted:true,qaOnly:true,productionEnabled:false};
  },
  makeRequestKey:()=>key,
  ...(proofSource?{obtainVerifiedProof:async()=>({
   deliveryId:delivery,actorId:driver,proofRef:proof,verifiedByServer:true
  })}:{})
 };
 const ctl=createDriverCustodyController(cfg);
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 return {ctl,posted,counts:()=>({mutations,reads}),stage:()=>phase};
}
test('G66 custody follows accepted -> picked_up -> delivered only with independently issued proof',async()=>{
 const f=scenario();
 assert.equal((await f.ctl.open(delivery)).status,'accepted');
 assert.equal((await f.ctl.advance()).status,'picked_up');
 const end=await f.ctl.advance();
 assert.equal(end.status,'delivered');
 assert.equal(end.phase,'terminal');
 assert.equal(end.proofVerified,true);
 await f.ctl.advance();
 assert.equal(f.counts().mutations,2);
 assert.equal(f.counts().reads,3);
 assert.deepEqual(f.posted.map(r=>r.event),['pickup','deliver']);
 assert.equal(f.posted[1].proofRef,proof);
 assert.equal(f.posted[0].proofRef,undefined);
 assert(!JSON.stringify(end).includes(bearer));
 assert(!JSON.stringify(end).includes(proof));
});
test('G66 no real proof registry means no delivery POST or fake completion',async()=>{
 const f=scenario({proofSource:false});
 await f.ctl.open(delivery);
 assert.equal((await f.ctl.advance()).status,'picked_up');
 const s=await f.ctl.advance();
 assert.equal(s.phase,'unverified');
 assert.equal(s.nextEvent,null);
 assert.equal(f.counts().mutations,1);
 assert.equal(f.stage(),'picked_up');
});
test('G66 lost ACK after SQL commit blocks replay and refreshes authoritative state',async()=>{
 const f=scenario({lost:'pickup'});
 await f.ctl.open(delivery);
 assert.equal((await f.ctl.advance()).phase,'uncertain');
 await f.ctl.advance();
 assert.equal(f.counts().mutations,1);
 const confirmed=await f.ctl.refresh();
 assert.equal(confirmed.status,'picked_up');
 assert.equal(confirmed.nextEvent,'deliver');
 assert.equal(confirmed.uncertain,false);
 assert.equal(f.counts().mutations,1);
});
test('G66 malformed proof from injected provider never permits delivery POST',async()=>{
 for(const payload of [
  {deliveryId:delivery,actorId:driver,proofRef:id(88),verifiedByServer:false},
  {deliveryId:delivery,actorId:id(99),proofRef:proof,verifiedByServer:true},
  {deliveryId:id(99),actorId:driver,proofRef:proof,verifiedByServer:true},
  {deliveryId:delivery,actorId:driver,proofRef:'invalid',verifiedByServer:true}
 ]){
  const f=scenario({proofSource:false});
  await f.ctl.open(delivery);
  await f.ctl.advance();
  const other=createDriverCustodyController({
   readStatus:async()=>({deliveryId:delivery,phase:'picked_up',revision:3,
    nextEvent:'deliver',proofVerified:false,qaOnly:true,productionEnabled:false}),
   transition:async()=>{throw Error('must not happen')},makeRequestKey:()=>key,
   obtainVerifiedProof:async()=>payload
  });
  other.setSession({role:'driver',userId:driver,accessToken:bearer});
  await other.open(delivery);
  assert.equal((await other.advance()).phase,'unverified');
 }
});
test('G66 logout while proof is pending discards event and private state',async()=>{
 let release;
 const wait=new Promise(done=>{release=done});
 let posts=0;
 const c=createDriverCustodyController({
  readStatus:async()=>({deliveryId:delivery,phase:'picked_up',revision:3,
   nextEvent:'deliver',proofVerified:false,qaOnly:true,productionEnabled:false}),
  transition:async()=>{posts++;return {}},
  makeRequestKey:()=>key,obtainVerifiedProof:async()=>wait
 });
 c.setSession({role:'driver',userId:driver,accessToken:bearer});
 await c.open(delivery);
 const flight=c.advance();
 c.clear();
 release({deliveryId:delivery,actorId:driver,proofRef:proof,verifiedByServer:true});
 await flight;
 assert.equal(posts,0);
 assert.equal(c.current().phase,'signed-out');
});
test('G66 live mode and missing callbacks are rejected',()=>{
 for(const extra of [
  {liveEnabled:true},{readStatus:null},{transition:null},{makeRequestKey:null}
 ])assert.throws(()=>createDriverCustodyController({
  readStatus:async()=>{},transition:async()=>{},makeRequestKey:()=>key,...extra
 }));
});

test('C Driver delivery foreground GET observes server cancellation, prevents stale pickup',async()=>{
 let phase='accepted',revision=2,posts=0,reads=0;
 const ctl=createDriverCustodyController({
  readStatus:async()=>{reads++;return {deliveryId:delivery,phase,revision,
   nextEvent:steps[phase],proofVerified:false,qaOnly:true,productionEnabled:false};},
  transition:async()=>{posts++;throw Error('No POST after cancellation');},
  makeRequestKey:()=>key
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 assert.equal((await ctl.open(delivery)).status,'accepted');
 phase='cancelled';revision=3;
 const observed=await ctl.poll();
 assert.equal(observed.phase,'terminal');
 assert.equal(observed.status,'cancelled');
 assert.equal(observed.nextEvent,null);
 await ctl.advance();await ctl.poll();
 assert.equal(posts,0);
 assert.equal(reads,2);
});
test('C Driver delivery polling rejects regressed GET and never replays uncertain mutation',async()=>{
 let revision=2,phase='accepted',reads=0,posts=0;
 const ctl=createDriverCustodyController({
  readStatus:async()=>{reads++;return {deliveryId:delivery,phase,revision,
   nextEvent:steps[phase],proofVerified:false,qaOnly:true,productionEnabled:false};},
  transition:async()=>{posts++;phase='picked_up';revision=3;
   throw Error('Lost ACK after SQL COMMIT');},
  makeRequestKey:()=>key
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 await ctl.open(delivery);
 assert.equal((await ctl.poll()).phase,'active');
 revision=1;
 assert.equal((await ctl.poll()).phase,'unverified');
 assert.equal(ctl.current().nextEvent,null);
 revision=2;
 assert.equal((await ctl.refresh()).phase,'active');
 assert.equal((await ctl.advance()).phase,'uncertain');
 const count=reads;
 await ctl.poll();
 assert.equal(reads,count);
 assert.equal(posts,1);
 assert.equal((await ctl.refresh()).status,'picked_up');
 assert.equal(ctl.current().uncertain,false);
});

test('C G66 high-water revision survives multiple stale GETs and prevents courier replay',async()=>{
 let row={phase:'accepted',revision:2,proofVerified:false};
 let posts=0;
 const ctl=createDriverCustodyController({
  readStatus:async()=>({deliveryId:delivery,...row,
   nextEvent:steps[row.phase],qaOnly:true,productionEnabled:false}),
  transition:async()=>{posts++;throw Error('Must not send stale pickup')},
  makeRequestKey:()=>key
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 assert.equal((await ctl.open(delivery)).revision,2);
 row={phase:'picked_up',revision:5,proofVerified:false};
 assert.equal((await ctl.poll()).revision,5);
 row={phase:'accepted',revision:4,proofVerified:false};
 assert.equal((await ctl.refresh()).phase,'unverified');
 assert.equal(ctl.current().nextEvent,null);
 row={phase:'accepted',revision:3,proofVerified:false};
 assert.equal((await ctl.refresh()).phase,'unverified');
 await ctl.advance();assert.equal(posts,0);
 row={phase:'picked_up',revision:5,proofVerified:false};
 assert.equal((await ctl.refresh()).phase,'active');
 assert.equal(ctl.current().nextEvent,'deliver');
});
test('C G66 refuses conflicting same revision and terminal resurrection',async()=>{
 let row={phase:'picked_up',revision:5,proofVerified:false};
 const ctl=createDriverCustodyController({
  readStatus:async()=>({deliveryId:delivery,...row,
   nextEvent:steps[row.phase],qaOnly:true,productionEnabled:false}),
  transition:async()=>{throw Error('unexpected POST')},makeRequestKey:()=>key
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 await ctl.open(delivery);
 row={phase:'accepted',revision:5,proofVerified:false};
 assert.equal((await ctl.refresh()).phase,'unverified');
 row={phase:'returned',revision:6,proofVerified:true};
 assert.equal((await ctl.refresh()).phase,'terminal');
 row={phase:'accepted',revision:7,proofVerified:false};
 assert.equal((await ctl.refresh()).phase,'unverified');
 row={phase:'returned',revision:6,proofVerified:true};
 assert.equal((await ctl.refresh()).phase,'terminal');
});
test('C G66 high-water is scoped to the currently opened delivery and driver',async()=>{
 const id2=id(64);
 let phase='returned',revision=9;
 const ctl=createDriverCustodyController({
  readStatus:async({deliveryId})=>({deliveryId,phase,revision,
   nextEvent:steps[phase],proofVerified:phase==='returned',
   qaOnly:true,productionEnabled:false}),
  transition:async()=>{},makeRequestKey:()=>key
 });
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 assert.equal((await ctl.open(delivery)).phase,'terminal');
 phase='accepted';revision=2;
 assert.equal((await ctl.open(id2)).phase,'active');
 ctl.clear();
 ctl.setSession({role:'driver',userId:driver,accessToken:bearer});
 assert.equal((await ctl.open(delivery)).phase,'active');
});
