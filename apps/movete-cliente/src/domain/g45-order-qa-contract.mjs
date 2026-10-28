/**
 * G45: contratos de reserva/cancelación de pedidos de ensayo únicamente.
 * A declara x-qore-runtime-wired=false. NO HTTP, NO PSP, NO checkout.
 * Máximo 50 líneas POR PEDIDO, sin limitar registros del catálogo/plataforma.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,keys)=>obj(v)&&Object.keys(v).length===keys.length
 &&keys.every(k=>Object.hasOwn(v,k));
const natural=x=>Number.isSafeInteger(x)&&x>=1;
const BODY=['requestKey','branchId','catalogVersion','vehicleKind','items'];
const ITEM=['itemId','quantity'];
const ACK=['receiptId','orderId','requestKey','branchId','catalogVersion',
 'subtotalPyg','receiptStatus','orderEnabled','productionEnabled'];
const CANCEL=['cancelKey'];
const CANCEL_ACK=['orderId','receiptId','eventId','receiptStatus','refundStatus',
 'orderEnabled','productionEnabled'];
const fail=code=>Object.freeze({ok:false,code});
export function validateG45ReserveRequest(body){
 if(!exact(body,BODY)||!uuid(body.requestKey)||!uuid(body.branchId)
  ||!natural(body.catalogVersion)||!['AUTO','MOTO'].includes(body.vehicleKind)
  ||!Array.isArray(body.items)||body.items.length<1||body.items.length>50)
  return false;
 const seen=new Set();
 for(const row of body.items){
  if(!exact(row,ITEM)||!uuid(row.itemId)||seen.has(row.itemId)
   ||!natural(row.quantity)||row.quantity>999)return false;
  seen.add(row.itemId);
 }
 return true;
}
export function prepareG45QaReserveDraft(body){
 if(!validateG45ReserveRequest(body))return fail('INVALID_G45_RESERVE_REQUEST');
 return Object.freeze({ok:true,submitted:false,checkoutEnabled:false,
  qaOnly:true,paymentsEnabled:false,
  body:Object.freeze({...body,
   items:Object.freeze(body.items.map(item=>Object.freeze({...item})))})});
}
export function projectG45QaReserveReceipt(dto,{request=null}={}){
 if(!validateG45ReserveRequest(request)||!exact(dto,ACK)
  ||!uuid(dto.receiptId)||!uuid(dto.orderId)
  ||dto.requestKey!==request.requestKey||dto.branchId!==request.branchId
  ||dto.catalogVersion!==request.catalogVersion
  ||!Number.isSafeInteger(dto.subtotalPyg)||dto.subtotalPyg<100
  ||dto.subtotalPyg>50000000||dto.receiptStatus!=='QA_RESERVED_NO_PAYMENT'
  ||dto.orderEnabled!==false||dto.productionEnabled!==false)
  return null;
 return Object.freeze({...dto,paymentConfirmed:false,refundConfirmed:false,
  qaDatabaseOnly:true});
}
export function validateG45CancelRequest(body){
 return exact(body,CANCEL)&&uuid(body.cancelKey);
}
export function prepareG45QaCancelDraft({orderId,body}={}){
 if(!uuid(orderId)||!validateG45CancelRequest(body))
  return fail('INVALID_G45_CANCEL_REQUEST');
 return Object.freeze({ok:true,submitted:false,qaOnly:true,
  refundsEnabled:false,
  orderId,body:Object.freeze({...body})});
}
export function projectG45QaCancelReceipt(dto,{orderId=null}={}){
 if(!uuid(orderId)||!exact(dto,CANCEL_ACK)||dto.orderId!==orderId
  ||!uuid(dto.receiptId)||!uuid(dto.eventId)
  ||dto.receiptStatus!=='QA_CANCELLED_STOCK_RESTORED'
  ||dto.refundStatus!=='NO_PSP_NO_FINANCIAL_REFUND'
  ||dto.orderEnabled!==false||dto.productionEnabled!==false)
  return null;
 return Object.freeze({...dto,refundConfirmed:false,
  paymentConfirmed:false,qaDatabaseOnly:true});
}

/** G144 read-after-lost-ACK: SQL current status, never a payment receipt. */
const G144_FIELDS=[...ACK,'status','revision','deliveryId'];
const G144_STATUSES=new Set(['requested','confirmed','preparing','ready',
 'handed_to_courier','delivered','cancelled']);
export function projectG144OrderRecoveryReceipt(dto,{requestKey}={}){
 if(!uuid(requestKey)||!exact(dto,G144_FIELDS)
  ||![dto.receiptId,dto.orderId,dto.requestKey,dto.branchId].every(uuid)
  ||dto.requestKey!==requestKey
  ||!natural(dto.catalogVersion)||!natural(dto.revision)
  ||!Number.isSafeInteger(dto.subtotalPyg)||dto.subtotalPyg<100
  ||dto.subtotalPyg>50000000||dto.receiptStatus!=='QA_RESERVED_NO_PAYMENT'
  ||dto.orderEnabled!==false||dto.productionEnabled!==false
  ||!G144_STATUSES.has(dto.status)
  ||!(dto.deliveryId===null||uuid(dto.deliveryId))
  ||(['handed_to_courier','delivered'].includes(dto.status)&&dto.deliveryId===null))
  return null;
 return Object.freeze({...dto,qaDatabaseOnly:true,
  paymentConfirmed:false,dispatchConfirmed:false,refundConfirmed:false});
}
