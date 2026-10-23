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

const signedCursor=payload=>'v1.'+payload+'.'+'s'.repeat(43);
const historyResp=(payload)=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const historyOptions=fetchImpl=>({
 enabled:true,contractCertified:true,origin:'https://staging.example.invalid',
 pinnedOrigin:'https://staging.example.invalid',fetchImpl
});
test('historial del pasajero no usa red ni permite carga sin contrato certificado',async()=>{
 const api=createClientExperience({now:()=>now,authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:{...historyOptions(async()=>{throw Error('red prohibida');}),contractCertified:false}});
 await api.refreshSession();
 assert.equal(api.snapshot().historyConfigured,false);
 assert.equal((await api.loadHistoryPage({reset:true})).code,'HISTORY_CONTRACT_PENDING');
});
test('cliente recorre 120 páginas de historial de un usuario sin límite total',async()=>{
 const urls=[];
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:historyOptions(async (url,req)=>{
   urls.push([url,req.headers['X-Qore-History-Cursor']??null]);
   const match=(req.headers['X-Qore-History-Cursor']??'').match(/v1\.p_(\d+)\./);
   const number=match?Number(match[1]):1;
   return historyResp({...fakeHistory(),
    items:[{serviceId:'123e4567-e89b-42d3-a456-'+String(number).padStart(12,'0'),
      kind:'RIDE',status:'completed',createdAt:now-3000,revision:1}],
    nextCursor:number>=120?null:signedCursor('p_'+(number+1))});
  })
 });
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 for(let n=2;n<=120;n++)assert.equal((await api.loadHistoryPage()).ok,true);
 assert.equal(api.snapshot().history.items.length,120);
 assert.equal(api.snapshot().history.nextCursor,null);
 assert.equal((await api.loadHistoryPage()).code,'NO_ADDITIONAL_PAGE');
 assert.equal(urls.length,120);
 assert.equal(urls[1][0],'https://staging.example.invalid/v1/staging/rider/history');
 assert.equal(urls[1][1],signedCursor('p_2'));
});
test('página con propietario ajeno se rechaza y no muestra historial privado',async()=>{
 const api=createClientExperience({now:()=>now,authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:historyOptions(async()=>historyResp(fakeHistory(b)))});
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).code,'INVALID_HISTORY_DTO');
 assert.equal(api.snapshot().history,null);
});
test('logout durante historial pendiente nunca restaura viajes de sesión antigua',async()=>{
 let resolve;
 const wait=new Promise(done=>resolve=done);
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  historyGatewayOptions:historyOptions(async()=>wait)
 });
 await api.refreshSession();
 const task=api.loadHistoryPage({reset:true});
 await Promise.resolve();await Promise.resolve();
 await api.signOut();
 resolve(historyResp(fakeHistory()));
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(api.snapshot().authenticated,false);
 assert.equal(api.snapshot().history,null);
});
test('cursor circular no repite páginas ni hace solicitudes ilimitadas',async()=>{
 let n=0;
 const api=createClientExperience({now:()=>now,authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:historyOptions(async()=>{
   n++;return historyResp({...fakeHistory(),nextCursor:signedCursor('loop')});
  })
 });
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 assert.equal((await api.loadHistoryPage()).code,'CURSOR_REPEATED');
 assert.equal(n,2);
});

test('cursor vencido permite reiniciar manualmente desde primera página sin mezclar registros',async()=>{
 let n=0;
 const requests=[];
 const api=createClientExperience({now:()=>now,authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:historyOptions(async (url,req)=>{
   requests.push(req.headers['X-Qore-History-Cursor']??null);
   n++;
   if(n===2)return {ok:false,status:400,redirected:false};
   return historyResp({...fakeHistory(),nextCursor:n===1?signedCursor('page_2'):null});
  })
 });
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 assert.equal((await api.loadHistoryPage()).code,'INVALID_OR_EXPIRED_CURSOR');
 assert.equal(api.snapshot().historyLoadError,'INVALID_OR_EXPIRED_CURSOR');
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 assert.deepEqual(requests,[null,signedCursor('page_2'),null]);
 assert.equal(api.snapshot().historyLoadError,null);
});

