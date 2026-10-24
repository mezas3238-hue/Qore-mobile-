/**
 * R49 — Reconfirm scope of a commerce UI action on tap.
 * A displayed React snapshot may be obsolete before the next re-render.
 * This guard only authorizes a LOCAL draft edit; never a payment or order.
 */
import {isCommercePageFresh} from './commerce-ttl-refresh.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deny=code=>Object.freeze({ok:false,code});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const actorValid=x=>x?.authenticated===true
 &&typeof x.account?.subject==='string'&&UUID.test(x.account.subject)
 &&x.account.role==='passenger'
 &&Number.isSafeInteger(x.privateViewRevision);
const qty=(rows,id)=>Array.isArray(rows)
 ?rows.find(x=>x?.itemId===id)?.quantity??0:NaN;
export function guardCommerceUiAction(displayed,current,{
 itemId=null,requestedQuantity=null,requireInBasket=false,now=Date.now()
}={}){
 if(!actorValid(displayed)||!actorValid(current)
  ||displayed.account.subject!==current.account.subject
  ||displayed.privateViewRevision!==current.privateViewRevision)
  return deny('COMMERCE_SESSION_CHANGED');
 const before=displayed.commerce,after=current.commerce;
 if(!object(before)||!object(after)
  ||before.catalogReadReady!==true||after.catalogReadReady!==true
  ||before.stage!=='SERVER_CATALOG'||after.stage!=='SERVER_CATALOG'
  ||before.catalogLoading!==false||after.catalogLoading!==false
  ||after.catalogError!==null
  ||before.checkoutEnabled!==false||after.checkoutEnabled!==false
  ||before.paymentEnabled!==false||after.paymentEnabled!==false)
  return deny('COMMERCE_UNAVAILABLE');
 if(!isCommercePageFresh(before.catalogExpiresAt,now)
  ||!isCommercePageFresh(after.catalogExpiresAt,now))
  return deny('COMMERCE_CATALOG_EXPIRED');
 if(typeof before.branchId!=='string'||!UUID.test(before.branchId)
  ||typeof after.branchId!=='string'||before.branchId!==after.branchId
  ||typeof before.catalogVersion!=='string'
  ||before.catalogVersion.length<1||before.catalogVersion!==after.catalogVersion
  ||before.catalogExpiresAt!==after.catalogExpiresAt
  ||!['AUTO','MOTO'].includes(before.vehicleKind)
  ||before.vehicleKind!==after.vehicleKind
  ||!Number.isSafeInteger(before.generation)
  ||before.generation!==after.generation)
  return deny('COMMERCE_SCOPE_CHANGED');
 if(itemId!==null){
  if(typeof itemId!=='string'||!UUID.test(itemId)
   ||!Array.isArray(before.catalogItems)||!Array.isArray(after.catalogItems))
   return deny('INVALID_COMMERCE_ITEM');
  const oldItem=before.catalogItems.find(x=>x?.itemId===itemId);
  const newItem=after.catalogItems.find(x=>x?.itemId===itemId);
  if(!oldItem||!newItem||oldItem.active!==true||newItem.active!==true
   ||oldItem.itemTag!==newItem.itemTag
   ||oldItem.itemClass!==newItem.itemClass
   ||oldItem.unitPricePyg!==newItem.unitPricePyg
   ||oldItem.stockUnits!==newItem.stockUnits
   ||!Number.isSafeInteger(newItem.stockUnits)||newItem.stockUnits<0)
   return deny('COMMERCE_ITEM_CHANGED');
  const oldQty=qty(before.items,itemId),newQty=qty(after.items,itemId);
  if(!Number.isSafeInteger(oldQty)||newQty!==oldQty
   ||oldQty<0||oldQty>newItem.stockUnits)
   return deny('COMMERCE_BASKET_CHANGED');
  if(requireInBasket===true&&oldQty<1)
   return deny('ITEM_NOT_IN_BASKET');
  if(requestedQuantity!==null&&(!Number.isSafeInteger(requestedQuantity)
   ||requestedQuantity<0||requestedQuantity>Math.min(999,newItem.stockUnits)))
   return deny('INVALID_REQUESTED_QUANTITY');
 }
 return Object.freeze({ok:true,scope:'CURRENT_LOCAL_DRAFT_ONLY',
  checkoutEnabled:false,paymentEnabled:false,orderConfirmed:false});
}
