import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowPassengerServiceChat,passengerChatPrivateViewKey,passengerPendingRecoveryRoute} from './passenger-chat-navigation.mjs';
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


// R23 — el editor montado desde historial debe seguir al hilo autorizado.
test('R23 ruta de historial desmonta borrador tras reasignación del mismo servicio y JWT',()=>{
 const common={sessionRevision:4,serviceId:id,serviceKind:'RIDE',
  authorized:true,authorizedServiceId:id,authorizedServiceKind:'RIDE'};
 const oldThread=passengerChatPrivateViewKey({
  ...common,authorizedConversationId:id
 });
 const newThread=passengerChatPrivateViewKey({
  ...common,authorizedConversationId:other
 });
 assert.notEqual(oldThread,newThread);
 assert.notEqual(oldThread,passengerChatPrivateViewKey({
  ...common,authorized:false,authorizedConversationId:id
 }));
});
test('R23 ignora hilo resuelto de otro servicio, tipo o autorización revocada',()=>{
 const base={sessionRevision:4,serviceId:id,serviceKind:'DELIVERY'};
 const empty=passengerChatPrivateViewKey(base);
 for(const patch of [
  {authorized:false,authorizedServiceId:id,
   authorizedServiceKind:'DELIVERY',authorizedConversationId:other},
  {authorized:true,authorizedServiceId:other,
   authorizedServiceKind:'DELIVERY',authorizedConversationId:other},
  {authorized:true,authorizedServiceId:id,
   authorizedServiceKind:'RIDE',authorizedConversationId:other},
  {authorized:true,authorizedServiceId:id,
   authorizedServiceKind:'DELIVERY',authorizedConversationId:'tampered'}
 ])assert.equal(passengerChatPrivateViewKey({...base,...patch}),empty);
});
test('R23 hilo fijado por URL no puede ser sustituido por un resolvedId ajeno',()=>{
 const base={sessionRevision:4,serviceId:id,serviceKind:'DELIVERY',
  conversationId:id};
 assert.equal(passengerChatPrivateViewKey({
  ...base,authorized:true,authorizedServiceId:id,
  authorizedServiceKind:'DELIVERY',authorizedConversationId:other
 }),passengerChatPrivateViewKey(base));
 assert.notEqual(passengerChatPrivateViewKey({
  ...base,conversationId:'../../../driver',authorized:true,
  authorizedServiceId:id,authorizedServiceKind:'DELIVERY',
  authorizedConversationId:other
 }),passengerChatPrivateViewKey(base));
});
test('R23 un hilo sin sesión válida no resucita el borrador privado',()=>{
 const base={sessionRevision:-1,serviceId:id,serviceKind:'RIDE',
  authorized:true,authorizedServiceId:id,
  authorizedServiceKind:'RIDE',authorizedConversationId:other};
 assert.equal(passengerChatPrivateViewKey(base),passengerChatPrivateViewKey({
  sessionRevision:-1,serviceId:id,serviceKind:'RIDE'
 }));
});


// R24 — navegar a conciliación idempotente de un envío incierto.
test('R24 ofrece regresar al hilo pendiente al visitar otro servicio',()=>{
 const r=passengerPendingRecoveryRoute({
  authenticated:true,contractReady:true,pendingSend:true,
  pendingServiceId:id,pendingServiceKind:'RIDE',pendingConversationId:other,
  currentServiceId:other,currentServiceKind:'DELIVERY'
 });
 assert.deepEqual(r,{serviceId:id,serviceKind:'RIDE',conversationId:other});
 assert.equal(Object.isFrozen(r),true);
});
test('R24 no muestra regreso si la ruta actual ya puede reconciliar la misma clave',()=>{
 const args={authenticated:true,contractReady:true,pendingSend:true,
  pendingServiceId:id,pendingServiceKind:'RIDE',pendingConversationId:other,
  currentServiceId:id,currentServiceKind:'RIDE'};
 assert.equal(passengerPendingRecoveryRoute(args),null);
 assert.equal(passengerPendingRecoveryRoute({...args,
  currentConversationId:other}),null);
 assert.deepEqual(passengerPendingRecoveryRoute({...args,
  currentConversationId:id}),{serviceId:id,serviceKind:'RIDE',conversationId:other});
});
test('R24 nunca presenta enlaces pendientes sin sesión, contrato o DTO autorizado',()=>{
 const base={authenticated:true,contractReady:true,pendingSend:true,
  pendingServiceId:id,pendingServiceKind:'MERCHANT_ORDER',
  pendingConversationId:other};
 for(const patch of [
  {authenticated:false},{contractReady:false},{pendingSend:false},
  {pendingServiceId:'../../etc/passwd'},{pendingServiceKind:'ADMIN'},
  {pendingConversationId:'not-a-uuid'},{pendingConversationId:null},
  {pendingServiceId:null},{pendingServiceKind:'RIDE',pendingConversationId:'/'}
 ])assert.equal(passengerPendingRecoveryRoute({...base,...patch}),null);
});
