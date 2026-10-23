import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
const a='123e4567-e89b-42d3-a456-426614174000';
const b='123e4567-e89b-42d3-a456-426614174001';
const trip='123e4567-e89b-42d3-a456-426614174002';
const quoteId='123e4567-e89b-42d3-a456-426614174003';
const key='123e4567-e89b-42d3-a456-426614174004';
const now=1700000000000;
const ride={requestKey:key,originTag:'San Lorenzo centro',destinationTag:'Asunción centro',service:'economico'};
const fakeSession=(subject=a)=>({subject,role:'passenger',expiresAt:now+120000,token:'synthetic-jwt-only-test-abcdef'});
const fakeQuote=(ownerId=a)=>({
 ownerId,quoteId,subjectId:trip,subjectKind:'RIDE',fareMode:'AUTO',amountGs:15500,
 expiresAt:now+60000,fareVersion:'QA-G7',routingVerified:true
});
const fakeTrip=(ownerId=a)=>({
 tripId:trip,ownerId,revision:1,state:'assigned',assignmentPersisted:true,
 driver:{displayName:'Conductor QA',verified:true},vehicle:{kind:'AUTO',plate:'QA-123'},
 gpsConsent:true,location:{latitude:-25.3,longitude:-57.6,observedAt:now-1000},
 etaVerified:true,etaMinutes:5
});
const fakeHistory=(ownerId=a)=>({
 ownerId,generatedAt:now-1000,expiresAt:now+60000,nextCursor:null,
 items:[{serviceId:trip,kind:'RIDE',status:'assigned',createdAt:now-3000,revision:1}]
});
function fixture(session=fakeSession(),response=async()=>({ok:false,code:'NOT_CONFIGURED'})){
 let auth=session;
 const api=createClientExperience({
  now:()=>now,
  authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  gateway:{send:response}
 });
 return {api,setSession:next=>auth=next};
}
test('sin Auth y sin gateway jamás prepara solicitudes ni muestra datos',async()=>{
 const api=createClientExperience();
 assert.equal((await api.refreshSession()).ok,false);
 assert.equal(api.prepareRide(ride).code,'AUTH_REQUIRED');
 assert.equal(api.startTracking(trip).code,'AUTH_REQUIRED');
 assert.equal(api.acceptQuote(fakeQuote()),false);
 assert.equal(api.acceptHistory(fakeHistory()),false);
 assert.equal(api.snapshot().authenticated,false);
});
test('viaje y reintento usan el mismo requestKey, sin crear IDs de servidor',async()=>{
 let n=0;const sent=[];
 const {api}=fixture(fakeSession(),async(op,{body})=>{
  sent.push([op,body.requestKey]);n++;
  return n===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true,status:201,data:{notCertified:true}};
 });
 assert.equal((await api.refreshSession()).ok,true);
 assert.equal(api.prepareRide(ride).ok,true);
 assert.equal((await api.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await api.retry()).ok,true);
 assert.deepEqual(sent,[['rideRequest',key],['rideRequest',key]]);
 assert.equal(Object.hasOwn(api.snapshot().mutation,'tripId'),false);
});
test('proyecta cotización, tracking e historial propios sin guardarlos en disco',async()=>{
 const {api}=fixture(fakeSession(),async op=>op==='rideStatus'
  ?{ok:true,data:fakeTrip()}:{ok:false,code:'OPERATION_DENIED'});
 await api.refreshSession();
 assert.equal(api.acceptQuote(fakeQuote()),true);
 assert.equal(api.acceptHistory(fakeHistory()),true);
 assert.equal(api.startTracking(trip).ok,true);
 assert.equal((await api.syncTracking()).ok,true);
 const snap=api.snapshot();
 assert.equal(snap.quote.amountGs,15500);
 assert.equal(snap.history.items.length,1);
 assert.equal(snap.tracking.assignedDriver.plate,'QA-123');
 assert.equal(snap.tracking.etaMinutes,5);
 assert.equal(Object.hasOwn(snap.account,'token'),false);
});
test('nunca acepta precio o historial de otra cuenta',async()=>{
 const {api}=fixture();
 await api.refreshSession();
 assert.equal(api.acceptQuote(fakeQuote(b)),false);
 assert.equal(api.acceptHistory(fakeHistory(b)),false);
 assert.equal(api.snapshot().quote,null);
 assert.equal(api.snapshot().history,null);
});
test('cambio de cuenta borra GPS, cotización, historial y request en curso',async()=>{
 const f=fixture(fakeSession(),async()=>({ok:true,data:fakeTrip()}));
 const {api,setSession}=f;
 await api.refreshSession();
 api.acceptQuote(fakeQuote());
 api.acceptHistory(fakeHistory());
 api.prepareRide(ride);
 api.startTracking(trip);await api.syncTracking();
 setSession(fakeSession(b));
 assert.equal((await api.refreshSession()).ok,true);
 const s=api.snapshot();
 assert.equal(s.account.subject,b);
 assert.equal(s.quote,null);
 assert.equal(s.history,null);
 assert.equal(s.tracking.assignedDriver,null);
 assert.equal(s.mutation.phase,'idle');
});
test('logout en fallo de revocación remota siempre borra datos de Cliente',async()=>{
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{throw Error('sin red')}},
  gateway:{send:async()=>({ok:false,code:'SERVICE_UNAVAILABLE'})}});
 await api.refreshSession();
 api.acceptQuote(fakeQuote());
 assert.equal((await api.signOut()).code,'SERVER_REVOCATION_UNCONFIRMED');
 assert.equal(api.snapshot().authenticated,false);
 assert.equal(api.snapshot().quote,null);
});
test('sin señal retira GPS/ETA pero no inventa cambio de viaje',async()=>{
 const {api}=fixture(fakeSession(),async()=>({ok:true,data:fakeTrip()}));
 await api.refreshSession();api.startTracking(trip);await api.syncTracking();
 api.connectionLost();
 assert.equal(api.snapshot().tracking.etaMinutes,null);
 assert.equal(api.snapshot().tracking.position,null);
 assert.equal(api.snapshot().tracking.state,'assigned');
});
test('un rol driver no puede activar el coordinador de Cliente',async()=>{
 const f=fixture({...fakeSession(),role:'driver'});
 assert.equal((await f.api.refreshSession()).ok,false);
 assert.equal(f.api.startTracking(trip).code,'AUTH_REQUIRED');
});
test('la respuesta tardía después de cerrar sesión se descarta',async()=>{
 let done;
 const delay=new Promise(resolve=>done=resolve);
 const {api}=fixture(fakeSession(),async()=>delay);
 await api.refreshSession();api.startTracking(trip);
 const pending=api.syncTracking();
 await Promise.resolve();await Promise.resolve();
 await api.signOut();
 done({ok:true,data:fakeTrip()});
 assert.equal((await pending).code,'STALE_RESPONSE_IGNORED');
 assert.equal(api.snapshot().tracking.assignedDriver,null);
});

