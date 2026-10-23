import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowPassengerServiceChat} from './passenger-chat-navigation.mjs';
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
