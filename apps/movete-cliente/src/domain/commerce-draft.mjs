/**
 * Carrito de intención CLIENTE. No deriva precios ni stock.
 * No hace POST, no reserva ítems ni realiza cobros.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const failure=code=>({ok:false,code});
export function createCommerceDraftCart(){
 let branchId=null,vehicleKind='MOTO',items=new Map(),generation=0;
 function clear(){items=new Map();branchId=null;vehicleKind='MOTO';generation++;}
 function snapshot(){return Object.freeze({
  branchId,vehicleKind,items:Object.freeze([...items].map(([itemId,quantity])=>Object.freeze({itemId,quantity}))),
  totalGs:null,stock:'UNVERIFIED',stage:'LOCAL_DRAFT',generation
 });}
 function selectBranch(next){
  if(!uuid(next))return failure('INVALID_BRANCH');
  if(branchId!==next){items=new Map();branchId=next;generation++;}
  return {ok:true};
 }
 function selectVehicle(kind){
  if(!['MOTO','AUTO'].includes(kind))return failure('INVALID_VEHICLE');
  vehicleKind=kind;generation++;return {ok:true};
 }
 function setQuantity(itemId,quantity){
  if(!branchId)return failure('BRANCH_REQUIRED');
  if(!uuid(itemId)||!Number.isSafeInteger(quantity)||quantity<0||quantity>999)
   return failure('INVALID_ITEM');
  if(quantity===0)items.delete(itemId);
  else if(items.has(itemId)||items.size<50)items.set(itemId,quantity);
  else return failure('CART_LIMIT');
  generation++;return {ok:true};
 }
 function previewRequest(requestKey){
  if(!uuid(requestKey)||!branchId||items.size<1)return failure('DRAFT_INCOMPLETE');
  return Object.freeze({ok:true,submissionAllowed:false,reason:'CATALOG_AND_QUOTE_REQUIRED',
   body:{requestKey,branchId,vehicleKind,items:[...items].map(([itemId,quantity])=>({itemId,quantity}))}});
 }
 return Object.freeze({clear,snapshot,selectBranch,selectVehicle,setQuantity,previewRequest});
}

/**
 * Sanitiza respuesta de catálogo propuesta. La frescura y los roles deben
 * verificarse en backend; el frontend jamás declara stock real por sí solo.
 */
export function projectCatalog(payload,{branchId,now=Date.now()}={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!uuid(branchId)
  ||payload.branchId!==branchId||!Number.isSafeInteger(payload.revision)
  ||payload.revision<0||!Number.isSafeInteger(payload.expiresAt)
  ||payload.expiresAt<=now||payload.expiresAt>now+300000
  ||!Array.isArray(payload.items)||payload.items.length>100)return null;
 const mapped=[];
 const seen=new Set();
 for(const item of payload.items){
  if(!item||typeof item!=='object'||Array.isArray(item)
   ||!uuid(item.itemId)||seen.has(item.itemId)
   ||typeof item.title!=='string'||item.title.trim().length<2||item.title.length>80
   ||!['GROCERIES','RESTAURANT','PHARMACY_OTC','OTHER'].includes(item.category)
   ||typeof item.available!=='boolean')return null;
  const priceOk=Number.isSafeInteger(item.priceGs)&&item.priceGs>0&&item.priceGs<=1000000000;
  if(item.available&&!priceOk)return null;
  seen.add(item.itemId);
  mapped.push(Object.freeze({itemId:item.itemId,title:item.title.trim(),category:item.category,
   available:item.available,priceGs:item.available?item.priceGs:null}));
 }
 return Object.freeze({branchId,revision:payload.revision,expiresAt:payload.expiresAt,
  items:Object.freeze(mapped)});
}
