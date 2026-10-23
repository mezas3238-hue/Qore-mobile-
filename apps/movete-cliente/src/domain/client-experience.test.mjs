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

test('ACK de cancelación dispara GET status autoritativo, no cambia estado optimistamente',async()=>{
 const receipt={mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
  tripId:trip,event:'cancel',eventId:key,serverPersisted:true};
 let statusReads=0,cancelWrites=0;
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  gateway:{send:async op=>{if(op==='rideStatus'){statusReads++;return {ok:true,data:fakeTrip()};}
   return {ok:false,code:'DENIED'};}},
  cancelGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{cancelWrites++;return {ok:true,status:200,redirected:false,
    headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify(receipt)};}}
 });
 await app.refreshSession();app.startTracking(trip);await app.syncTracking();
 assert.equal(statusReads,1);
 app.prepareCancelRide({tripId:trip,requestKey:key});
 const answer=await app.submitCancelRide();
 assert.equal(answer.ok,true);assert.equal(answer.refreshAttempted,true);
 assert.equal(answer.statusRefreshed,true);assert.equal(statusReads,2);
 assert.equal(cancelWrites,1);
 assert.equal(app.snapshot().tracking.state,'assigned');
});
test('409 de cancelación fuerza relectura GET y no permite un nuevo UUID',async()=>{
 let statusReads=0;
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  gateway:{send:async()=>{statusReads++;return {ok:true,data:fakeTrip()};}},
  cancelGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>({ok:false,status:409,redirected:false})}
 });
 await app.refreshSession();app.startTracking(trip);await app.syncTracking();
 app.prepareCancelRide({tripId:trip,requestKey:key});
 const response=await app.submitCancelRide();
 assert.equal(response.code,'CONFLICT_RELOAD_TRIP');
 assert.equal(response.refreshAttempted,true);
 assert.equal(statusReads,2);
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:quoteId}).code,'RELOAD_TRIP_BEFORE_NEW_CANCEL');
});

test('status tipado G11 se consulta por HTTP y se proyecta únicamente para pasajero propio',async()=>{
 const receipt={tripId:trip,ownerId:a,revision:2,state:'assigned',
  assignmentPersisted:true,driver:{verified:true,displayName:'Chofer QA'},
  vehicle:{kind:'AUTO',plate:'QA-2026'},gpsConsent:true,
  location:{latitude:-25.3,longitude:-57.6,observedAt:now-1000},
  etaVerified:true,etaMinutes:4,mode:'STAGING_DEMO_ONLY',
  commercialRidesEnabled:false,locationVisible:true,deliveryConfirmed:false,
  event:{source:'server',tripId:trip,passengerId:a,serverRevision:2,trackingSequence:5,
   status:'accepted',acceptedDriver:null,tracking:null}};
 let calls=0;
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  gateway:{send:async()=>{throw Error('no generic gateway for status');}},
  statusGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{calls++;return {ok:true,status:200,redirected:false,
    headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify(receipt)};}}
 });
 await app.refreshSession();app.startTracking(trip);
 assert.equal((await app.syncTracking()).ok,true);
 assert.equal(calls,1);
 assert.equal(app.snapshot().tracking.assignedDriver.plate,'QA-2026');
 assert.equal(app.snapshot().tracking.liveEnabled,false);
});


test('cancelación más GET tipado muestra Cancelado solo tras revisión persistida',async()=>{
 const legacy=(revision,status)=>({source:'server',tripId:trip,passengerId:a,
  serverRevision:revision,trackingSequence:revision,status,
  acceptedDriver:null,tracking:null});
 const assigned={tripId:trip,ownerId:a,revision:2,state:'assigned',
  assignmentPersisted:true,driver:{verified:true,displayName:'Chofer QA'},
  vehicle:{kind:'AUTO',plate:'QA-2026'},gpsConsent:false,location:null,
  etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
  commercialRidesEnabled:false,locationVisible:false,deliveryConfirmed:false,
  event:legacy(2,'accepted')};
 const cancelled={...assigned,revision:3,state:'cancelled',
  assignmentPersisted:false,driver:null,vehicle:null,event:legacy(3,'cancelled')};
 const receipt={mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
  tripId:trip,event:'cancel',eventId:key,serverPersisted:true};
 let statusHits=0,writes=0;
 const okBody=data=>({ok:true,status:200,redirected:false,
  headers:{get:k=>k==='content-type'?'application/json':null},
  text:async()=>JSON.stringify(data)});
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  statusGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{statusHits++;return okBody(statusHits===1?assigned:cancelled);}},
  cancelGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{writes++;return okBody(receipt);}}
 });
 await app.refreshSession();app.startTracking(trip);
 assert.equal((await app.syncTracking()).ok,true);
 assert.equal(app.snapshot().tracking.state,'assigned');
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:key}).ok,true);
 // Preparar una solicitud jamás modifica el status antes del POST/GET.
 assert.equal(app.snapshot().tracking.state,'assigned');
 const result=await app.submitCancelRide();
 assert.equal(result.ok,true);
 assert.equal(result.statusRefreshed,true);
 assert.equal(statusHits,2);assert.equal(writes,1);
 assert.equal(app.snapshot().tracking.state,'cancelled');
 assert.equal(app.snapshot().tracking.revision,3);
 assert.equal(app.snapshot().tracking.assignedDriver,null);
 assert.equal(app.snapshot().tracking.position,null);
 assert.equal(app.prepareCancelRide({tripId:trip,requestKey:quoteId}).code,
  'CANCEL_REQUIRES_ACTIVE_RIDE');
});


