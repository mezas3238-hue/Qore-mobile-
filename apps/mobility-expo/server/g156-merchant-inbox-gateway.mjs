/** G156: staff-only original merchant inbox. QA only, never LIVE. */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ROUTE=/^\/v1\/staging\/merchant\/([0-9a-f-]{36})\/orders\/inbox$/i;
const AUTH=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const states=new Set(['requested','confirmed','preparing','ready','handed_to_courier','delivered','cancelled']);
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
const fail=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export function createG156MerchantInboxGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,allowRequest,loadInbox,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,allowRequest,loadInbox,now]
 .some(x=>typeof x!=='function'))throw Error('G156 verification authority required');
 return async({method,path,headers={},body}={})=>{
  const m=method==='GET'&&typeof path==='string'?ROUTE.exec(path):null;
  if(!m||!UUID.test(m[1])||m[1]!==m[1].toLowerCase())
   return fail(404,'G156_NOT_FOUND');
  if(body!==undefined&&body!==null)return fail(400,'G156_GET_BODY');
  const token=typeof headers.authorization==='string'&&!headers.Authorization&&
   !headers.cookie?AUTH.exec(headers.authorization)?.[1]:null;
  if(!token)return fail(401,'G156_BEARER_REQUIRED');
  let user;try{user=await verifyAccessToken(token);}catch{
   return fail(401,'G156_UNVERIFIED');
  }
  const at=now();
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id??'')||!UUID.test(user.sessionId??'')||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)return fail(401,'G156_UNVERIFIED');
  try{if(await verifySessionNotRevoked({
   userId:user.id,sessionId:user.sessionId,
    tokenIatMs:user.tokenIatMs,at})!==true)
   return fail(401,'G156_REVOKED');
  }catch{return fail(503,'G156_REVOCATION_DOWN');}
  try{if(allowRequest({userId:user.id,operation:'merchant.inbox'})!==true)
   return fail(429,'G156_LIMIT');}catch{return fail(503,'G156_LIMIT_DOWN');}
  let r;try{r=await loadInbox({actorId:user.id,merchantId:m[1],
   sessionId:user.sessionId,tokenIatMs:user.tokenIatMs});}
  catch{return fail(403,'G156_MERCHANT_DENIED');}
  if(!exact(r,['merchantId','orders','limit','serverPersisted','qaOnly','productionEnabled'])||
   r.merchantId!==m[1]||!Array.isArray(r.orders)||r.orders.length>20||
   r.limit!==20||r.serverPersisted!==true||r.qaOnly!==true||
   r.productionEnabled!==false)return fail(503,'G156_INVALID_RECEIPT');
  for(const o of r.orders){
   if(!exact(o,['orderId','branchId','status','revision','vehicleKind',
     'subtotalPyg','deliveryId','lineCount','itemUnits','createdAt'])||
    !UUID.test(o.orderId??'')||!UUID.test(o.branchId??'')||
    !states.has(o.status)||!['AUTO','MOTO'].includes(o.vehicleKind)||
    !Number.isSafeInteger(o.revision)||o.revision<1||
    !Number.isSafeInteger(o.subtotalPyg)||o.subtotalPyg<100||
    !Number.isSafeInteger(o.lineCount)||o.lineCount<1||o.lineCount>50||
    !Number.isSafeInteger(o.itemUnits)||o.itemUnits<1||
    (o.deliveryId!==null&&!UUID.test(o.deliveryId??''))||
    typeof o.createdAt!=='string'||!Number.isFinite(Date.parse(o.createdAt)))
     return fail(503,'G156_INVALID_RECEIPT');
  }
  try{if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,
    tokenIatMs:user.tokenIatMs,at:now()})!==true)
    return fail(401,'G156_REVOKED');}
  catch{return fail(503,'G156_REVOCATION_DOWN');}
  return {status:200,body:{mode:'STAGING_DEMO_ONLY',liveCommerceEnabled:false,
   merchantId:m[1],orders:r.orders,limit:20,serverPersisted:true}};
 };
}
