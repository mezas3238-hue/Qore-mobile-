import {readBoundedResponseText} from './bounded-http-response.mjs';
/** Passenger ratings require an authorized STAGING server with independently
 * verified original service status; frontend never decides who can be rated.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE']);
const TARGETS=new Set(['DRIVER','COURIER','MERCHANT']);
const INCIDENTS=new Set(['SUSPECTED_FRAUD','SAFETY','NO_SHOW','INCORRECT_ITEM','OTHER']);
const fail=code=>Object.freeze({ok:false,code});
const validOrigin=o=>{
 try{
  if(typeof o!=='string'||o.includes('\\'))return null;
  const u=new URL(o);
  return u.protocol==='https:'&&!u.username&&!u.password
   &&!u.search&&!u.hash&&u.pathname==='/'&&!u.port
   &&/^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
};
const auth=(s,at)=>s?.role==='passenger'&&UUID.test(s.subject??'')
 &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>at+1000;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token&&a.expiresAt===b.expiresAt;
export function createG155VerifiedRatingClient({
 enabled=false,ownerApproved=false,contractVerified=false,
 originalCompletionVerified=false,externalRuntimeVerified=false,
 providerRevocationVerified=false,origin,pinnedOrigin,
 getSession,fetchImpl=fetch,now=Date.now
}={}){
 const host=validOrigin(origin);
 const ready=enabled===true&&ownerApproved===true
  &&contractVerified===true&&originalCompletionVerified===true
  &&externalRuntimeVerified===true&&providerRevocationVerified===true
  &&host!==null&&host===validOrigin(pinnedOrigin)
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false;
 async function submit(body){
  if(!ready)return fail('G155_EXTERNAL_CERTIFICATION_REQUIRED');
  if(busy)return fail('G155_BUSY');
  const valid=body!==null&&typeof body==='object'&&!Array.isArray(body)
   &&Object.keys(body).length===6
   &&['requestKey','serviceKind','serviceId','ratedKind','stars','incidentCode']
    .every(k=>Object.hasOwn(body,k))
   &&typeof body.requestKey==='string'&&UUID.test(body.requestKey)
   &&typeof body.serviceId==='string'&&UUID.test(body.serviceId)
   &&KINDS.has(body.serviceKind)&&TARGETS.has(body.ratedKind)
   &&Number.isSafeInteger(body.stars)&&body.stars>=1&&body.stars<=5
   &&(body.incidentCode===null||INCIDENTS.has(body.incidentCode))
   &&(body.ratedKind==='MERCHANT'?body.serviceKind==='COMMERCE':
    body.ratedKind==='DRIVER'?['AUTO_RIDE','MOTO_RIDE'].includes(body.serviceKind):
    ['DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'].includes(body.serviceKind));
  if(!valid)return fail('G155_INVALID_REVIEW');
  busy=true;
  const ctl=new AbortController();
  const deadline=now()+8000,timeout=setTimeout(()=>ctl.abort(),8000);
  try{
   const before=await getSession();
   if(!auth(before,now()))return fail('AUTH_REQUIRED');
   const res=await fetchImpl(host+'/v1/staging/reputation/ratings',{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:ctl.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   const after=await getSession();
   if(!auth(after,now())||!same(before,after))return fail('STALE_SESSION');
   if(ctl.signal.aborted||now()>=deadline)return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');
   if(res?.redirected!==false)return fail('UNTRUSTED_REDIRECT');
   if(res.status===401||res.status===403)return fail('AUTH_REQUIRED');
   if(res.status===409)return fail('G155_NOT_VERIFIED_OR_ALREADY_RATED');
   if(res.status===429)return fail('RATE_LIMITED');
   if(res.status!==201||res.ok!==true)return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');
   if(!/^application\/json(?:\s*;|$)/i.test(res.headers?.get?.('content-type')??''))
    return fail('INVALID_CONTENT_TYPE');
   const content=await readBoundedResponseText(res,{
    limit:4096,signal:ctl.signal,timedOut:()=>ctl.signal.aborted||now()>=deadline
   });
   if(!content.ok)return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');
   let d;try{d=JSON.parse(content.text);}catch{return fail('INVALID_RECEIPT');}
   if(!d||typeof d!=='object'||Array.isArray(d)
    ||Object.keys(d).length!==11
    ||!UUID.test(d.ratingId??'')||d.serviceId!==body.serviceId
    ||d.serviceKind!==body.serviceKind||d.ratedKind!==body.ratedKind
    ||d.stars!==body.stars||d.requestKey!==body.requestKey
    ||d.serverPersisted!==true||d.qaOnly!==true
    ||d.productionEnabled!==false||d.dispatchPriorityChanged!==false
    ||d.automatedSuspension!==false)return fail('INVALID_RECEIPT');
   const final=await getSession();
   if(!auth(final,now())||!same(before,final))return fail('STALE_SESSION');
   return Object.freeze({ok:true,ratingId:d.ratingId,
    qaOnly:true,dispatchPriorityChanged:false,productionEnabled:false});
  }catch{return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');}
  finally{clearTimeout(timeout);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,submit});
}
