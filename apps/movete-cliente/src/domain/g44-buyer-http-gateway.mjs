import {readBoundedResponseText} from './bounded-http-response.mjs';
import {projectG44BuyerBranches,projectG44BuyerCatalog} from './g44-buyer-contract.mjs';

/**
 * Transporte Buyer G44 con superficie mínima; solo lectura, jamás pedidos.
 * Las dos rutas están publicadas en OpenAPI G44 de A, pero runtime-wired=false.
 * NO se conecta hasta que A certifique proveedor JWT + HTTPS STAGING real.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const MODES=new Set(['MOTO_DELIVERY','AUTO_DELIVERY']);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&UUID.test(x);
const cursorOk=x=>x===null||(typeof x==='string'&&CURSOR.test(x));
const municipalityOk=x=>typeof x==='string'&&x.length>=2&&x.length<=80
 &&x.trim()===x&&!/[<>\u0000-\u001f\u007f]/u.test(x);
const validSession=(s,now)=>object(s)&&s.role==='passenger'
 &&uuid(s.subject)&&typeof s.token==='string'&&s.token.length>=20
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;
const sameSession=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.role===b.role&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function verifiedOrigin(input){
 try{
  if(typeof input!=='string'||input.includes('\\'))return null;
  const u=new URL(input);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search
   &&!u.hash&&!u.port&&u.pathname==='/'&&!u.hostname.endsWith('.')
   ?u.origin:null;
 }catch{return null;}
}
const statusCode=status=>({
 400:'INVALID_OR_EXPIRED_CURSOR',401:'AUTH_REQUIRED',403:'FORBIDDEN',
 404:'NOT_FOUND',409:'CATALOG_REVISION_CHANGED',429:'RATE_LIMITED',
 503:'SERVICE_UNAVAILABLE'
})[status]??'UNTRUSTED_BUYER_RESPONSE';

export function createG44BuyerHttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},
 now=()=>Date.now(),timeoutMs=8000,maxBytes=131072
}={}){
 const host=verifiedOrigin(origin),pin=verifiedOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&host!==null&&host===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0;
 const active={branches:null,catalog:null};
 function cancelPending(){
  epoch++;
  for(const operation of ['branches','catalog']){
   active[operation]?.abort();
   active[operation]=null;
  }
 }
 async function perform(operation,params){
  if(!ready)return fail('G44_RUNTIME_NOT_CERTIFIED');
  const branchId=params?.branchId,municipality=params?.municipality,
   serviceKind=params?.serviceKind,cursor=params?.cursor??null;
  const requestedActor=params?.subject,requestedRevision=params?.sessionRevision;
  if(!uuid(requestedActor)||!Number.isSafeInteger(requestedRevision)
   ||requestedRevision<0||!cursorOk(cursor)
   ||(operation==='branches'
     ?(!municipalityOk(municipality)||!MODES.has(serviceKind))
     :!uuid(branchId)))return fail('INVALID_G44_QUERY');
  if(active[operation]!==null)return fail('G44_READ_IN_FLIGHT');
  const started=epoch,controller=new AbortController();
  active[operation]=controller;
  let timeout=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!validSession(before,now()))return fail('AUTH_REQUIRED');
   if(before.subject!==requestedActor||before.sessionRevision!==requestedRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000
    &&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>controller.abort(),ms);
   const expired=()=>controller.signal.aborted||now()>=deadline;
   const base=operation==='branches'
    ?'/v1/staging/buyer/branches'
    :'/v1/staging/buyer/branches/'+encodeURIComponent(branchId)+'/catalog';
   const query=operation==='branches'
    ?'municipality='+encodeURIComponent(municipality)
       +'&serviceKind='+encodeURIComponent(serviceKind)
    :'';
   const url=host+base+(query||cursor!==null?'?'+query
    +(query&&cursor!==null?'&':'')
    +(cursor!==null?'cursor='+encodeURIComponent(cursor):''):'');
   const response=await fetchImpl(url,{
    method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'},
    signal:controller.signal
   });
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(response.status===401||response.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
    if(expired())return fail('NETWORK_OR_TIMEOUT');
    if(!validSession(after,now())||!sameSession(before,after))
     return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(statusCode(response.status),response.status);
   }
   if(response.status!==200||response.ok!==true)
    return fail(statusCode(response.status),response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024
    &&maxBytes<=262144?maxBytes:131072;
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const decoded=await readBoundedResponseText(response,{
    limit,signal:controller.signal,timedOut:expired
   });
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!decoded.ok)return fail(decoded.code);
   let dto;
   try{dto=JSON.parse(decoded.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   const projected=operation==='branches'
    ?projectG44BuyerBranches(dto,{municipality,serviceKind})
    :projectG44BuyerCatalog(dto,{branchId,now:now()});
   if(!projected)return fail('INVALID_G44_PAGE');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(expired())return fail('NETWORK_OR_TIMEOUT');
   if(!validSession(after,now())||!sameSession(before,after))
    return fail('STALE_SESSION_RESPONSE');
   // El DTO de wire G44 validado se entrega solo a adaptadores de proyección B.
   // No loguear ni copiar token; nunca devolver datos de otra cuenta.
   const safeData=Object.freeze({...dto,items:Object.freeze(
    dto.items.map(item=>Object.freeze({...item})))});
   return Object.freeze({ok:true,status:200,data:safeData,
    ordersEnabled:false,paymentsEnabled:false});
  }catch{return fail(started!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   if(active[operation]===controller)active[operation]=null;
  }
 }
 return Object.freeze({
  isConfigured:()=>Boolean(ready),cancelPending,
  readBuyerCatalog:(branchId,context={})=>
   perform('catalog',{branchId,...context}),
  readBuyerBranches:(context={})=>perform('branches',context)
 });
}
