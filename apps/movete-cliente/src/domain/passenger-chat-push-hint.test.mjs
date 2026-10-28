import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPassengerChatPushHint,createPassengerChatPushHintStore}
 from './passenger-chat-push-hint.mjs';
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const owner=id(1),service=id(2);
const valid=()=>({eventId:id(3),ownerId:owner,serviceId:service,
 serviceKind:'RIDE',kind:'CHAT_ACTIVITY',revision:1,
 issuedAt:now-1000,expiresAt:now+60000,unreadCount:1,
 contentIncluded:false});
test('push de mensajes de viaje, envío y comercio solo muestra texto genérico',()=>{
 for(const serviceKind of ['RIDE','DELIVERY','MERCHANT_ORDER']){
  const item=projectPassengerChatPushHint({...valid(),serviceKind},
   {subject:owner,now});
  assert.equal(item.title,'Movete Fácil');
  assert.equal(item.body,'Tenés mensajes nuevos de tu servicio.');
  assert.equal(item.containsMessageBody,false);
  assert.equal(item.containsSenderIdentity,false);
  assert.equal(item.requiresServerAuthorization,true);
  assert.equal(Object.hasOwn(item,'phone'),false);
  assert.equal(Object.hasOwn(item,'driverName'),false);
 }
});
test('rechaza push con contenido privado, rol externo, vencimiento o actor cruzado',()=>{
 const payloads=[
  {...valid(),body:'Estoy llegando'},
  {...valid(),phoneNumber:'0981111111'},
  {...valid(),senderName:'Nombre privado'},
  {...valid(),driverId:id(8)},
  {...valid(),contentIncluded:true},
  {...valid(),ownerId:id(9)},
  {...valid(),eventId:'fake'},
  {...valid(),serviceKind:'DRIVER'},
  {...valid(),kind:'TRANSACTION'},
  {...valid(),issuedAt:now+1},
  {...valid(),issuedAt:now-120001},
  {...valid(),expiresAt:now-1},
  {...valid(),expiresAt:now+300001},
  {...valid(),unreadCount:-1},
  {...valid(),unreadCount:Number.MAX_SAFE_INTEGER+1}
 ];
 for(const payload of payloads)
  assert.equal(projectPassengerChatPushHint(payload,{subject:owner,now}),null);
});
test('los eventos repetidos no duplican avisos ni confieren permiso de chat',()=>{
 const store=createPassengerChatPushHintStore({now:()=>now});
 assert.equal(store.accept(valid(),owner).ok,true);
 assert.equal(store.accept(valid(),owner).code,'PUSH_REPLAY_IGNORED');
 assert.equal(store.snapshot(owner).length,1);
 assert.equal(store.snapshot(owner)[0].requiresServerAuthorization,true);
 assert.equal(store.accept({...valid(),revision:2,eventId:id(4)},owner).ok,true);
 assert.equal(store.snapshot(owner).length,1);
 assert.equal(store.snapshot(owner)[0].revision,2);
});
test('cambio de cuenta elimina caché local de avisos privados',()=>{
 const store=createPassengerChatPushHintStore({now:()=>now});
 store.accept(valid(),owner);
 assert.equal(store.snapshot(id(9)).length,0);
 assert.equal(store.accept({...valid(),ownerId:id(9),eventId:id(10)},id(9)).ok,true);
 assert.equal(store.snapshot(owner).length,0);
 assert.equal(store.snapshot(id(9)).length,1);
 store.clear();
 assert.equal(store.snapshot(id(9)).length,0);
});
test('ventana local acotada no limita el número de servicios del servidor',()=>{
 const store=createPassengerChatPushHintStore({now:()=>now,maxServices:10});
 for(let i=1;i<=35;i++){
  const r=store.accept({...valid(),eventId:id(i+100),serviceId:id(i+300)},owner);
  assert.equal(r.ok,true);
 }
 assert.equal(store.snapshot(owner).length,10);
});
test('push vencido desaparece localmente sin mostrar contenido viejo',()=>{
 let tick=now;
 const store=createPassengerChatPushHintStore({now:()=>tick});
 assert.equal(store.accept(valid(),owner).ok,true);
 tick+=60001;
 assert.equal(store.snapshot(owner).length,0);
});

test('push no limita cantidad real de pendientes, solo muestra 99+ en insignia',()=>{
 for(const unreadCount of [99,100,123456,Number.MAX_SAFE_INTEGER]){
  const hint=projectPassengerChatPushHint({...valid(),unreadCount},{subject:owner,now});
  assert.equal(hint.badgeText,'99+');
  assert.equal(Object.hasOwn(hint,'unreadCount'),false);
 }
});