test('G24 integra precio firmado por autoridad QA solo después de viaje propio',async()=>{
 const verified={mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,serverPriced:true,
  ownerId:a,quoteId,amountGs:22500,fareMode:'AUTO',subjectKind:'RIDE',
  subjectId:trip,expiresAt:now+60000,fareVersion:'g24-1',routingVerified:true,
  quote:{id:quoteId,mode:'AUTO',subjectKind:'RIDE',subjectId:trip,
   ruleVersion:'g24-1',totalPyg:22500,expiresAt:new Date(now+60000).toISOString()}};
 let calls=0;
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  gateway:{send:async()=>({ok:true,data:fakeTrip()})},
  fareGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{calls++;return {ok:true,status:201,redirected:false,
    headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify(verified)};}}
 });
 await app.refreshSession();
 assert.equal(app.prepareServerFare({tripId:trip,requestKey:key}).code,'FARE_REQUIRES_SERVER_TRIP');
 app.startTracking(trip);await app.syncTracking();
 assert.equal(app.prepareServerFare({tripId:trip,requestKey:key}).ok,true);
 assert.equal(app.snapshot().quote,null);
 assert.equal((await app.submitServerFare()).ok,true);
 assert.equal(calls,1);
 assert.equal(app.snapshot().quote.amountGs,22500);
 assert.equal(app.snapshot().fareRequest.phase,'acknowledged');
 await app.signOut();
 assert.equal(app.snapshot().quote,null);
 assert.equal(app.snapshot().fareRequest.phase,'idle');
});
test('cotización G24 bloqueada sin contrato certificado',async()=>{
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  gateway:{send:async()=>({ok:true,data:fakeTrip()})}
 });
 await app.refreshSession();app.startTracking(trip);await app.syncTracking();
 assert.equal(app.prepareServerFare({tripId:trip,requestKey:key}).code,'FARE_CONTRACT_PENDING');
 assert.equal(app.snapshot().fareRequest.contractReady,false);
});

