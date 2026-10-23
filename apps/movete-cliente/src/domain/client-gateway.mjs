/**
 * Movete Fácil CLIENTE: boundary HTTP para QA. No LIVE y no token almacenado.
 * JWT/roles/propiedad son comprobados por servidor, no por este módulo.
 * Basado en el catálogo OpenAPI staging de A; availability != deployment.
 */
export const CLIENT_ENDPOINTS = Object.freeze({
  rideRequest: '/v1/staging/rider/trips/request',
  rideStatus: '/v1/staging/rider/trips/{tripId}/status',
  deliveryRequest: '/v1/staging/sender/deliveries/request',
  deliveryStatus: '/v1/staging/deliveries/{deliveryId}/status',
  fareQuote: '/v1/staging/fares/quote',
  orderRequest: '/v1/staging/buyer/orders/request',
  orderStatus: '/v1/staging/orders/{orderId}/status',
  paymentAuthorize: '/v1/staging/payments/authorize'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string' && UUID.test(x);
const tag=x=>typeof x==='string' && x.trim().length>=3 && x.trim().length<=120;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const fail=(code,status=0)=>({ok:false,code,status});
const accepted=(data,status)=>({ok:true,data,status});
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const keys=(o,required,allowed=required)=>object(o)&&required.every(k=>Object.hasOwn(o,k))&&Object.keys(o).every(k=>allowed.includes(k));
export function validateClientOperation(op,body){
  if(op==='rideRequest'){
    return keys(body,['requestKey','originTag','destinationTag','service'])
      &&isUuid(body.requestKey)&&tag(body.originTag)&&tag(body.destinationTag)
      &&body.originTag.trim().toLowerCase()!==body.destinationTag.trim().toLowerCase()
      &&['economico','confort','xl'].includes(body.service);
  }
  if(op==='deliveryRequest'){
    return keys(body,['requestKey','vehicleKind','category','grams','lengthCm','widthCm','heightCm','pickupTag','deliveryTag','restrictedItemDeclared'])
      &&isUuid(body.requestKey) && ['AUTO','MOTO'].includes(body.vehicleKind)
      &&['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT'].includes(body.category)
      &&positive(body.grams)&&body.grams<=100000
      &&['lengthCm','widthCm','heightCm'].every(k=>positive(body[k])&&body[k]<=200)
      &&(body.vehicleKind!=='MOTO'||body.grams<=10000)
      &&tag(body.pickupTag)&&tag(body.deliveryTag)
      &&body.pickupTag.trim().toLowerCase()!==body.deliveryTag.trim().toLowerCase()
      &&body.restrictedItemDeclared===false;
  }
  if(op==='fareQuote'){
    return keys(body,['requestKey','fareMode','subjectKind','subjectId'])
      &&isUuid(body.requestKey)&&isUuid(body.subjectId)
      &&['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY'].includes(body.fareMode)
      &&['RIDE','DELIVERY','MERCHANT_ORDER'].includes(body.subjectKind);
  }
  if(op==='orderRequest'){
    return keys(body,['requestKey','branchId','vehicleKind','items'])
      &&isUuid(body.requestKey)&&isUuid(body.branchId)&&['AUTO','MOTO'].includes(body.vehicleKind)
      &&Array.isArray(body.items)&&body.items.length>=1&&body.items.length<=50
      &&body.items.every(line=>keys(line,['itemId','quantity'])
        &&isUuid(line.itemId)&&positive(line.quantity)&&line.quantity<=999);
      // Validación de request del OpenAPI. Envío aún bloqueado por DTO response pendiente.
  }
  if(op==='paymentAuthorize'){
    return keys(body,['requestKey','quoteId','method'])&&isUuid(body.requestKey)
      &&isUuid(body.quoteId)&&['SIMULATED_CASH','SIMULATED_CARD'].includes(body.method);
  }
  return false;
}

function safeOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
    u.port||u.pathname!=='/'||u.hostname.endsWith('.'))return null;
  return u.origin;
 }catch{return null;}
}
const validAuth=(s,now)=>object(s)&&s.role==='passenger'&&isUuid(s.subject)
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000;
const sameAuth=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.authRevision===b.authRevision&&a.expiresAt===b.expiresAt
 &&a.sessionRevision===b.sessionRevision;