test('notificación de vista y unsubscribe mantienen estado seguro',async()=>{
 const {api}=fixture();
 let updates=0;
 const unsubscribe=api.subscribe(()=>updates++);
 await api.refreshSession();
 assert.equal(updates,1);
 api.acceptQuote(fakeQuote());
 assert.equal(updates,2);
 unsubscribe();
 await api.signOut();
 assert.equal(updates,2);
 assert.equal(api.snapshot().quote,null);
});
test('cotización vencida desaparece al consultar snapshot, incluso sin otros eventos',async()=>{
 let clock=now;
 const api=createClientExperience({now:()=>clock,
  authProvider:{readSession:async()=>({...fakeSession(),expiresAt:now+180000}),signOut:async()=>{}}});
 await api.refreshSession();
 assert.equal(api.acceptQuote(fakeQuote()),true);
 assert.equal(api.snapshot().quote.amountGs,15500);
 clock=now+60001;
 assert.equal(api.snapshot().quote,null);
});
test('un listener defectuoso no bloquea el cierre de sesión',async()=>{
 const {api}=fixture();
 await api.refreshSession();
 api.subscribe(()=>{throw Error('listener de QA');});
 assert.equal((await api.signOut()).ok,true);
 assert.equal(api.snapshot().authenticated,false);
});