test('borrador local de viaje o envío puede descartarse sin enviar red ni perder sesión',async()=>{
 const f=fixture(fakeSession(),async()=>{throw Error('Nunca llamar servidor');});
 const api=f.api;
 await api.refreshSession();
 assert.equal(api.prepareRide(ride).ok,true);
 assert.equal(api.snapshot().mutation.phase,'ready');
 assert.equal(api.discardPreparedMutation({operation:'rideRequest',requestKey:key}).ok,true);
 assert.equal(api.snapshot().mutation.phase,'idle');
 assert.equal(api.snapshot().authenticated,true);
 assert.equal(api.prepareDelivery({requestKey:key,vehicleKind:'MOTO',category:'DOCUMENTS',
  grams:1500,lengthCm:10,widthCm:5,heightCm:5,
  pickupTag:'Centro Asuncion',deliveryTag:'Villa Morra',
  restrictedItemDeclared:false}).ok,true);
 assert.equal(api.discardPreparedMutation({operation:'deliveryRequest',requestKey:key}).ok,true);
 assert.equal(api.snapshot().mutation.phase,'idle');
});
test('no se puede borrar ni preparar otra operación con una clave ajena',async()=>{
 const f=fixture();
 const api=f.api;
 await api.refreshSession();api.prepareRide(ride);
 assert.equal(api.discardPreparedMutation({operation:'deliveryRequest',requestKey:key}).code,'REQUEST_ID_MISMATCH');
 assert.equal(api.discardPreparedMutation({operation:'rideRequest',
  requestKey:'123e4567-e89b-42d3-a456-426614174099'}).code,'REQUEST_ID_MISMATCH');
 assert.equal(api.snapshot().mutation.phase,'ready');
});
test('jamás descarta requestKey tras timeout: riesgo de doble despacho',async()=>{
 const f=fixture(fakeSession(),async()=>({ok:false,code:'NETWORK_OR_TIMEOUT'}));
 const api=f.api;await api.refreshSession();api.prepareRide(ride);
 assert.equal((await api.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(api.discardPreparedMutation({operation:'rideRequest',requestKey:key}).code,'NOT_UNSENT_REQUEST');
 assert.equal(api.snapshot().mutation.phase,'retryable');
 assert.equal(api.snapshot().mutation.requestKey,key);
});
test('solicitud reconocida no se puede borrar hasta reconciliar servidor',async()=>{
 const f=fixture(fakeSession(),async()=>({ok:true,status:201}));
 const api=f.api;await api.refreshSession();api.prepareRide(ride);
 assert.equal((await api.submit()).ok,true);
 assert.equal(api.discardPreparedMutation({operation:'rideRequest',requestKey:key}).code,'NOT_UNSENT_REQUEST');
 assert.equal(api.snapshot().mutation.phase,'acknowledged');
});

test('cambio de JWT en la misma cuenta rota la revisión privada sin publicar token',async()=>{
 const {api,setSession}=fixture();
 await api.refreshSession();
 const first=api.snapshot();
 assert.equal(Number.isSafeInteger(first.privateViewRevision),true);
 await api.refreshSession();
 assert.equal(api.snapshot().privateViewRevision,first.privateViewRevision);
 setSession({...fakeSession(),token:'synthetic-rotated-same-passenger-account'});
 await api.refreshSession();
 const changed=api.snapshot();
 assert.ok(changed.privateViewRevision>first.privateViewRevision);
 assert.equal(changed.account.subject,a);
 assert.equal(Object.hasOwn(changed,'token'),false);
 assert.equal(JSON.stringify(changed).includes('synthetic-rotated-same-passenger-account'),false);
 await api.signOut();
 const loggedOut=api.snapshot();
 assert.ok(loggedOut.privateViewRevision>changed.privateViewRevision);
 assert.equal(loggedOut.account,null);
});
test('rotar JWT tras preparar bloquea el envío y desmonta el formulario privado',async()=>{
 let calls=0;
 const {api,setSession}=fixture(fakeSession(),async()=>{
  calls++;return {ok:true,status:201};
 });
 await api.refreshSession();
 const revision=api.snapshot().privateViewRevision;
 assert.equal(api.prepareRide(ride).ok,true);
 setSession({...fakeSession(),token:'synthetic-second-token-same-passenger'});
 await api.refreshSession();
 assert.ok(api.snapshot().privateViewRevision>revision);
 assert.equal(api.snapshot().mutation.phase,'idle');
 assert.equal((await api.submit()).code,'NO_READY_REQUEST');
 assert.equal(calls,0);
});
test('rotación o logout durante envío jamás acepta ACK de la sesión anterior',async()=>{
 for(const action of ['rotate','logout']){
  let release,calls=0;
  const pending=new Promise(resolve=>release=resolve);
  const {api,setSession}=fixture(fakeSession(),async()=>{calls++;return pending;});
  await api.refreshSession();
  const revision=api.snapshot().privateViewRevision;
  assert.equal(api.prepareRide(ride).ok,true);
  const request=api.submit();
  await Promise.resolve();await Promise.resolve();
  if(action==='rotate'){
   setSession({...fakeSession(),token:'synthetic-rotated-during-request'});
   await api.refreshSession();
  }else await api.signOut();
  release({ok:true,status:201});
  assert.equal((await request).code,'STALE_RESPONSE_IGNORED');
  assert.equal(calls,1);
  const snapshot=api.snapshot();
  assert.ok(snapshot.privateViewRevision>revision);
  assert.equal(snapshot.mutation.phase,'idle');
  if(action==='logout')assert.equal(snapshot.authenticated,false);
 }
});
test('relogin con misma cuenta sigue invalidando alcance privado tras logout',async()=>{
 const {api}=fixture();
 await api.refreshSession();
 const previous=api.snapshot().privateViewRevision;
 await api.signOut();
 const exited=api.snapshot().privateViewRevision;
 assert.ok(exited>previous);
 await api.refreshSession();
 assert.ok(api.snapshot().privateViewRevision>exited);
});


const structuredIncident={requestKey:key,subjectKind:'RIDE',subjectId:trip,
 category:'QUALITY',severity:'LOW'};
const incidentReceipt=()=>({incidentId:'123e4567-e89b-42d3-a456-426614174080',
 receiptId:'123e4567-e89b-42d3-a456-426614174081',state:'open',revision:1,
 createdAt:new Date(now-1000).toISOString(),observedAt:new Date(now).toISOString(),
 receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY'});
const incidentAnswer=()=>({ok:true,status:201,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(incidentReceipt())});
const incidentOptions=fetchImpl=>({
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 fetchImpl
});
test('G40 no usa red si A no certifica runtime de STAGING',async()=>{
 let hits=0;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  incidentGatewayOptions:{...incidentOptions(async()=>{hits++;return incidentAnswer();}),
   stagingRuntimeVerified:false}});
 await api.refreshSession();
 assert.equal(api.snapshot().incidentReport.contractReady,false);
 assert.equal(api.prepareIncidentReport(structuredIncident).code,'INCIDENT_RUNTIME_NOT_CERTIFIED');
 assert.equal((await api.submitIncidentReport()).code,'NO_READY_INCIDENT');
 assert.equal(hits,0);assert.equal(api.snapshot().incidentReport.receipt,null);
});
test('G40 ligado a sesión propia muestra SOLO recibo QA sin SOS',async()=>{
 let hits=0;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  incidentGatewayOptions:incidentOptions(async (url,req)=>{
   hits++;assert.equal(req.method,'POST');
   assert.equal(url,'https://staging.example.invalid/v1/staging/safety/incidents/report');
   assert.deepEqual(JSON.parse(req.body),structuredIncident);return incidentAnswer();
  })});
 await api.refreshSession();
 assert.equal(api.prepareIncidentReport(structuredIncident).ok,true);
 assert.equal((await api.submitIncidentReport()).ok,true);assert.equal(hits,1);
 assert.equal(api.snapshot().incidentReport.receipt.receiptStatus,'RECEIVED_IN_QA_DATABASE_ONLY');
 assert.equal(api.snapshot().incidentReport.operatorNotified,false);
 await api.signOut();
 assert.equal(api.snapshot().incidentReport.phase,'idle');
 assert.equal(api.snapshot().incidentReport.receipt,null);
});
test('rotación JWT durante POST G40 borra recibo obsoleto',async()=>{
 let current=fakeSession(),release;
 const pending=new Promise(done=>release=done);
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>current},
  incidentGatewayOptions:incidentOptions(async()=>pending)});
 await api.refreshSession();api.prepareIncidentReport(structuredIncident);
 const task=api.submitIncidentReport();await Promise.resolve();await Promise.resolve();
 current={...current,token:'synthetic-new-jwt-after-submit'};
 await api.refreshSession();
 release(incidentAnswer());
 assert.equal((await task).ok,false);
 assert.equal(api.snapshot().incidentReport.phase,'idle');
 assert.equal(api.snapshot().incidentReport.receipt,null);
});
test('runtime G40 reintenta con misma clave y no borra estado ambiguo',async()=>{
 const keys=[];let n=0;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  incidentGatewayOptions:incidentOptions(async (_url,request)=>{
   keys.push(JSON.parse(request.body).requestKey);
   return ++n===1?{status:503,ok:false,redirected:false}:incidentAnswer();
  })});
 await api.refreshSession();api.prepareIncidentReport(structuredIncident);
 assert.equal((await api.submitIncidentReport()).code,'SERVICE_UNAVAILABLE');
 assert.equal(api.discardIncidentReport().code,'NOT_UNSENT_INCIDENT');
 assert.equal((await api.retryIncidentReport()).ok,true);
 assert.deepEqual(keys,[key,key]);
});

