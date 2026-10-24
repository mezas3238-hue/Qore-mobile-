/**
 * R39 — Preferencias privadas y efímeras ante faltantes de comercio.
 * NO aprueba sustitutos concretos, NO manda mensajes, NO crea pedidos/POST.
 * Toda decisión queda ligada a sesión + revisión + carrito certificado.
 */
import {reviewCommerceBasket} from './commerce-checkout-review.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const choices=new Set(['OMIT_IF_UNAVAILABLE','ASK_BEFORE_SUBSTITUTING']);
const fail=code=>Object.freeze({ok:false,code,choices:Object.freeze([]),
 submitted:false,orderConfirmed:false,contactSent:false});
const actorOk=(actor)=>actor?.authenticated===true
 &&typeof actor.subject==='string'&&UUID.test(actor.subject)
 &&Number.isSafeInteger(actor.sessionRevision)&&actor.sessionRevision>=0;
const freezeRows=rows=>Object.freeze(rows.map(x=>Object.freeze({...x})));
export function createCommerceSubstitutionDraft({now=()=>Date.now()}={}){
 let scope=null,decisions=new Map();
 const clear=()=>{scope=null;decisions.clear();};
 const validated=(commerce,actor)=>{
  if(!actorOk(actor)){clear();return {error:'AUTH_REQUIRED'};}
  const review=reviewCommerceBasket(commerce,{authenticated:true,now:now()});
  if(!review.ok){clear();return {error:review.code};}
  const key=JSON.stringify([
   actor.subject,actor.sessionRevision,review.branchId,review.catalogVersion,
   review.expiresAt,review.vehicleKind,
   review.lines.map(x=>[x.itemId,x.itemTag,x.itemClass,x.quantity,
    x.unitPricePyg,x.lineSubtotalPyg])
  ]);
  // Cambios de cuenta/JWT, version, sucursal, cantidad, precio,
  // vehículo o TTL invalidan íntegramente las decisiones anteriores.
  if(key!==scope){scope=key;decisions.clear();}
  return {review};
 };
 function snapshot(commerce,actor){
  const result=validated(commerce,actor);
  if(result.error)return fail(result.error);
  const items=result.review.lines.map(line=>({
   itemId:line.itemId,itemTag:line.itemTag,
   choice:decisions.get(line.itemId)??null
  }));
  return Object.freeze({ok:true,choices:freezeRows(items),
   submitted:false,orderConfirmed:false,contactSent:false,
   stockReserved:false,preferencesSavedOnServer:false});
 }
 function choose(commerce,actor,{itemId,choice}={}){
  const result=validated(commerce,actor);
  if(result.error)return fail(result.error);
  if(typeof itemId!=='string'||!UUID.test(itemId)
   ||!result.review.lines.some(line=>line.itemId===itemId))
   return fail('ITEM_NOT_IN_CURRENT_BASKET');
  if(choice!==null&&!choices.has(choice))return fail('INVALID_SUBSTITUTION_CHOICE');
  if(choice===null)decisions.delete(itemId);
  else decisions.set(itemId,choice);
  return snapshot(commerce,actor);
 }
 return Object.freeze({snapshot,choose,clear});
}
