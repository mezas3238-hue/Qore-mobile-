/**
 * Dominio de carrito CLIENTE ligado a un snapshot de catalogo del servidor.
 * Calcula un subtotal informativo solo con precios recibidos del servidor.
 * El total final, la reserva de stock y la compra pertenecen al backend.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION=/^[A-Za-z0-9._:-]{1,80}$/;
const ITEM_TAG=/^[A-Z0-9_]{2,50}$/;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const failure=code=>Object.freeze({ok:false,code});

/**
 * Boundary normalizado que debe producir el futuro adaptador de catalogo real.
 * Los nombres de precio/stock/clase coinciden con CatalogItem del OpenAPI de A;
 * itemId, version y expiracion siguen siendo requisitos del contrato de lectura.
 */
export function projectCatalog(payload,{branchId,now=Date.now()}={}){
 if(!object(payload)||!uuid(branchId)||payload.branchId!==branchId
  ||typeof payload.version!=='string'||!VERSION.test(payload.version)
  ||!Number.isSafeInteger(payload.expiresAt)||payload.expiresAt<=now
  ||payload.expiresAt>now+300000||!Array.isArray(payload.items)
  ||payload.items.length>100)return null;
 const mapped=[];
 const seen=new Set();
 for(const item of payload.items){
  if(!object(item)||!uuid(item.itemId)||seen.has(item.itemId)
   ||typeof item.itemTag!=='string'||!ITEM_TAG.test(item.itemTag)
   ||!['GENERAL','PHARMACY_OTC'].includes(item.itemClass)
   ||typeof item.active!=='boolean'
   ||!Number.isSafeInteger(item.unitPricePyg)||item.unitPricePyg<100
   ||item.unitPricePyg>10000000
   ||!Number.isSafeInteger(item.stockUnits)||item.stockUnits<0
   ||item.stockUnits>1000000)return null;
  seen.add(item.itemId);
  mapped.push(Object.freeze({itemId:item.itemId,itemTag:item.itemTag,
   itemClass:item.itemClass,active:item.active,unitPricePyg:item.unitPricePyg,
   stockUnits:item.stockUnits}));
 }
 return Object.freeze({branchId,version:payload.version,expiresAt:payload.expiresAt,
  items:Object.freeze(mapped)});
}

function catalogIndex(catalog){
 return new Map(catalog.items.map(item=>[item.itemId,item]));
}
function difference(previous,next,lines){
 const before=catalogIndex(previous),after=catalogIndex(next);
 for(const [itemId,quantity] of lines){
  const oldItem=before.get(itemId),newItem=after.get(itemId);
  if(!newItem||!newItem.active)return 'ITEM_UNAVAILABLE';
  if(!oldItem||newItem.unitPricePyg!==oldItem.unitPricePyg)return 'PRICE_CHANGED';
  if(newItem.stockUnits!==oldItem.stockUnits||newItem.stockUnits<quantity)return 'STOCK_CHANGED';
 }
 return null;
}
function sameRevisionChanged(previous,next){
 return JSON.stringify(previous.items)!==JSON.stringify(next.items);
}

