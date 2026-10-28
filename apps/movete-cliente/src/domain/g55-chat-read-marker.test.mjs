import test from 'node:test';
import assert from 'node:assert/strict';
import {validateG55ReadMarkerEnvelope,createG55ExplicitVisibleReadFlow}
 from './g55-chat-read-marker.mjs';

const time=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const owner=id(1),serviceId=id(2),conversationId=id(3),
 passengerMessage=id(4),driverMessage=id(5),marker=id(6);
const row=(messageId,senderRole,createdAt)=>({
 messageId,senderRole,body:'Voy en camino',createdAt,revision:7
});
const page=()=>({conversationId,serviceId,serviceKind:'RIDE',ownerId:owner,
 counterpartRole:'driver',assignmentVerified:true,state:'ACTIVE',
 revision:7,generatedAt:time-1000,expiresAt:time+60000,
 messages:[row(passengerMessage,'passenger',time-2000),
  row(driverMessage,'driver',time-3000)],
 nextCursor:null,canSend:true,productionEnabled:false});
const envelope=()=>({page:page(),
 readMarker:{marker,messageId:driverMessage,expiresAtMs:time+10000},
 qaOnly:true,productionEnabled:false});
const scope={serviceId,serviceKind:'RIDE',subject:owner,
 expectedConversationId:conversationId,sessionRevision:8};
const check=x=>validateG55ReadMarkerEnvelope(x,{...scope,now:time});
const visible={conversationId,messageId:driverMessage,subject:owner,
 sessionRevision:8,fullyVisible:true,appForeground:true};
const ack={conversationId,messageId:driverMessage,readConfirmed:true,qaOnly:true};