test('comercio del Cliente sin contrato Buyer: ni catálogo ni orden real',async()=>{
 const {api}=fixture();await api.refreshSession();
 assert.equal(api.snapshot().commerce.catalogReadReady,false);
 assert.equal((await api.loadCommerceCatalog(trip)).code,'CATALOG_READ_NOT_CERTIFIED');
 assert.equal(api.setCommerceQuantity(trip,1).code,'CATALOG_READ_NOT_CERTIFIED');
 assert.equal(api.previewCommerceOrder(key).code,'CATALOG_READ_NOT_CERTIFIED');
 assert.equal(api.snapshot().commerce.checkoutEnabled,false);
});
test('comercio sintético conserva subtotal de catálogo sin convertirlo en pago',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 const item='123e4567-e89b-42d3-a456-426614174081';
 const data={branchId:branch,version:'qa-v1',expiresAt:now+60000,
  items:[{itemId:item,itemTag:'ARROZ_1KG',itemClass:'GENERAL',
   active:true,unitPricePyg:8750,stockUnits:8}]};
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  commerceCatalogGateway:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,isConfigured:()=>true,
   readCatalog:async()=>({ok:true,data})}
 });
 await api.refreshSession();
 assert.equal((await api.loadCommerceCatalog(branch)).ok,true);
 assert.equal(api.snapshot().commerce.catalogItems[0].itemTag,'ARROZ_1KG');
 assert.equal(api.setCommerceQuantity(item,3).ok,true);
 assert.equal(api.snapshot().commerce.estimatedSubtotalPyg,26250);
 assert.equal(api.snapshot().commerce.finalTotalPyg,null);
 assert.equal(api.previewCommerceOrder(key).submissionAllowed,false);
 await api.signOut();
 assert.equal(api.snapshot().commerce.catalogItems.length,0);
 assert.equal(api.snapshot().commerce.items.length,0);
});
test('JWT nuevo de la misma cuenta elimina catálogo y cantidades del cliente',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080',item='123e4567-e89b-42d3-a456-426614174081';
 let active=fakeSession();
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>active},
  commerceCatalogGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,readCatalog:async()=>({ok:true,data:{
    branchId:branch,version:'qa-v1',expiresAt:now+60000,
    items:[{itemId:item,itemTag:'JABON',itemClass:'GENERAL',active:true,
     unitPricePyg:2500,stockUnits:2}]}})}
 });
 await api.refreshSession();await api.loadCommerceCatalog(branch);
 api.setCommerceQuantity(item,1);
 active={...active,token:'synthetic-jwt-rotated-for-commerce'};
 await api.refreshSession();
 assert.equal(api.snapshot().commerce.items.length,0);
 assert.equal(api.snapshot().commerce.catalogItems.length,0);
});

