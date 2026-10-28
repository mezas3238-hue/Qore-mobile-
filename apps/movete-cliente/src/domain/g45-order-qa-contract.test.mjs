import test from 'node:test';
import assert from 'node:assert/strict';
import {validateG45ReserveRequest,prepareG45QaReserveDraft,
 projectG45QaReserveReceipt,validateG45CancelRequest,
 prepareG45QaCancelDraft,projectG45QaCancelReceipt} from './g45-order-qa-contract.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const request=()=>({requestKey:id(1),branchId:id(2),catalogVersion:9,
 vehicleKind:'AUTO',items:[{itemId:id(3),quantity:2}]});
const receipt=()=>({receiptId:id(4),orderId:id(5),requestKey:id(1),
 branchId:id(2),catalogVersion:9,subtotalPyg:15000,
 receiptStatus:'QA_RESERVED_NO_PAYMENT',orderEnabled:false,
 productionEnabled:false});
const cancellation=()=>({orderId:id(5),receiptId:id(6),eventId:id(7),
 receiptStatus:'QA_CANCELLED_STOCK_RESTORED',
 refundStatus:'NO_PSP_NO_FINANCIAL_REFUND',
 orderEnabled:false,productionEnabled:false});
test('G45 pedido sintético solo prepara contrato, sin envío ni compra',()=>{
 const draft=prepareG45QaReserveDraft(request());
 assert.equal(draft.ok,true);
 assert.equal(draft.submitted,false);
 assert.equal(draft.checkoutEnabled,false);
 assert.equal(draft.paymentsEnabled,false);
 assert.equal(Object.isFrozen(draft.body),true);
 assert.equal(Object.isFrozen(draft.body.items[0]),true);
 assert.equal(Object.hasOwn(draft.body,'unitPricePyg'),false);
});
test('G45 moto, PII, precio frontend y referencia insegura no entran en reserva',()=>{
 const bad=[
  {...request(),vehicleKind:'MOTO'},
  {...request(),phone:'0981000000'},
  {...request(),unitPricePyg:1},
  {...request(),catalogVersion:0},
  {...request(),catalogVersion:'9'},
  {...request(),catalogVersion:Number.MAX_SAFE_INTEGER+1},
  {...request(),requestKey:'bad'},
  {...request(),branchId:id(88),items:[{...request().items[0],stockUnits:999}]},
  {...request(),items:[{...request().items[0],customerId:id(44)}]},
  {...request(),items:[]},
  {...request(),items:[{itemId:id(3),quantity:0}]},
  {...request(),items:[{itemId:id(3),quantity:1000}]},
  {...request(),items:[{itemId:id(3),quantity:'2'}]},
  {...request(),items:[{itemId:id(3),quantity:1},{itemId:id(3),quantity:2}]}
 ];
 for(const input of bad){
  assert.equal(validateG45ReserveRequest(input),false);
  assert.equal(prepareG45QaReserveDraft(input).ok,false);
 }
});
test('G45 50 líneas son tamaño de un pedido, no límite de registros',()=>{
 const fifty=Array.from({length:50},(_,i)=>({itemId:id(i+100),quantity:1}));
 assert.equal(validateG45ReserveRequest({...request(),items:fifty}),true);
 assert.equal(validateG45ReserveRequest({...request(),items:[
  ...fifty,{itemId:id(250),quantity:1}]}),false);
});
test('G45 recibo correcto solo acredita ensayo QA sin pago',()=>{
 const dto=projectG45QaReserveReceipt(receipt(),{request:request()});
 assert.equal(dto.receiptStatus,'QA_RESERVED_NO_PAYMENT');
 assert.equal(dto.qaDatabaseOnly,true);
 assert.equal(dto.paymentConfirmed,false);
 assert.equal(Object.isFrozen(dto),true);
});
test('G45 confirma identidad, clave idempotente y revisión; rechaza recibos falsos',()=>{
 const bad=[
  {...receipt(),receiptStatus:'PAID'},
  {...receipt(),orderEnabled:true},
  {...receipt(),productionEnabled:true},
  {...receipt(),customerName:'privado'},
  {...receipt(),requestKey:id(77)},
  {...receipt(),branchId:id(77)},
  {...receipt(),catalogVersion:8},
  {...receipt(),subtotalPyg:0},
  {...receipt(),subtotalPyg:50000001},
  {...receipt(),subtotalPyg:'15000'},
  {...receipt(),orderId:'invalid'}
 ];
 for(const dto of bad)
  assert.equal(projectG45QaReserveReceipt(dto,{request:request()}),null);
});
test('G45 cancelación conserva clave explícita y no equivale a devolución real',()=>{
 const body={cancelKey:id(8)};
 assert.equal(validateG45CancelRequest(body),true);
 const draft=prepareG45QaCancelDraft({orderId:id(5),body});
 assert.equal(draft.ok,true);
 assert.equal(draft.refundsEnabled,false);
 assert.equal(draft.submitted,false);
 assert.equal(Object.isFrozen(draft.body),true);
 const receipt=projectG45QaCancelReceipt(cancellation(),{orderId:id(5)});
 assert.equal(receipt.qaDatabaseOnly,true);
 assert.equal(receipt.refundConfirmed,false);
 assert.equal(receipt.paymentConfirmed,false);
});
test('G45 descarta cancelación de pedido ajeno, recibos PSP y campos privados',()=>{
 for(const dto of [
  {...cancellation(),orderId:id(33)},
  {...cancellation(),refundStatus:'MONEY_RETURNED'},
  {...cancellation(),orderEnabled:true},
  {...cancellation(),productionEnabled:true},
  {...cancellation(),phone:'0981111111'},
  {...cancellation(),receiptId:'invalid'}
 ])assert.equal(projectG45QaCancelReceipt(dto,{orderId:id(5)}),null);
 for(const body of [{cancelKey:'invalid'},{cancelKey:id(8),reason:'personal'},{},null])
  assert.equal(prepareG45QaCancelDraft({orderId:id(5),body}).ok,false);
});
