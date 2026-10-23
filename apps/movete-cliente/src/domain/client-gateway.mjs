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
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port) return null;
    return url.origin;
  }catch{return null;}
}
/**
 * API desactivada a menos que el integrador establezca explicitamente enabled,
 * HTTPS staging pinned, fetch y un proveedor de sesión; nunca persiste token.
 * El proveedor de sesión NO sustituye validación JWT de backend.
 */
export function createClientGateway({
  origin, pinnedOrigin, enabled=false, getSession, fetchImpl,
  onSessionInvalid=()=>{}, timeoutMs=8000
}={}){
  const actual=safeOrigin(origin), pinned=safeOrigin(pinnedOrigin);
  const configured=enabled===true && actual && pinned && actual===pinned
    &&typeof getSession==='function'&&typeof fetchImpl==='function';
  async function send(op,{id,body}={}){
    if(!configured)return fail('NOT_CONFIGURED');
    const path=CLIENT_ENDPOINTS[op];
    if(!path)return fail('OPERATION_DENIED');
    if(op==='orderRequest')return fail('CONTRACT_PENDING'); // sin schema de líneas certificada
    const isRead=['rideStatus','deliveryStatus','orderStatus'].includes(op);
    if(isRead?!isUuid(id):!validateClientOperation(op,body))return fail('INVALID_INPUT');
    let session;
    try{session=await getSession();}catch{return fail('SESSION_UNAVAILABLE');}
    if(!object(session)||session.role!=='passenger'||typeof session.token!=='string'
      ||session.token.length<20||!Number.isFinite(session.expiresAt)
      ||session.expiresAt<=Date.now()+1000)return fail('AUTH_REQUIRED');
    const url=actual+path.replace(/\{\w+\}/g,encodeURIComponent(id||''));
    const controller=new AbortController();
    const timer=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
    let timeout;
    try{
      timeout=setTimeout(()=>controller.abort(),timer);
      const response=await fetchImpl(url,{
        method:isRead?'GET':'POST',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{Authorization:'Bearer '+session.token,Accept:'application/json',...(!isRead?{'Content-Type':'application/json'}:{})},
        ...(!isRead?{body:JSON.stringify(body)}:{}),signal:controller.signal
      });
      if(response.redirected)return fail('UNTRUSTED_REDIRECT');
      if(response.status===401||response.status===403){
        onSessionInvalid();
        return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
      }
      if(response.status===429)return fail('RATE_LIMITED',429);
      if(response.status===503)return fail('SERVICE_UNAVAILABLE',503);
      if(!response.ok)return fail('REQUEST_REJECTED',response.status);
      let data;
      try{data=await response.json();}catch{return fail('BAD_SERVER_RESPONSE',response.status);}
      if(!object(data))return fail('BAD_SERVER_RESPONSE',response.status);
      return accepted(data,response.status);
    }catch{return fail('NETWORK_OR_TIMEOUT');}
    finally{clearTimeout(timeout);}
  }
  return Object.freeze({isConfigured:()=>Boolean(configured),send});
}