test('exploración Buyer no se habilita solo por montar Cliente; evita red y pedidos',async()=>{
 const f=fixture();
 await f.api.refreshSession();
 assert.equal(f.api.snapshot().commercePager.readReady,false);
 assert.equal((await f.api.loadCommercePage({branchId:trip})).code,
  'CATALOG_PAGING_NOT_CERTIFIED');
 assert.equal(f.api.snapshot().commercePager.visibleItems.length,0);
 assert.equal(f.api.snapshot().commercePager.ordersEnabled,false);
});
test('exploración Buyer recorre páginas sin llenar carrito ni permitir pagos',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 const cursor=n=>'C'+String(n).padStart(43,'0');
 const calls=[];
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  commerceCatalogPageGateway:{
   enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,
   readCatalogPage:async(_,context)=>{
    calls.push(context);
    const n=context.cursor?Number(context.cursor.slice(1))+1:1;
    return {ok:true,data:{branchId:branch,version:'v1',expiresAt:now+60000,
     items:[{itemId:'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0'),
      itemTag:'ITEM_'+n,itemClass:'GENERAL',active:true,unitPricePyg:1250,stockUnits:6}],
     nextCursor:n<4?cursor(n):null}};
   }
  }
 });
 await api.refreshSession();
 assert.equal(api.snapshot().commercePager.readReady,true);
 assert.equal((await api.loadCommercePage({branchId:branch})).ok,true);
 for(let i=1;i<4;i++)
  assert.equal((await api.loadCommercePage({branchId:branch,next:true})).ok,true);
 assert.equal(api.snapshot().commercePager.pageNumber,4);
 assert.equal(api.snapshot().commercePager.visibleItems.length,1);
 assert.equal(api.snapshot().commercePager.globalTotalKnown,false);
 assert.equal(api.snapshot().commercePager.ordersEnabled,false);
 assert.equal(api.snapshot().commerce.items.length,0);
 assert.equal(api.snapshot().commerce.estimatedSubtotalPyg,null);
 assert.deepEqual(calls.map(c=>c.cursor),[null,cursor(1),cursor(2),cursor(3)]);
 await api.signOut();
 assert.equal(api.snapshot().commercePager.visibleItems.length,0);
 assert.equal(api.snapshot().commercePager.pageNumber,0);
});
test('rotación JWT durante navegación Buyer descarta página y no revive precios',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 let current=fakeSession(),release;
 const pending=new Promise(resolve=>{release=resolve;});
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>current},
  commerceCatalogPageGateway:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,isConfigured:()=>true,readCatalogPage:()=>pending}
 });
 await api.refreshSession();
 const task=api.loadCommercePage({branchId:branch});
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'new-rotated-passenger-jwt-synthetic'};
 await api.refreshSession();
 release({ok:true,data:{branchId:branch,version:'v1',expiresAt:now+60000,
  items:[],nextCursor:null}});
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(api.snapshot().commercePager.visibleItems.length,0);
 assert.equal(api.snapshot().commercePager.pageNumber,0);
});

test('G44 directorio no descubre sucursales por defecto ni envía pedidos',async()=>{
 const {api}=fixture();await api.refreshSession();
 assert.equal(api.snapshot().branchDirectory.readReady,false);
 assert.equal((await api.loadBuyerBranches({municipality:'Asunción',
  serviceKind:'AUTO_DELIVERY'})).code,'BRANCH_DIRECTORY_RUNTIME_NOT_CERTIFIED');
 assert.equal(api.snapshot().branchDirectory.items.length,0);
});
test('G44 directorio QA solo lista sucursales, no habilita pagos',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 let args;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  g44BranchDirectoryOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,readBuyerBranches:async query=>{
    args=query;return {ok:true,status:200,data:{
     municipality:'Asunción',serviceKind:'AUTO_DELIVERY',nextCursor:null,
     orderEnabled:false,productionEnabled:false,
     items:[{branchId:branch,branchTag:'CENTRO',
      merchantKind:'SUPERMARKET',municipality:'Asunción',
      serviceKind:'AUTO_DELIVERY',eligibleByPolicy:false,orderEnabled:false}]
    }};
   }}
 });
 await api.refreshSession();
 assert.equal((await api.loadBuyerBranches({municipality:'Asunción',
  serviceKind:'AUTO_DELIVERY'})).ok,true);
 assert.equal(args.subject,a);
 assert.equal(args.cursor,null);
 assert.equal(api.snapshot().branchDirectory.items[0].branchId,branch);
 assert.equal(api.snapshot().branchDirectory.ordersEnabled,false);
 assert.equal(api.snapshot().branchDirectory.availabilityVerified,false);
 assert.equal(api.snapshot().commerce.checkoutEnabled,false);
 await api.signOut();
 assert.equal(api.snapshot().branchDirectory.items.length,0);
});
test('G44 directorio nunca revive sucursales después de rotar JWT',async()=>{
 let current=fakeSession(),release;
 const pending=new Promise(resolve=>{release=resolve;});
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>current},
  g44BranchDirectoryOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,readBuyerBranches:async()=>pending}
 });
 await api.refreshSession();
 const job=api.loadBuyerBranches({municipality:'Asunción',serviceKind:'MOTO_DELIVERY'});
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'synthetic-different-jwt-on-same-account'};
 await api.refreshSession();
 release({ok:true,status:200,data:{municipality:'Asunción',serviceKind:'MOTO_DELIVERY',
  items:[],nextCursor:null,orderEnabled:false,productionEnabled:false}});
 assert.equal((await job).code,'STALE_RESPONSE_IGNORED');
 assert.equal(api.snapshot().branchDirectory.items.length,0);
});