export function createCommerceDraftCart({now=()=>Date.now()}={}){
 let branchId=null,vehicleKind='MOTO',items=new Map(),catalog=null,generation=0;
 function resetLines(){items=new Map();generation++;}
 function clear(){items=new Map();catalog=null;branchId=null;vehicleKind='MOTO';generation++;}
 function selectBranch(next){
  if(!uuid(next))return failure('INVALID_BRANCH');
  if(branchId!==next){branchId=next;catalog=null;resetLines();}
  return Object.freeze({ok:true});
 }
 function acceptCatalog(payload){
  if(!branchId)return failure('BRANCH_REQUIRED');
  const projected=projectCatalog(payload,{branchId,now:now()});
  if(!projected)return failure('INVALID_CATALOG');
  if(catalog?.version===projected.version&&sameRevisionChanged(catalog,projected)){
   catalog=null;resetLines();return failure('CATALOG_REVISION_CONFLICT');
  }
  if(catalog&&catalog.version!==projected.version){
   const changed=difference(catalog,projected,items);
   if(changed){catalog=projected;resetLines();return failure(changed);}
  }
  catalog=projected;generation++;
  return Object.freeze({ok:true,version:catalog.version});
 }
 function selectVehicle(kind){
  if(!['MOTO','AUTO'].includes(kind))return failure('INVALID_VEHICLE');
  if(vehicleKind!==kind){vehicleKind=kind;generation++;}
  return Object.freeze({ok:true});
 }
 function setQuantity(itemId,quantity){
  if(!branchId)return failure('BRANCH_REQUIRED');
  if(!catalog)return failure('CATALOG_REQUIRED');
  if(catalog.expiresAt<=now())return failure('CATALOG_EXPIRED');
  if(!uuid(itemId)||!Number.isSafeInteger(quantity)||quantity<0||quantity>999)
   return failure('INVALID_ITEM');
  if(quantity===0){items.delete(itemId);generation++;return Object.freeze({ok:true});}
  const item=catalogIndex(catalog).get(itemId);
  if(!item||!item.active)return failure('ITEM_UNAVAILABLE');
  if(quantity>item.stockUnits)return failure('INSUFFICIENT_STOCK');
  if(!items.has(itemId)&&items.size>=50)return failure('CART_LIMIT');
  items.set(itemId,quantity);generation++;
  return Object.freeze({ok:true});
 }
 function snapshot(){
  const index=catalog?catalogIndex(catalog):new Map();
  const fresh=Boolean(catalog&&catalog.expiresAt>now());
  const lines=[...items].map(([itemId,quantity])=>{
   const item=index.get(itemId);
   return Object.freeze({itemId,quantity,itemTag:item?.itemTag??null,
    unitPricePyg:fresh?item?.unitPricePyg??null:null,
    lineSubtotalPyg:fresh&&item?item.unitPricePyg*quantity:null});
  });
  const subtotal=fresh?lines.reduce((sum,line)=>sum+(line.lineSubtotalPyg??0),0):null;
  return Object.freeze({branchId,vehicleKind,catalogVersion:catalog?.version??null,
   catalogExpiresAt:catalog?.expiresAt??null,items:Object.freeze(lines),
   estimatedSubtotalPyg:subtotal,finalTotalPyg:null,
   stock:fresh?'SERVER_SNAPSHOT':'UNVERIFIED',
   stage:catalog?(fresh?'SERVER_CATALOG':'CATALOG_EXPIRED'):'CATALOG_REQUIRED',generation});
 }
 function previewRequest(requestKey){
  if(!uuid(requestKey)||!branchId||items.size<1)return failure('DRAFT_INCOMPLETE');
  if(!catalog)return failure('CATALOG_REQUIRED');
  if(catalog.expiresAt<=now())return failure('CATALOG_EXPIRED');
  const index=catalogIndex(catalog);
  for(const [itemId,quantity] of items){
   const item=index.get(itemId);
   if(!item||!item.active)return failure('ITEM_UNAVAILABLE');
   if(item.stockUnits<quantity)return failure('STOCK_CHANGED');
  }
  return Object.freeze({ok:true,submissionAllowed:false,
   reason:'ATOMIC_ORDER_CONTRACT_PENDING',
   body:Object.freeze({requestKey,branchId,vehicleKind,
    items:Object.freeze([...items].map(([itemId,quantity])=>Object.freeze({itemId,quantity})))}),
   precondition:Object.freeze({branchId,catalogVersion:catalog.version})});
 }
 const currentCatalog=()=>Object.freeze(
  catalog&&catalog.expiresAt>now()?catalog.items:[]
 );
 return Object.freeze({clear,snapshot,currentCatalog,selectBranch,acceptCatalog,selectVehicle,
  setQuantity,previewRequest});
}
