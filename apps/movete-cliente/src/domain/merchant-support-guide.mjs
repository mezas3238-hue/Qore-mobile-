/**
 * R40 — Guía privada de soporte para pedidos comerciales.
 * NO crea caso, aviso, SOS, mensaje, orden, pago ni ACK.
 * El servicio real debe certificar propiedad del pedido y autorización.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVELS=new Set(['LOW','MEDIUM','HIGH']);
export const MERCHANT_SUPPORT_REASONS=Object.freeze([
 Object.freeze({code:'MISSING_ITEM',label:'Falta un producto',category:'LOSS'}),
 Object.freeze({code:'WRONG_ITEM',label:'Recibí un producto diferente',category:'QUALITY'}),
 Object.freeze({code:'DAMAGED_ITEM',label:'Producto dañado',category:'QUALITY'}),
 Object.freeze({code:'LATE_DELIVERY',label:'Entrega demorada',category:'QUALITY'}),
 Object.freeze({code:'PRICE_DISPUTE',label:'Desacuerdo sobre el importe',category:'DISPUTE'}),
 Object.freeze({code:'SAFETY_CONCERN',label:'Situación de seguridad (NO SOS)',category:'SAFETY'})
]);
const deny=code=>Object.freeze({ok:false,code,caseCreated:false,
 operatorNotified:false,merchantContacted:false,sosDispatched:false});
const validActor=x=>x?.role==='passenger'&&typeof x.subject==='string'
 &&UUID.test(x.subject)&&Number.isSafeInteger(x.sessionRevision)
 &&x.sessionRevision>=0;
const reasonFor=x=>MERCHANT_SUPPORT_REASONS.find(r=>r.code===x);
const initial=()=>({orderId:'',reason:null,severity:null});
export function createMerchantSupportGuide(){
 let state=initial(),scope=null,closed=false;
 const clear=()=>{scope=null;state=initial();};
 function check(actor){
  if(closed)return 'GUIDE_DISPOSED';
  if(!validActor(actor)){clear();return 'AUTH_REQUIRED';}
  const current=actor.subject+':'+actor.sessionRevision;
  if(scope!==current){clear();scope=current;}
  return null;
 }
 function snapshot(actor){
  const error=check(actor);
  if(error)return Object.freeze({ok:false,code:error,orderId:'',
   reason:null,severity:null,canReview:false,localOnly:true,
   caseCreated:false,operatorNotified:false,sosDispatched:false});
  return Object.freeze({...state,ok:true,canReview:UUID.test(state.orderId)
   &&Boolean(reasonFor(state.reason))&&LEVELS.has(state.severity),
   localOnly:true,caseCreated:false,operatorNotified:false,
   merchantContacted:false,sosDispatched:false});
 }
 function update(actor,patch){
  const error=check(actor);if(error)return deny(error);
  if(!patch||typeof patch!=='object'||Array.isArray(patch)
   ||Object.keys(patch).length!==1)return deny('INVALID_GUIDE_UPDATE');
  if(Object.hasOwn(patch,'orderId')){
   if(typeof patch.orderId!=='string'||patch.orderId.length>36
    ||!/^[0-9a-f-]*$/i.test(patch.orderId))
    return deny('INVALID_ORDER_ID');
   state={...state,orderId:patch.orderId};
  }else if(Object.hasOwn(patch,'reason')){
   if(patch.reason!==null&&!reasonFor(patch.reason))
    return deny('INVALID_SUPPORT_REASON');
   state={...state,reason:patch.reason};
  }else if(Object.hasOwn(patch,'severity')){
   if(patch.severity!==null&&!LEVELS.has(patch.severity))
    return deny('INVALID_SUPPORT_SEVERITY');
   state={...state,severity:patch.severity};
  }else return deny('INVALID_GUIDE_UPDATE');
  return snapshot(actor);
 }
 function review(actor){
  const current=snapshot(actor);
  if(!current.ok)return deny(current.code);
  if(!current.canReview)return deny('INCOMPLETE_GUIDE');
  const reason=reasonFor(state.reason);
  return Object.freeze({ok:true,localOnly:true,
   intent:Object.freeze({subjectKind:'MERCHANT_ORDER',
    subjectId:state.orderId,category:reason.category,severity:state.severity}),
   caseCreated:false,operatorNotified:false,merchantContacted:false,
   sosDispatched:false,ownershipVerified:false,submitted:false,
   qaOnly:true,customerContacted:false});
 }
 function dispose(){clear();closed=true;}
 return Object.freeze({snapshot,update,review,clear,dispose});
}