test('G44 transporte integrado no hace HTTP por simple presencia de esquema',async()=>{
 let calls=0;
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession()},
  g44BuyerHttpOptions:{
   enabled:true,contractCertified:true,stagingRuntimeVerified:false,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{calls++;throw Error('not allowed');}
  }
 });
 await app.refreshSession();
 assert.equal(app.snapshot().branchDirectory.readReady,false);
 assert.equal(app.snapshot().commercePager.readReady,false);
 assert.equal((await app.loadBuyerBranches({municipality:'Asunción',
  serviceKind:'MOTO_DELIVERY'})).code,'BRANCH_DIRECTORY_RUNTIME_NOT_CERTIFIED');
 assert.equal(calls,0);
});
test('G44 integración HTTPS inyectada permite descubrir y leer sin activar órdenes',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 const item='123e4567-e89b-42d3-a456-426614174081';
 const calls=[];
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  g44BuyerHttpOptions:{
   enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async (url,init)=>{
    calls.push([url,init.headers.Authorization]);
    const isCatalog=url.endsWith('/catalog');
    const dto=isCatalog?{branchId:branch,version:7,expiresAt:now+60000,
     items:[{itemId:item,itemTag:'ARROZ_1KG',itemClass:'GENERAL',
      active:true,unitPricePyg:7500,stockUnits:12}],nextCursor:null,
     orderEnabled:false,eligibleByPolicy:false,snapshotConsistent:false,
     productionEnabled:false}:
     {municipality:'Asunción',serviceKind:'MOTO_DELIVERY',items:[{
      branchId:branch,branchTag:'CENTRO',merchantKind:'SUPERMARKET',
      municipality:'Asunción',serviceKind:'MOTO_DELIVERY',
      eligibleByPolicy:false,orderEnabled:false
     }],nextCursor:null,orderEnabled:false,productionEnabled:false};
    return {ok:true,status:200,redirected:false,
     headers:{get:k=>k==='content-type'?'application/json':null},
     text:async()=>JSON.stringify(dto)};
   }
  }
 });
 await app.refreshSession();
 assert.equal(app.snapshot().branchDirectory.readReady,true);
 assert.equal(app.snapshot().commercePager.readReady,true);
 assert.equal((await app.loadBuyerBranches({municipality:'Asunción',
  serviceKind:'MOTO_DELIVERY'})).ok,true);
 assert.equal((await app.loadCommercePage({branchId:branch})).ok,true);
 assert.equal(app.snapshot().branchDirectory.items[0].branchId,branch);
 assert.equal(app.snapshot().commercePager.visibleItems[0].unitPricePyg,7500);
 assert.equal(app.snapshot().commercePager.version,'g44:7');
 assert.equal(app.snapshot().commercePager.ordersEnabled,false);
 assert.equal(app.snapshot().commerce.checkoutEnabled,false);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c[1]==='Bearer '+fakeSession().token));
 await app.signOut();
 assert.equal(app.snapshot().commercePager.visibleItems.length,0);
 assert.equal(app.snapshot().branchDirectory.items.length,0);
});
test('G44 401 con sesión estable limpia vistas privadas y revoca solo Cliente',async()=>{
 const branch='123e4567-e89b-42d3-a456-426614174080';
 const app=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  g44BuyerHttpOptions:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>({ok:false,status:401,redirected:false})}
 });
 await app.refreshSession();
 assert.equal((await app.loadCommercePage({branchId:branch})).ok,false);
 assert.equal(app.snapshot().authenticated,false);
 assert.equal(app.snapshot().commercePager.visibleItems.length,0);
 assert.equal(app.snapshot().branchDirectory.items.length,0);
});