test('R34 valida envelope G55 exacto, Driver visible y purga duplicados',()=>{
 const r=check(envelope());
 assert.equal(r.ok,true);
 assert.equal(r.data.readMarker.messageId,driverMessage);
 assert.equal(Object.isFrozen(r.data.page.messages[0]),true);
 assert.equal(Object.isFrozen(r.data.readMarker),true);
 assert.equal(check({...envelope(),readMarker:null}).ok,true);
});
test('R34 jamás acepta marker de Passenger u otro hilo, rol o propietario',()=>{
 for(const dto of [
  {...envelope(),readMarker:{marker,messageId:passengerMessage,
   expiresAtMs:time+10000}},
  {...envelope(),readMarker:{marker,messageId:id(70),
   expiresAtMs:time+10000}},
  {...envelope(),page:{...page(),conversationId:id(70)}},
  {...envelope(),page:{...page(),ownerId:id(70)}},
  {...envelope(),page:{...page(),assignmentVerified:false}},
  {...envelope(),page:{...page(),state:'CLOSED'}},
  {...envelope(),page:{...page(),messages:[row(passengerMessage,'passenger',time-2000)]}}
 ])assert.equal(check(dto).ok,false);
});
test('R34 falla ante expiración, marker malformado o colado, no inventa seq',()=>{
 for(const readMarker of [
  {marker,messageId:driverMessage,expiresAtMs:time},
  {marker,messageId:driverMessage,expiresAtMs:time+90000},
  {marker:'../../seq=4',messageId:driverMessage,expiresAtMs:time+10000},
  {marker,messageId:driverMessage,expiresAtMs:time+10000,throughSeq:123},
  {marker,messageId:driverMessage,expiresAtMs:0.5},
  'opaque',
  undefined
 ])assert.equal(check({...envelope(),readMarker}).ok,false);
 assert.equal(check({...envelope(),throughSeq:9}).ok,false);
});
test('R34 protege mensajes, memoria y página exacta',()=>{
 for(const dto of [
  {...envelope(),page:{...page(),productionEnabled:true}},
  {...envelope(),page:{...page(),messages:[
   row(driverMessage,'driver',time-2000),
   row(driverMessage,'driver',time-3000)]}},
  {...envelope(),page:{...page(),messages:[
   {...row(driverMessage,'driver',time-2000),body:'tel +595 981 234567'}]}},
  {...envelope(),page:{...page(),nextCursor:'../older'}},
  {...envelope(),page:{...page(),messages:[],nextCursor:'v'.repeat(44)}},
  {...envelope(),qaOnly:false},
  {...envelope(),productionEnabled:true}
 ])assert.equal(check(dto).ok,false);
});
test('R34 GET aceptado NO dispara POST automático ni decrementa unread',async()=>{
 let hits=0;
 const transport={isConfigured:()=>true,markVisible:async()=>{hits++;return {ok:true,data:ack};}};
 const f=createG55ExplicitVisibleReadFlow({transport,now:()=>time});
 assert.equal(f.acceptPage(envelope(),scope).ok,true);
 assert.equal(f.snapshot().hasMarker,true);
 assert.equal(hits,0);
 assert.equal(f.snapshot().readConfirmed,false);
 assert.equal((await f.markVisible({...visible,fullyVisible:false})).code,
  'G55_EXPLICIT_VISIBILITY_REQUIRED');
 assert.equal((await f.markVisible({...visible,appForeground:false})).code,
  'G55_EXPLICIT_VISIBILITY_REQUIRED');
 assert.equal(hits,0);
 assert.equal((await f.markVisible(visible)).readConfirmed,true);
 assert.equal(hits,1);
 assert.equal((await f.markVisible(visible)).code,'G55_ALREADY_CONFIRMED');
 assert.equal(hits,1);
});
test('R34 NO dispara POST en OFF, revocación, reasignación o scope cruzado',async()=>{
 let hits=0;
 const transport={isConfigured:()=>false,markVisible:async()=>{hits++;return {ok:true,data:ack};}};
 const f=createG55ExplicitVisibleReadFlow({transport,now:()=>time});
 f.acceptPage(envelope(),scope);
 assert.equal((await f.markVisible(visible)).code,'G55_RUNTIME_NOT_CERTIFIED');
 assert.equal((await f.markVisible({...visible,conversationId:id(98)})).code,
  'G55_STALE_SCOPE');
 assert.equal((await f.markVisible({...visible,subject:id(99)})).code,'G55_STALE_SCOPE');
 f.clear();
 assert.equal((await f.markVisible(visible)).code,'G55_NO_AUTHORIZED_VISIBLE_MARKER');
 assert.equal(hits,0);
});
test('R34 un ACK falso, 200 vacío o error no significa leído',async()=>{
 for(const outcome of [
  {ok:true,data:{...ack,readConfirmed:false}},
  {ok:true,data:{...ack,messageId:passengerMessage}},
  {ok:true,data:{...ack,qaOnly:false}},
  {ok:true,data:{...ack,seq:777}},
  {ok:false,code:'TIMEOUT'},null
 ]){
  const f=createG55ExplicitVisibleReadFlow({now:()=>time,
   transport:{isConfigured:()=>true,markVisible:async()=>outcome}});
  f.acceptPage(envelope(),scope);
  assert.equal((await f.markVisible(visible)).code,'G55_READ_UNCONFIRMED');
  assert.equal(f.snapshot().readConfirmed,false);
 }
});
test('R34 doble toque bloquea concurrencia ANTES de await',async()=>{
 let release,called=0;
 const f=createG55ExplicitVisibleReadFlow({now:()=>time,
  transport:{isConfigured:()=>true,markVisible:async()=>{called++;
   return new Promise(resolve=>{release=()=>resolve({ok:true,data:ack});});}}});
 f.acceptPage(envelope(),scope);
 const first=f.markVisible(visible);
 assert.equal((await f.markVisible(visible)).code,'G55_MARK_IN_FLIGHT');
 release();
 assert.equal((await first).ok,true);
 assert.equal(called,1);
});
test('R34 logout durante POST descarta ACK tardío sin resucitar marcador',async()=>{
 let finish;
 const f=createG55ExplicitVisibleReadFlow({now:()=>time,
  transport:{isConfigured:()=>true,
   markVisible:async()=>new Promise(resolve=>{finish=resolve;}),
   cancelPending:()=>{}}});
 f.acceptPage(envelope(),scope);
 const request=f.markVisible(visible);
 f.clear();
 finish({ok:true,data:ack});
 assert.equal((await request).code,'G55_STALE_SCOPE');
 assert.equal(f.snapshot().readConfirmed,false);
 assert.equal(f.snapshot().hasMarker,false);
});
test('R34 marcador expirado no se utiliza aunque POST devuelva éxito',async()=>{
 let clock=time,finish,hits=0;
 const f=createG55ExplicitVisibleReadFlow({now:()=>clock,
  transport:{isConfigured:()=>true,markVisible:async()=>{hits++;
   return new Promise(resolve=>{finish=resolve;});}}});
 f.acceptPage(envelope(),scope);
 clock=time+10001;
 assert.equal((await f.markVisible(visible)).code,'G55_MARKER_EXPIRED');
 assert.equal(hits,0);
 clock=time;
 f.acceptPage(envelope(),scope);
 const pending=f.markVisible(visible);
 clock=time+10001;
 finish({ok:true,data:ack});
 assert.equal((await pending).code,'G55_MARKER_EXPIRED');
 assert.equal(f.snapshot().readConfirmed,false);
});
