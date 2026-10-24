/**
 * R38 — Resumen de compra SOLO LECTURA para Cliente.
 * NO confirma reservas, stock, despacho, precio total o pago.
 * Consume un snapshot de catálogo ya autorizado en la sesión actual.
 * Fallo cerrado ante cambios de precio, stock, versión y TTL.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION=/^[A-Za-z0-9._:-]{1,80}$/;
const TAG=/^[A-Z0-9_]{2,50}$/;
const fail=code=>Object.freeze({ok:false,code,checkoutEnabled:false,
 paymentEnabled:false,orderConfirmed:false});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const sameKeys=(x,keys)=>obj(x)
 &&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const CART_ROW=['itemId','quantity','itemTag','unitPricePyg','lineSubtotalPyg'];
const CATALOG_ROW=['itemId','itemTag','itemClass','active','unitPricePyg','stockUnits'];
const permittedKind=new Set(['GENERAL','PHARMACY_OTC']);

/**
 * No recibe PII ni requestKey. No crea un payload para POST.
 * Máximo 50 líneas POR CARRITO, no global de registros.
 * Deliberadamente preserva null en entrega, descuentos y total.
 */
export function reviewCommerceBasket(snapshot,{authenticated=false,now=Date.now()}={}){
 if(authenticated!==true)return fail('AUTH_REQUIRED');
 if(!obj(snapshot)||snapshot.catalogReadReady!==true
  ||snapshot.checkoutEnabled!==false||snapshot.paymentEnabled!==false
  ||snapshot.serverOrderReceipt!==null)
  return fail('COMMERCE_RUNTIME_NOT_CERTIFIED');
 if(snapshot.stage!=='SERVER_CATALOG'||snapshot.stock!=='SERVER_SNAPSHOT'
  ||!integer(now)||!Number.isSafeInteger(snapshot.catalogExpiresAt)
  ||snapshot.catalogExpiresAt<=now
  ||snapshot.catalogExpiresAt>now+300000)
  return fail('CATALOG_EXPIRED_OR_UNVERIFIED');
 if(typeof snapshot.branchId!=='string'||!UUID.test(snapshot.branchId)
  ||typeof snapshot.catalogVersion!=='string'
  ||!VERSION.test(snapshot.catalogVersion)
  ||!['AUTO','MOTO'].includes(snapshot.vehicleKind))
  return fail('INVALID_COMMERCE_SCOPE');
 if(!Array.isArray(snapshot.items)||snapshot.items.length===0)
  return fail('EMPTY_BASKET');
 if(snapshot.items.length>50
  ||!Array.isArray(snapshot.catalogItems)||snapshot.catalogItems.length>100)
  return fail('INVALID_BASKET');
 const index=new Map();
 for(const item of snapshot.catalogItems){
  if(!sameKeys(item,CATALOG_ROW)||typeof item.itemId!=='string'
   ||!UUID.test(item.itemId)||typeof item.itemTag!=='string'
   ||!TAG.test(item.itemTag)||!permittedKind.has(item.itemClass)
   ||typeof item.active!=='boolean'
   ||!integer(item.stockUnits)||item.stockUnits>1000000
   ||!integer(item.unitPricePyg)||item.unitPricePyg<100
   ||item.unitPricePyg>10000000||index.has(item.itemId))
   return fail('INVALID_CATALOG_ROW');
  index.set(item.itemId,item);
 }
 let subtotal=0;
 const rows=[],seen=new Set();
 for(const row of snapshot.items){
  if(!sameKeys(row,CART_ROW)||typeof row.itemId!=='string'
   ||!UUID.test(row.itemId)
   ||seen.has(row.itemId)||!integer(row.quantity)
   ||row.quantity<1||row.quantity>999
   ||typeof row.itemTag!=='string'||!TAG.test(row.itemTag)
   ||!integer(row.unitPricePyg)||!integer(row.lineSubtotalPyg))
   return fail('INVALID_BASKET_ROW');
  const item=index.get(row.itemId);
  if(!item||item.active!==true)return fail('ITEM_UNAVAILABLE');
  if(row.quantity>item.stockUnits)return fail('STOCK_CHANGED');
  if(row.itemTag!==item.itemTag||row.unitPricePyg!==item.unitPricePyg)
   return fail('PRICE_OR_CATALOG_CHANGED');
  const expected=item.unitPricePyg*row.quantity;
  if(!Number.isSafeInteger(expected)||row.lineSubtotalPyg!==expected)
   return fail('INVALID_LINE_SUBTOTAL');
  if(!Number.isSafeInteger(subtotal+expected))
   return fail('INVALID_SUBTOTAL');
  subtotal+=expected;seen.add(row.itemId);
  rows.push(Object.freeze({
   itemId:item.itemId,itemTag:item.itemTag,itemClass:item.itemClass,
   quantity:row.quantity,unitPricePyg:item.unitPricePyg,
   lineSubtotalPyg:expected
  }));
 }
 if(!integer(snapshot.estimatedSubtotalPyg)
  ||snapshot.estimatedSubtotalPyg!==subtotal
  ||snapshot.finalTotalPyg!==null)
  return fail('INVALID_SUBTOTAL');
 return Object.freeze({
  ok:true,scope:'CURRENT_AUTHORIZED_CATALOG_ONLY',
  branchId:snapshot.branchId,catalogVersion:snapshot.catalogVersion,
  expiresAt:snapshot.catalogExpiresAt,vehicleKind:snapshot.vehicleKind,
  lines:Object.freeze(rows),estimatedSubtotalPyg:subtotal,
  deliveryFeePyg:null,discountPyg:null,finalTotalPyg:null,
  checkoutEnabled:false,paymentEnabled:false,orderConfirmed:false,
  stockReserved:false,deliveryAvailable:false
 });
}