/**
 * QA-only. Enabled origin is not sufficient: contracts and each operation
 * must be explicitly certified. 201 = HTTP ACK, NOT business completion.
 */
export function createClientGateway({
 origin,pinnedOrigin,enabled=false,contractCertified=false,certifiedOperations=[],
 getSession,fetchImpl,onSessionInvalid=()=>{},now=()=>Date.now(),
 timeoutMs=8000,maxBytes=32768
}={}){
 const actual=safeOrigin(origin),pinned=safeOrigin(pinnedOrigin);
 const configured=enabled===true&&contractCertified===true&&actual!==null&&actual===pinned
  &&typeof getSession==='function'&&typeof fetchImpl==='function'
  &&Array.isArray(certifiedOperations);
 const granted=new Set(certifiedOperations.filter(x=>Object.hasOwn(CLIENT_ENDPOINTS,x)));
 const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=262144?maxBytes:32768;
 const timeout=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
 let busy=false;
 async function session(){try{return await getSession();}catch{return null;}}
 async function send(op,{id,body,expectedSessionRevision=null}={}){
  if(!configured)return fail('NOT_CONFIGURED');
  if(!Object.hasOwn(CLIENT_ENDPOINTS,op))return fail('OPERATION_DENIED');
  if(['fareQuote','rideStatus','orderRequest'].includes(op))
   return fail('DEDICATED_GATEWAY_REQUIRED');
  if(!granted.has(op))return fail('CONTRACT_PENDING');
  const isRead=['deliveryStatus','orderStatus'].includes(op);
  if(isRead?!isUuid(id):!validateClientOperation(op,body))return fail('INVALID_INPUT');
  if(busy)return fail('REQUEST_IN_FLIGHT');
  busy=true;let timer=null;
  try{
   const before=await session();
   if(!validAuth(before,now()))return fail('AUTH_REQUIRED');
   // Un borrador preparado por otra identidad de sesión nunca debe salir
   // bajo un JWT nuevo, aunque el subject del pasajero sea el mismo.
   if(expectedSessionRevision!==null&&before.sessionRevision!==expectedSessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const url=actual+CLIENT_ENDPOINTS[op].replace(/\{\w+\}/g,()=>encodeURIComponent(id??''));
   const ctl=new AbortController();
   timer=setTimeout(()=>ctl.abort(),timeout);
   const reply=await fetchImpl(url,{
    method:isRead?'GET':'POST',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
      ...(!isRead?{'Content-Type':'application/json'}:{})},
    ...(!isRead?{body:JSON.stringify(body)}:{}),signal:ctl.signal
   });
   if(!reply||reply.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(reply.status===401||reply.status===403){
    const after=await session();
    if(!validAuth(after,now())||!sameAuth(before,after))
     return fail('STALE_SESSION_RESPONSE');
    try{onSessionInvalid();}catch{/* no secret logging */ }
    return fail(reply.status===401?'AUTH_REQUIRED':'FORBIDDEN',reply.status);
   }
   if(reply.status===400)return fail('BAD_REQUEST',400);
   if(reply.status===404)return fail('NOT_FOUND',404);
   if(reply.status===409)return fail('CONFLICT_RECONCILE',409);
   if(reply.status===429)return fail('RATE_LIMITED',429);
   if(reply.status===503)return fail('SERVICE_UNAVAILABLE',503);
   const expected=isRead?200:201;
   if(reply.status!==expected||reply.ok!==true)return fail('REQUEST_REJECTED',reply.status);
   const contentType=reply.headers?.get?.('content-type');
   if(typeof contentType!=='string'||!/^application\/json(?:\s*;|$)/i.test(contentType))
    return fail('BAD_CONTENT_TYPE');
   const length=reply.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))
    return fail('RESPONSE_TOO_LARGE');
   if(typeof reply.text!=='function')return fail('BAD_SERVER_RESPONSE');
   const raw=await reply.text();
   if(typeof raw!=='string'||raw.length>limit)return fail('RESPONSE_TOO_LARGE');
   let payload;
   try{payload=JSON.parse(raw);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!object(payload))return fail('BAD_SERVER_RESPONSE');
   const after=await session();
   if(!validAuth(after,now())||!sameAuth(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return accepted(payload,expected);
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(configured),send});
}
