import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowPassengerServiceChat,passengerChatPrivateViewKey} from './passenger-chat-navigation.mjs';
const id='123e4567-e89b-42d3-a456-426614174077',other='123e4567-e89b-42d3-a456-426614174088';
const data=({authenticated:true,contractReady:true,accountSubject:id,
 historyOwnerId:id,serviceId:other,kind:'DELIVERY',status:'assigned'});
test('viaje automóvil y reparto de moto/auto acceden solo con historial propio vigente',()=>{
 for(const kind of ['RIDE','DELIVERY','MERCHANT_ORDER'])
  for(const status of ['assigned','in_progress'])
   assert.equal(canShowPassengerServiceChat({...data,kind,status}),true);
});
test('historial no permite chats finalizados, cancelados, con rol ajeno o cuenta distinta',()=>{
 for(const patch of [
  {authenticated:false},{contractReady:false},{accountSubject:other},
  {historyOwnerId:other},{historyOwnerId:null},{serviceId:'123'},
  {kind:'DRIVER'},{kind:'RIDE',status:'completed'},{status:'cancelled'},
  {status:'searching'},{status:'failed'}
 ])assert.equal(canShowPassengerServiceChat({...data,...patch}),false);
});
test('no se infieren conductor, teléfono, conversación ni despacho desde elegibilidad UI',()=>{
 const r=canShowPassengerServiceChat(data);
 assert.equal(r,true);
 assert.equal(typeof r,'boolean');
});

test('clave privada desmonta editor al cambiar conversación, tipo o JWT',()=>{
 const a=passengerChatPrivateViewKey({
  sessionRevision:4,serviceId:id,serviceKind:'RIDE'});
 const b=passengerChatPrivateViewKey({
  sessionRevision:4,serviceId:other,serviceKind:'RIDE'});
 const c=passengerChatPrivateViewKey({
  sessionRevision:4,serviceId:id,serviceKind:'DELIVERY'});
 const d=passengerChatPrivateViewKey({
  sessionRevision:5,serviceId:id,serviceKind:'RIDE'});
 assert.notEqual(a,b);
 assert.notEqual(a,c);
 assert.notEqual(a,d);
 assert.equal(a,passengerChatPrivateViewKey({
  sessionRevision:4,serviceId:id,serviceKind:'RIDE'}));
});
test('enlaces manipulados no reutilizan el editor de la conversación previa',()=>{
 const valid=passengerChatPrivateViewKey({
  sessionRevision:4,serviceId:id,serviceKind:'MERCHANT_ORDER'});
 for(const patch of [
  {sessionRevision:4,serviceId:'../../',serviceKind:'MERCHANT_ORDER'},
  {sessionRevision:4,serviceId:id,serviceKind:'DRIVER'},
  {sessionRevision:-1,serviceId:id,serviceKind:'MERCHANT_ORDER'}
 ])assert.notEqual(valid,passengerChatPrivateViewKey(patch));
});

test('cambiar conversación del mismo servicio desmonta editor privado',()=>{
 const one=passengerChatPrivateViewKey({sessionRevision:4,
  serviceId:id,serviceKind:'DELIVERY',conversationId:id});
 const another=passengerChatPrivateViewKey({sessionRevision:4,
  serviceId:id,serviceKind:'DELIVERY',conversationId:other});
 const fromHistory=passengerChatPrivateViewKey({sessionRevision:4,
  serviceId:id,serviceKind:'DELIVERY'});
 assert.notEqual(one,another);
 assert.notEqual(one,fromHistory);
});