const chatService='123e4567-e89b-42d3-a456-426614174082';
const chatConversation='123e4567-e89b-42d3-a456-426614174083';
const chatMessage='123e4567-e89b-42d3-a456-426614174084';
test('Chat Cliente por defecto OFF y nunca publica mensajes falsos',async()=>{
 const {api}=fixture();await api.refreshSession();
 assert.equal(api.snapshot().chat.contractReady,false);
 assert.equal((await api.openChat({serviceId:chatService,serviceKind:'DELIVERY'})).code,
  'CHAT_CONTRACT_NOT_CERTIFIED');
 assert.equal(api.snapshot().chat.messages.length,0);
});
test('Chat Cliente vincula remitente autenticado y solo acepta ACK del servidor',async()=>{
 const calls=[];
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,
   readMessages:async args=>{
    calls.push(['read',args]);
    return {ok:true,data:{
     conversationId:chatConversation,serviceId:chatService,
     serviceKind:'DELIVERY',ownerId:a,counterpartRole:'driver',
     assignmentVerified:true,state:'ACTIVE',revision:3,
     generatedAt:now-1000,expiresAt:now+60000,messages:[],nextCursor:null,
     canSend:true,productionEnabled:false
    }};
   },
   sendMessage:async args=>{
    calls.push(['send',args]);return {ok:true,data:{
     conversationId:chatConversation,serviceId:chatService,
     requestKey:key,messageId:chatMessage,senderRole:'passenger',
     body:'Voy a salir a recibir el paquete',createdAt:now-1,
     revision:4,serverStored:true
    }};
   }
  }
 });
 await api.refreshSession();
 assert.equal((await api.openChat({serviceId:chatService,serviceKind:'DELIVERY'})).ok,true);
 assert.equal(api.snapshot().chat.active,true);
 assert.equal((await api.sendChat({body:'Voy a salir a recibir el paquete',requestKey:key})).ok,true);
 assert.equal(api.snapshot().chat.messages.length,1);
 assert.equal(api.snapshot().chat.messages[0].senderRole,'passenger');
 assert.equal(api.snapshot().chat.deliveredWithoutAck,false);
 assert.equal(calls[0][1].subject,a);
 await api.signOut();
 assert.equal(api.snapshot().chat.messages.length,0);
 assert.equal(api.snapshot().chat.active,false);
});
test('Chat privado no se restaura tras JWT nuevo en la misma cuenta',async()=>{
 let session=fakeSession();
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>session,signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,
   readMessages:async()=>({ok:true,data:{
    conversationId:chatConversation,serviceId:chatService,
    serviceKind:'RIDE',ownerId:a,counterpartRole:'driver',
    assignmentVerified:true,state:'ACTIVE',revision:3,generatedAt:now-1000,
    expiresAt:now+60000,messages:[],nextCursor:null,
    canSend:true,productionEnabled:false
   }}),
   sendMessage:async()=>({ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'})
  }
 });
 await api.refreshSession();
 assert.equal((await api.openChat({serviceId:chatService,serviceKind:'RIDE'})).ok,true);
 session={...session,token:'jwt-new-synthetic-token-passenger'};
 await api.refreshSession();
 assert.equal(api.snapshot().chat.messages.length,0);
 assert.equal(api.snapshot().chat.active,false);
});

test('avisos chat permanecen OFF sin backend certificado, aunque un push sea válido',async()=>{
 const {api}=fixture();await api.refreshSession();
 const hint={eventId:key,ownerId:a,serviceId:chatService,
  serviceKind:'DELIVERY',kind:'CHAT_ACTIVITY',revision:1,
  issuedAt:now-500,expiresAt:now+60000,unreadCount:1,
  contentIncluded:false};
 assert.equal(api.acceptChatPushHint(hint),false);
 assert.equal(api.snapshot().chatHints.length,0);
});
test('avisos chat autenticados no muestran cuerpos y se borran al logout',async()=>{
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,readMessages:async()=>({ok:false,code:'NOT_MOUNTED'}),
   sendMessage:async()=>({ok:false,code:'NOT_MOUNTED'})}
 });
 await api.refreshSession();
 const hint={eventId:key,ownerId:a,serviceId:chatService,
  serviceKind:'MERCHANT_ORDER',kind:'CHAT_ACTIVITY',revision:1,
  issuedAt:now-500,expiresAt:now+60000,unreadCount:2,
  contentIncluded:false};
 assert.equal(api.acceptChatPushHint({...hint,body:'mensaje secreto'}),false);
 assert.equal(api.acceptChatPushHint(hint),true);
 assert.equal(api.snapshot().chatHints.length,1);
 assert.equal(api.snapshot().chatHints[0].containsMessageBody,false);
 assert.equal(api.snapshot().chatHints[0].requiresServerAuthorization,true);
 await api.signOut();
 assert.equal(api.snapshot().chatHints.length,0);
});
test('avisos en nueva sesión JWT no reaniman lista privada previa',async()=>{
 let session=fakeSession();
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>session,signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>true,readMessages:async()=>({ok:false,code:'QA'}),
   sendMessage:async()=>({ok:false,code:'QA'})}
 });
 await api.refreshSession();
 const hint={eventId:key,ownerId:a,serviceId:chatService,
  serviceKind:'RIDE',kind:'CHAT_ACTIVITY',revision:1,
  issuedAt:now-500,expiresAt:now+60000,unreadCount:1,contentIncluded:false};
 assert.equal(api.acceptChatPushHint(hint),true);
 session={...session,token:'jwt-rotated-passenger-synthetic-abc'};
 await api.refreshSession();
 assert.equal(api.snapshot().chatHints.length,0);
});

