/** Browser Admin: UI-only. Nunca usa service role o endpoints privilegiados sin A.
 * Estado actual: contrato admin de lectura y Auth administrativo pendientes.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code,status=0)=>({ok:false,code,status});
const originOf=x=>{
 try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password
   &&!u.search&&!u.hash&&u.pathname==='/'&&!u.port?u.origin:null;}catch{return null;}
};
export const ADMIN_ACTIONS=Object.freeze({
 vehicleReview:'/v1/staging/admin/vehicle-reviews'
});
export function isValidReview(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const required=['requestKey','vehicleId','approve','reason'];
 return required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>required.includes(k))
   &&UUID.test(value.requestKey||'')&&UUID.test(value.vehicleId||'')
   &&typeof value.approve==='boolean'&&typeof value.reason==='string'
   &&value.reason.trim().length>=12&&value.reason.length<=500;
}
export function createAdminGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,getSession,fetchImpl
}={}){
 const actual=originOf(origin),pinned=originOf(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true&&actual&&pinned&&actual===pinned
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 async function reviewVehicle(body){
  if(!ready)return fail('ADMIN_CONTRACT_PENDING');
  if(!isValidReview(body))return fail('INVALID_INPUT');
  let session;
  try{session=await getSession();}catch{return fail('AUTH_REQUIRED');}
  if(!session||session.role!=='admin'||typeof session.token!=='string'
    ||session.token.length<20||!Number.isFinite(session.expiresAt)
    ||session.expiresAt<=Date.now()+1000)return fail('AUTH_REQUIRED');
  try{
   const result=await fetchImpl(actual+ADMIN_ACTIONS.vehicleReview,{
    method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
    headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify(body)
   });
   if(result.redirected)return fail('UNTRUSTED_REDIRECT');
   if(result.status===401)return fail('AUTH_REQUIRED',401);
   if(result.status===403)return fail('FORBIDDEN',403);
   if(result.status===429)return fail('RATE_LIMITED',429);
   if(!result.ok)return fail('SERVER_DENIED',result.status);
   const data=await result.json();
   if(!data||typeof data!=='object'||Array.isArray(data))return fail('BAD_SERVER_RESPONSE');
   return {ok:true,data,status:result.status};
  }catch{return fail('NETWORK_FAILURE');}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),reviewVehicle});
}
