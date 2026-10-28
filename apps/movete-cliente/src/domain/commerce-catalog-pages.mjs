import {projectCatalog} from './commerce-draft.mjs';

/**
 * Navegador de catálogo de comprador, SOLO LECTURA.
 *
 * Requiere un lector certificado por A; no contiene ruta HTTP inventada.
 * Guarda exclusivamente la página visible y cursores opacos en memoria.
 * El total de productos/comercios del servidor nunca se limita a 100.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const fail=code=>Object.freeze({ok:false,code});
const actorOk=x=>x&&x.role==='passenger'&&typeof x.subject==='string'
 &&UUID.test(x.subject)&&Number.isSafeInteger(x.sessionRevision)
 &&x.sessionRevision>=0;
const sameActor=(a,b)=>actorOk(b)&&a.subject===b.subject
 &&a.sessionRevision===b.sessionRevision;
function acceptablePage(raw,branchId,now){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)
  ||Object.keys(raw).length!==5
  ||!['branchId','version','expiresAt','items','nextCursor']
    .every(key=>Object.hasOwn(raw,key)))return null;
 if(!(raw.nextCursor===null||(typeof raw.nextCursor==='string'
   &&CURSOR.test(raw.nextCursor))))return null;
 const catalog=projectCatalog(raw,{branchId,now});
 return catalog?Object.freeze({...catalog,nextCursor:raw.nextCursor}):null;
}
const blank=()=>({
 branchId:null,version:null,expiresAt:null,pageNumber:0,
 items:[],nextCursor:null,anchors:[null],seen:new Set(),error:null
});
export function createCommerceCatalogPager({gateway=null,getActor=null,
 now=()=>Date.now()}={}){
 let epoch=0,pending=false,state=blank();
 const enabled=()=>gateway?.enabled===true
  &&gateway?.contractCertified===true&&gateway?.stagingRuntimeVerified===true
  &&gateway?.isConfigured?.()===true&&typeof gateway.readCatalogPage==='function';
 const clear=()=>{epoch++;pending=false;state=blank();};
 function snapshot(){
  // Ocultar filas y precios mientras se valida Auth o la nueva página.
  const fresh=!pending&&state.expiresAt!==null&&state.expiresAt>now();
  return Object.freeze({
   readReady:enabled(),loading:pending,
   branchId:fresh?state.branchId:null,version:fresh?state.version:null,
   pageNumber:fresh?state.pageNumber:0,
   visibleItems:Object.freeze(fresh?[...state.items]:[]),
   expiresAt:fresh?state.expiresAt:null,
   hasPrevious:Boolean(fresh&&state.pageNumber>1),
   hasNext:Boolean(fresh&&state.nextCursor),
   globalTotalKnown:false,ordersEnabled:false,paymentsEnabled:false,
   error:state.error
  });
 }
 async function load({branchId,next=false,previous=false}={}){
  if(!enabled())return fail('CATALOG_PAGING_NOT_CERTIFIED');
  if(typeof branchId!=='string'||!UUID.test(branchId)||next&&previous)
   return fail('INVALID_BRANCH_OR_DIRECTION');
  if(pending)return fail('CATALOG_PAGE_IN_FLIGHT');
  if(next&&(!snapshot().hasNext||state.branchId!==branchId))
   return fail('NO_NEXT_PAGE');
  if(previous&&(!snapshot().hasPrevious||state.branchId!==branchId))
   return fail('NO_PREVIOUS_PAGE');
  const cursor=next?state.nextCursor:
   previous?state.anchors[state.pageNumber-2]:null;
  if(next&&(state.seen.has(cursor)||cursor===null)){
   clear();return fail('CURSOR_REPEATED');
  }
  if(typeof getActor!=='function')return fail('AUTH_REQUIRED');
  // Claim the request lock before awaiting an identity provider. Otherwise
  // two rapid taps can request different branches during the same auth read.
  const generation=++epoch;
  pending=true;
  try{
   let before;
   try{before=await getActor();}catch{before=null;}
   if(generation!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!actorOk(before)){clear();return fail('AUTH_REQUIRED');}
   if(!next&&!previous)state=blank();
   let result;
   try{result=await gateway.readCatalogPage(branchId,{
    cursor,subject:before.subject,sessionRevision:before.sessionRevision
   });}catch{result=fail('NETWORK_OR_TIMEOUT');}
   if(generation!==epoch)return fail('STALE_RESPONSE_IGNORED');
   let after;
   try{after=await getActor();}catch{after=null;}
   if(generation!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!sameActor(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   if(result?.ok!==true){
    const code=result?.code||'CATALOG_UNAVAILABLE';
    clear();state.error=code;return fail(code);
   }
   const page=acceptablePage(result.data,branchId,now());
   if(!page){
    clear();state.error='INVALID_CATALOG_PAGE';
    return fail('INVALID_CATALOG_PAGE');
   }
   if((next||previous)&&(page.version!==state.version
    ||page.expiresAt!==state.expiresAt)){
    clear();state.error='CATALOG_REVISION_CHANGED';
    return fail('CATALOG_REVISION_CHANGED');
   }
   if(page.nextCursor!==null&&(page.nextCursor===cursor
    ||(next&&state.seen.has(page.nextCursor)))){
    clear();state.error='CURSOR_REPEATED';
    return fail('CURSOR_REPEATED');
   }
   if(next){
    state.anchors.push(cursor);state.seen.add(cursor);state.pageNumber++;
   }else if(previous){
    state.pageNumber--;
    state.anchors=state.anchors.slice(0,state.pageNumber);
    state.seen=new Set(state.anchors.filter(Boolean));
   }else state.pageNumber=1;
   state.branchId=branchId;state.version=page.version;
   state.expiresAt=page.expiresAt;state.nextCursor=page.nextCursor;
   state.items=page.items;state.error=null;
   return Object.freeze({ok:true,pageNumber:state.pageNumber,
    itemsOnPage:page.items.length,globalTotalKnown:false});
  }finally{if(generation===epoch)pending=false;}
 }
 return Object.freeze({load,snapshot,clear,isConfigured:enabled});
}
