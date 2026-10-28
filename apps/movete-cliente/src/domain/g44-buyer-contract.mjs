import {projectCatalog} from './commerce-draft.mjs';

/** Contratos OpenAPI G44 del Arquitecto A: tipados, QA-only, runtime UNMOUNTED.
 * No fija URL, no posee tokens ni credenciales, NO lanza HTTP por defecto.
 * Traduce el version int64 G44 a versión OPACA de dominio B.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const SERVICE=new Set(['AUTO_DELIVERY','MOTO_DELIVERY']);
const MERCHANT=new Set(['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER']);
const TOP_CATALOG=['branchId','version','expiresAt','items','nextCursor',
 'orderEnabled','eligibleByPolicy','snapshotConsistent','productionEnabled'];
const TOP_BRANCHES=['municipality','serviceKind','items','nextCursor',
 'orderEnabled','productionEnabled'];
const BRANCH=['branchId','branchTag','merchantKind','municipality','serviceKind',
 'eligibleByPolicy','orderEnabled'];
const ITEM=['itemId','itemTag','itemClass','active','unitPricePyg','stockUnits'];
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,fields)=>obj(v)&&Object.keys(v).length===fields.length
 &&fields.every(k=>Object.hasOwn(v,k));
const cursorOk=v=>v===null||(typeof v==='string'&&CURSOR.test(v));
const textOk=(x,min=2,max=80)=>typeof x==='string'&&x.length>=min&&x.length<=max
 &&x.trim()===x&&!/[<>\u0000-\u001f\u007f]/u.test(x);
const uuid=x=>typeof x==='string'&&UUID.test(x);

export function projectG44BuyerCatalog(raw,{branchId,now=Date.now()}={}){
 if(!exact(raw,TOP_CATALOG)||!uuid(branchId)||raw.branchId!==branchId
  ||!Number.isSafeInteger(raw.version)||raw.version<1
  ||!Number.isSafeInteger(raw.expiresAt)||!cursorOk(raw.nextCursor)
  ||raw.orderEnabled!==false||raw.eligibleByPolicy!==false
  ||raw.snapshotConsistent!==false||raw.productionEnabled!==false
  ||!Array.isArray(raw.items)||raw.items.length>100)return null;
 for(const item of raw.items){
  if(!exact(item,ITEM)||item.active!==true||item.stockUnits<1)return null;
 }
 const normalized=projectCatalog({
  branchId,version:'g44:'+String(raw.version),expiresAt:raw.expiresAt,
  items:raw.items
 },{branchId,now});
 if(!normalized)return null;
 return Object.freeze({...normalized,nextCursor:raw.nextCursor,
  ordersEnabled:false,paymentsEnabled:false,globalTotalKnown:false});
}
export function projectG44BuyerBranches(raw,{municipality,serviceKind}={}){
 if(!exact(raw,TOP_BRANCHES)||!textOk(municipality)||!SERVICE.has(serviceKind)
  ||raw.municipality!==municipality||raw.serviceKind!==serviceKind
  ||raw.orderEnabled!==false||raw.productionEnabled!==false
  ||!Array.isArray(raw.items)||raw.items.length>100||!cursorOk(raw.nextCursor))
  return null;
 const seen=new Set(),items=[];
 for(const record of raw.items){
  if(!exact(record,BRANCH)||!uuid(record.branchId)
   ||seen.has(record.branchId)||!textOk(record.branchTag,2,120)
   ||!MERCHANT.has(record.merchantKind)||record.municipality!==municipality
   ||record.serviceKind!==serviceKind||record.eligibleByPolicy!==false
   ||record.orderEnabled!==false)return null;
  seen.add(record.branchId);
  items.push(Object.freeze({...record}));
 }
 return Object.freeze({municipality,serviceKind,
  items:Object.freeze(items),nextCursor:raw.nextCursor,
  globalTotalKnown:false,ordersEnabled:false,paymentsEnabled:false});
}
const errors=Object.freeze({
 400:'INVALID_OR_EXPIRED_CURSOR',401:'AUTH_REQUIRED',403:'FORBIDDEN',
 404:'NOT_FOUND',409:'CATALOG_REVISION_CHANGED',429:'RATE_LIMITED',
 503:'SERVICE_UNAVAILABLE'
});
/**
 * Inyección de transporte solo tras certificación del Arquitecto A.
 * El paginador B recibe readCatalogPage() normalizado sin tocar SQL/API A.
 */
export function createG44BuyerCatalogAdapter({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 readBuyerCatalog=null,now=()=>Date.now()
}={}){
 const ready=()=>enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&typeof readBuyerCatalog==='function';
 let pending=false;
 async function readCatalogPage(branchId,context={}){
  if(!ready())return fail('G44_RUNTIME_NOT_CERTIFIED');
  if(!uuid(branchId)||!obj(context)||!uuid(context.subject)
   ||!Number.isSafeInteger(context.sessionRevision)
   ||context.sessionRevision<0||!cursorOk(context.cursor??null))
   return fail('INVALID_INPUT');
  if(pending)return fail('G44_READ_IN_FLIGHT');
  pending=true;
  try{
   let result;
   try{result=await readBuyerCatalog(branchId,{
    cursor:context.cursor??null,subject:context.subject,
    sessionRevision:context.sessionRevision
   });}catch{return fail('NETWORK_OR_TIMEOUT');}
   if(result?.ok!==true)
    return fail(errors[result?.status]??result?.code??'CATALOG_READ_FAILED');
   if(result.status!==200)return fail('UNEXPECTED_HTTP_STATUS');
   const parsed=projectG44BuyerCatalog(result.data,{branchId,now:now()});
   if(!parsed)return fail('INVALID_G44_CATALOG');
   return Object.freeze({ok:true,data:Object.freeze({
    branchId:parsed.branchId,version:parsed.version,expiresAt:parsed.expiresAt,
    items:parsed.items,nextCursor:parsed.nextCursor
   })});
  }finally{pending=false;}
 }
 return Object.freeze({enabled,contractCertified,stagingRuntimeVerified,
  isConfigured:ready,readCatalogPage});
}