test('bandeja de conversaciones Cliente OFF por defecto no intenta API',async()=>{
 const {api}=fixture();await api.refreshSession();
 assert.equal(api.snapshot().chatInbox.readReady,false);
 assert.equal((await api.loadChatInbox()).code,'CHAT_INBOX_CONTRACT_NOT_CERTIFIED');
 assert.equal(api.snapshot().chatInbox.items.length,0);
});
test('inbox autorizada solo contiene conversaciones activas, sin datos de Driver',async()=>{
 const conv='123e4567-e89b-42d3-a456-426614174087';
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  chatInboxGateway:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,isConfigured:()=>true,
   readInbox:async({subject,sessionRevision})=>({
    ok:true,data:{ownerId:subject,generatedAt:now-1000,expiresAt:now+60000,
     revision:4,items:[{conversationId:conv,serviceId:chatService,
      serviceKind:'MERCHANT_ORDER',state:'ACTIVE',assignmentVerified:true,
      counterpartRole:'driver',revision:4,unreadCount:2,updatedAt:now-1000,
      canSend:true}],nextCursor:null,productionEnabled:false}
   })}
 });
 await api.refreshSession();
 assert.equal((await api.loadChatInbox()).ok,true);
 assert.equal(api.snapshot().chatInbox.items.length,1);
 assert.equal(api.snapshot().chatInbox.items[0].unreadCount,2);
 assert.equal(Object.hasOwn(api.snapshot().chatInbox.items[0],'driverPhone'),false);
 assert.equal(api.snapshot().chatInbox.globalTotalKnown,false);
 await api.signOut();
 assert.equal(api.snapshot().chatInbox.items.length,0);
});
test('inbox privada deja de verse al rotar JWT aun con el mismo titular',async()=>{
 let session=fakeSession();
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>session,signOut:async()=>{}},
  chatInboxGateway:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,isConfigured:()=>true,
   readInbox:async({subject})=>({ok:true,data:{ownerId:subject,
    generatedAt:now-1000,expiresAt:now+60000,revision:5,
    items:[],nextCursor:null,productionEnabled:false}})}
 });
 await api.refreshSession();
 assert.equal((await api.loadChatInbox()).ok,true);
 assert.equal(api.snapshot().chatInbox.pageNumber,1);
 session={...session,token:'jwt-second-private-session-abcdef'};
 await api.refreshSession();
 assert.equal(api.snapshot().chatInbox.pageNumber,0);
});

test('revocación de chat purga notificaciones privadas e impide reaparición al reactivar',async()=>{
 let enabled=true;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>enabled,
   readMessages:async()=>({ok:false,code:'QA'}),
   sendMessage:async()=>({ok:false,code:'QA'})}
 });
 await api.refreshSession();
 const hint={eventId:key,ownerId:a,serviceId:chatService,
  serviceKind:'RIDE',kind:'CHAT_ACTIVITY',revision:1,
  issuedAt:now-500,expiresAt:now+60000,unreadCount:3,
  contentIncluded:false};
 assert.equal(api.acceptChatPushHint(hint),true);
 assert.equal(api.snapshot().chatHints.length,1);
 enabled=false;
 assert.equal(api.snapshot().chatHints.length,0);
 enabled=true;
 assert.equal(api.snapshot().chatHints.length,0);
 assert.equal(api.acceptChatPushHint({...hint,revision:2,eventId:chatMessage}),true);
 assert.equal(api.snapshot().chatHints.length,1);
});
test('hint rechazado durante revocación purga caché anterior aun sin snapshot',async()=>{
 let enabled=true;
 const api=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>fakeSession(),signOut:async()=>{}},
  chatGateway:{enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   isConfigured:()=>enabled,
   readMessages:async()=>({ok:false,code:'QA'}),
   sendMessage:async()=>({ok:false,code:'QA'})}
 });
 await api.refreshSession();
 const hint={eventId:key,ownerId:a,serviceId:chatService,
  serviceKind:'DELIVERY',kind:'CHAT_ACTIVITY',revision:1,
  issuedAt:now-500,expiresAt:now+60000,unreadCount:2,
  contentIncluded:false};
 assert.equal(api.acceptChatPushHint(hint),true);
 enabled=false;
 assert.equal(api.acceptChatPushHint(hint),false);
 enabled=true;
 assert.equal(api.snapshot().chatHints.length,0);
});