test('cursor expirado borra historiales parcialmente cargados antes de reiniciar',async()=>{
 let attempt=0;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  historyGatewayOptions:historyOptions(async()=>{
   attempt++;
   return attempt===1?historyResp({...fakeHistory(),nextCursor:signedCursor('page_2')})
    :{status:400,ok:false,redirected:false};
  })
 });
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 assert.equal(api.snapshot().history.items.length,1);
 assert.equal((await api.loadHistoryPage()).code,'INVALID_OR_EXPIRED_CURSOR');
 assert.equal(api.snapshot().history,null);
 assert.equal(api.snapshot().historyLoadError,'INVALID_OR_EXPIRED_CURSOR');
});
test('relogin de mismo usuario con token nuevo borra cotización e historial privado',async()=>{
 let incoming=fakeSession();
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>incoming,signOut:async()=>{}}
 });
 await api.refreshSession();
 api.acceptQuote(fakeQuote());api.acceptHistory(fakeHistory());
 assert.equal(api.snapshot().history.items.length,1);
 incoming={...incoming,token:'synthetic-new-passenger-token-987654321'};
 assert.equal((await api.refreshSession()).ok,true);
 assert.equal(api.snapshot().history,null);
 assert.equal(api.snapshot().quote,null);
});

test('TTL de historial vencido inicia nueva secuencia sin falsos cursores repetidos',async()=>{
 let clock=now,hits=0;
 const nextCursor=signedCursor('cursor2');
 const third=signedCursor('cursor3');
 const seen=[];
 const api=createClientExperience({
  now:()=>clock,
  authProvider:{readSession:async()=>({...fakeSession(),expiresAt:now+180000})},
  historyGatewayOptions:historyOptions(async(_url,req)=>{
   const cursor=req.headers['X-Qore-History-Cursor']??null;
   seen.push(cursor);hits++;
   return historyResp({...fakeHistory(),generatedAt:clock-1000,
    expiresAt:clock+60000,nextCursor:
     hits===1?nextCursor:hits===2?third:hits===3?nextCursor:null});
  })
 });
 await api.refreshSession();
 assert.equal((await api.loadHistoryPage({reset:true})).ok,true);
 assert.equal((await api.loadHistoryPage()).ok,true);
 assert.equal(api.snapshot().history.nextCursor,third);
 clock=now+61000;
 assert.equal(api.snapshot().history,null);
 assert.equal((await api.loadHistoryPage()).ok,true);
 assert.equal(api.snapshot().history.nextCursor,nextCursor);
 assert.deepEqual(seen,[null,nextCursor,null]);
});

test('cancelación QA propia usa estado de viaje y ACK servidor, sin alterar estado local',async()=>{
 const receipt={mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
  tripId:trip,event:'cancel',eventId:key,serverPersisted:true};
 const response={ok:true,status:200,redirected:false,
  headers:{get:k=>k==='content-type'?'application/json':null},
  text:async()=>JSON.stringify(receipt)};
 const calls=[];
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  gateway:{send:async()=>({ok:true,data:fakeTrip()})},
  cancelGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async(url,init)=>{calls.push([url,JSON.parse(init.body)]);return response;}}
 });
 await app.refreshSession();
 assert.equal(app.startTracking(trip).ok,true);
 assert.equal((await app.syncTracking()).ok,true);
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:key}).ok,true);
 assert.equal((await app.submitCancelRide()).ok,true);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0][1],{requestKey:key});
 assert.equal(app.snapshot().tracking.state,'assigned');
 assert.equal(app.snapshot().cancellation.phase,'acknowledged');
 assert.equal((await app.submitCancelRide()).code,'NO_READY_CANCEL');
});
test('sin contrato o sin viaje activo Cliente jamás emite cancelación',async()=>{
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},cancelGatewayOptions:null
 });
 await app.refreshSession();
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:key}).code,'CANCEL_CONTRACT_PENDING');
 assert.equal(app.snapshot().cancellation.contractReady,false);
});
test('logout elimina solicitud preparada de cancelación en el mismo tick',async()=>{
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  gateway:{send:async()=>({ok:true,data:fakeTrip()})},
  cancelGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{throw Error('sin red');}}
 });
 await app.refreshSession();app.startTracking(trip);await app.syncTracking();
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:key}).ok,true);
 await app.signOut();
 assert.equal(app.snapshot().cancellation.phase,'idle');
 assert.equal(app.snapshot().cancellation.requestKey,null);
});
