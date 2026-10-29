/**
 * Reciprocal G155 Driver -> CLIENT review. All eligibility/participant and
 * completion checks remain authoritative in G155 PostgreSQL (G42/G67).
 * Explicitly disabled for LIVE; this is an opt-in STAGING client, not an
 * authorization to operate or score dispatches.
 */
export const DRIVER_VERIFIED_RATING_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const KINDS=new Set(['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO']);
const INCIDENTS=new Set(['SUSPECTED_FRAUD','SAFETY','NO_SHOW','INCORRECT_ITEM','OTHER']);
const fail=code=>Object.freeze({ok:false,code});
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
export function validDriverClientRating(body){
 return exact(body,['requestKey','serviceKind','serviceId','ratedKind','stars','incidentCode'])
  &&UUID.test(body.requestKey??'')&&UUID.test(body.serviceId??'')
  &&KINDS.has(body.serviceKind)&&body.ratedKind==='CLIENT'
  &&Number.isSafeInteger(body.stars)&&body.stars>=1&&body.stars<=5
  &&(body.incidentCode===null||INCIDENTS.has(body.incidentCode));
}
function validOrigin(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   !u.search&&!u.hash&&u.pathname==='/'&&
   /^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
}
const validSession=s=>exact(s,['role','userId','accessToken'])&&
 s.role==='driver'&&UUID.test(s.userId)&&TOKEN.test(s.accessToken);
const same=(a,b)=>a.userId===b.userId&&a.accessToken===b.accessToken;
async function readBounded(res,within){
 const declared=res.headers?.get?.('content-length');
 if(declared!==null&&declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>4096))
  throw Error('oversized response');
 if(!res.body||typeof res.body.getReader!=='function'){
  const str=await within(res.text());
  if(typeof str!=='string'||str.length>4096)throw Error('oversized response');
  return str;
 }
 const reader=res.body.getReader(),decoder=new TextDecoder();
 let size=0,result='';
 try{
  while(true){
   const chunk=await within(reader.read());
   if(chunk.done)break;
   size+=chunk.value?.byteLength??0;
   if(size>4096)throw Error('oversized response');
   result+=decoder.decode(chunk.value,{stream:true});
  }
  return result+decoder.decode();
 }finally{try{await reader.cancel();}catch{/* response already closed */}}
}
export function createDriverVerifiedRating({
 enabled=false,ownerApproved=false,contractVerified=false,
 originalCompletionVerified=false,externalRuntimeVerified=false,
 providerRevocationVerified=false,apiOrigin,pinnedOrigin,
 getSession,request=fetch,now=Date.now
}={}){
 const origin=validOrigin(apiOrigin);
 const ready=enabled===true&&ownerApproved===true&&contractVerified===true&&
  originalCompletionVerified===true&&externalRuntimeVerified===true&&
  providerRevocationVerified===true&&origin!==null&&
  origin===validOrigin(pinnedOrigin)&&typeof getSession==='function'&&
  typeof request==='function'&&typeof now==='function';
 let busy=false;
 return Object.freeze({
  isConfigured:()=>ready,
  async submit(body){
   if(!ready)return fail('G155_EXTERNAL_CERTIFICATION_REQUIRED');
   if(busy)return fail('G155_BUSY');
   if(!validDriverClientRating(body))return fail('G155_INVALID_REVIEW');
   busy=true;
   const controller=new AbortController();
   let timer;
   const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(Error('G155 timeout'));},8000);
   });
   const within=promise=>Promise.race([promise,timeout]);
   try{
    const before=await within(getSession());
    if(!validSession(before))return fail('G155_DRIVER_AUTH_REQUIRED');
    const res=await within(request(origin+'/v1/staging/reputation/ratings',{
     method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
     referrerPolicy:'no-referrer',signal:controller.signal,
     headers:{authorization:'Bearer '+before.accessToken,
      accept:'application/json','content-type':'application/json'},
     body:JSON.stringify(body)
    }));
    const after=await within(getSession());
    if(!validSession(after)||!same(before,after))
     return fail('G155_AUTH_CHANGED');
    if(controller.signal.aborted||res?.redirected!==false)
     return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');
    if(res.status===401||res.status===403)return fail('G155_DRIVER_AUTH_REQUIRED');
    if(res.status===409)return fail('G155_UNVERIFIED_OR_ALREADY_RATED');
    if(res.status===429)return fail('G155_RATE_LIMITED');
    if(res.status!==201||res.ok!==true)
     return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');
    if(!/^application\/json(?:\s*;|$)/i.test(res.headers?.get?.('content-type')??''))
     return fail('G155_INVALID_RECEIPT');
    const text=await readBounded(res,within);
    let receipt;
    try{receipt=JSON.parse(text);}catch{return fail('G155_INVALID_RECEIPT');}
    if(!exact(receipt,['ratingId','serviceId','serviceKind','ratedKind','stars',
      'requestKey','serverPersisted','qaOnly','productionEnabled',
      'dispatchPriorityChanged','automatedSuspension'])
      ||!UUID.test(receipt.ratingId??'')||
      receipt.serviceId!==body.serviceId||receipt.serviceKind!==body.serviceKind||
      receipt.ratedKind!=='CLIENT'||receipt.stars!==body.stars||
      receipt.requestKey!==body.requestKey||receipt.serverPersisted!==true||
      receipt.qaOnly!==true||receipt.productionEnabled!==false||
      receipt.dispatchPriorityChanged!==false||receipt.automatedSuspension!==false)
     return fail('G155_INVALID_RECEIPT');
    const last=await within(getSession());
    if(!validSession(last)||!same(before,last))return fail('G155_AUTH_CHANGED');
    return Object.freeze({ok:true,ratingId:receipt.ratingId,
     qaOnly:true,productionEnabled:false,dispatchPriorityChanged:false});
   }catch{return fail('G155_OUTCOME_UNKNOWN_REUSE_KEY');}
   finally{clearTimeout(timer);busy=false;}
  }
 });
}
