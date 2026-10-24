/**
 * G61A — independent Driver chat HTTPS STAGING transport.
 *
 * An approved HTTPS host is injected by the composition root; never inferred
 * from the bearer, server headers, push payload or a passenger-controlled URL.
 * There is NO builtin host, IdP, session store or production override.
 * Endpoints mirror the current G58/G60B localhost contract; an externally
 * authorized gateway must actually implement and independently secure them.
 */
export const DRIVER_CHAT_HTTPS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const CURSOR=/^[A-Za-z0-9_.-]{30,2048}$/;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const fail=(status=503,code='DRIVER_CHAT_UNAVAILABLE')=>Object.freeze({
 status,body:Object.freeze({code,qaOnly:true,retrySafe:false})
});
function stagingOrigin(value,pinnedHost){
 if(typeof value!=='string'||typeof pinnedHost!=='string'||
    pinnedHost.length>200||!pinnedHost.toLowerCase().includes('staging')||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(pinnedHost)||
    pinnedHost.includes('..')||
    pinnedHost==='localhost'||
    /^\d+\.\d+\.\d+\.\d+$/.test(pinnedHost))
  throw Error('G61 HTTPS requires independently approved staging DNS hostname');
 let url;
 try{url=new URL(value);}catch{throw Error('G61 invalid HTTPS staging origin');}
 if(url.protocol!=='https:'||url.hostname!==pinnedHost||
  url.origin!==value||url.port||url.pathname!=='/'||
  url.username||url.password||url.search||url.hash||
  url.hostname.endsWith('.local'))
  throw Error('G61 refuses unapproved, insecure or ambiguous API origin');
 return url.origin;
}
const service=x=>['RIDE','DELIVERY','MERCHANT_ORDER'].includes(x);
const validToken=x=>typeof x==='string'&&TOKEN.test(x);
const bodyText=x=>typeof x==='string'&&x.length>0&&x.length<=500&&
 x===x.trim()&&new TextEncoder().encode(x).length<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
function encodedCursor(value){
 if(value===null)return '';
 if(typeof value!=='string'||!CURSOR.test(value))
  throw Error('G61 invalid opaque server cursor');
 return '&cursor='+encodeURIComponent(value);
}
function route(prefix,kind,serviceId,conversationId){
 if(!service(kind)||!UUID.test(serviceId)||!UUID.test(conversationId))
  throw Error('G61 foreign Driver conversation scope');
 return prefix+'/services/'+kind+'/'+serviceId.toLowerCase()+
  '/conversations/'+conversationId.toLowerCase();
}
export function createDriverChatHttpsStagingAdapters({
 apiOrigin,approvedStagingHost,request,makeRequestKey,verifyStopped,
 now=Date.now,timeoutMs=4500,liveEnabled=false,
 allowedByOwner=false
}={}){
 if(liveEnabled!==false||allowedByOwner!==true||
  [request,makeRequestKey,verifyStopped,now].some(f=>typeof f!=='function')||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1500||timeoutMs>10000)
  throw Error('G61 only with explicit staging authorization and trusted callbacks');
 const origin=stagingOrigin(apiOrigin,approvedStagingHost);
 async function execute(path,token,{method='GET',payload=null}={}){
  if(!validToken(token)||typeof path!=='string'||!path.startsWith('/v1/staging/'))
   return fail(400,'INVALID_DRIVER_CHAT_REQUEST');
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
   const response=await request(origin+path,{
    method,redirect:'error',credentials:'omit',cache:'no-store',
    signal:ctrl.signal,headers:{
     authorization:'Bearer '+token,accept:'application/json',
     ...(method==='POST'?{'content-type':'application/json'}:{})
    },
    ...(method==='POST'?{body:JSON.stringify(payload)}:{})
   });
   if(!response||!safe(response.status)||!response.headers||
    typeof response.headers.get!=='function'||
    typeof response.text!=='function')
    return fail();
   const status=response.status;
   if(![200,400,401,403,404,409,413,415,429,503].includes(status))
    return fail();
   // A JSON/error page or a redirect can never impersonate a persisted ACK.
   const mime=response.headers.get('content-type');
   const cache=response.headers.get('cache-control');
   if(typeof mime!=='string'||!/^application\/json(?:;|$)/i.test(mime)||
     typeof cache!=='string'||!cache.toLowerCase().includes('no-store'))
    return fail(503,'INVALID_DRIVER_CHAT_RESPONSE');
   const raw=await response.text();
   if(typeof raw!=='string'||raw.length<2||raw.length>200000)
    return fail(503,'INVALID_DRIVER_CHAT_RESPONSE');
   let data;
   try{data=JSON.parse(raw);}catch{return fail(503,'INVALID_DRIVER_CHAT_RESPONSE');}
   if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.getPrototypeOf(data)!==Object.prototype)
    return fail(503,'INVALID_DRIVER_CHAT_RESPONSE');
   if(status!==200){
    // Never allow an untrusted response to instruct resend.
    return fail(status,
     status===401?'DRIVER_CHAT_SESSION_EXPIRED':
     status===403?'DRIVER_CHAT_FORBIDDEN':
     status===409?'DRIVER_CHAT_CONFLICT':
     status===429?'DRIVER_CHAT_RATE_LIMITED':
     'DRIVER_CHAT_OUTCOME_UNKNOWN');
   }
   return Object.freeze({status:200,body:data});
  }catch{
   // A request may have COMMITTED before this timeout/network error.
   return fail(503,'DRIVER_CHAT_OUTCOME_UNKNOWN');
  }finally{clearTimeout(timer);}
 }
 const path='/v1/staging/driver/chat';
 return Object.freeze({
  async readInbox({bearer,cursor=null,limit=50}={}){
   if(!Number.isInteger(limit)||limit<1||limit>100)return fail(400);
   let seek;
   try{seek=encodedCursor(cursor);}catch{return fail(400);}
   return execute(path+'/conversations?limit='+limit+seek,bearer);
  },
  async readHistory({bearer,serviceKind,serviceId,
   conversationId,cursor=null,limit=50}={}){
   if(!Number.isInteger(limit)||limit<1||limit>100)return fail(400);
   let endpoint,seek;
   try{endpoint=route(path,serviceKind,serviceId,conversationId);
     seek=encodedCursor(cursor);}catch{return fail(400);}
   return execute(endpoint+'/history-with-ordered-markers?limit='+limit+seek,bearer);
  },
  async send({bearer,serviceKind,serviceId,
   conversationId,requestKey,body}={}){
   let endpoint;
   try{endpoint=route(path,serviceKind,serviceId,conversationId);}
   catch{return fail(400);}
   if(!UUID.test(requestKey)||!bodyText(body))return fail(400);
   return execute(endpoint+'/send',bearer,{
    method:'POST',payload:{requestKey,body}
   });
  },
  async reconcile({bearer,serviceKind,serviceId,
   conversationId,requestKey,body}={}){
   let endpoint;
   try{endpoint=route(path,serviceKind,serviceId,conversationId);}
   catch{return fail(400);}
   if(!UUID.test(requestKey)||!bodyText(body))return fail(400);
   // Read-only recovery is a different operation, no implicit SEND retry.
   return execute(endpoint+'/reconcile',bearer,{
    method:'POST',payload:{requestKey,body}
   });
  },
  async markVisible({bearer,conversationId,messageId,marker}={}){
   if(!UUID.test(conversationId)||!UUID.test(messageId)||
    !UUID.test(marker))return fail(400);
   return execute(path+'/conversations/'+conversationId.toLowerCase()+
    '/mark-visible-ordered',bearer,{
    method:'POST',payload:{messageId,marker}
   });
  },
  makeRequestKey:async()=>{
   const k=await makeRequestKey();
   if(!UUID.test(k))throw Error('G61 CSPRNG provided invalid request UUID');
   return k;
  },
  verifyStopped:async()=>{// Mobile-side safety guard is not server authority.
   const evidence=await verifyStopped();
   const at=now();
   if(!exact(evidence,['vehicleStopped','source','observedAtMs'])||
    evidence.vehicleStopped!==true||
    evidence.source!=='trusted_navigation'||
    !safe(at)||!safe(evidence.observedAtMs)||
    evidence.observedAtMs>at||at-evidence.observedAtMs>5000)
    return Object.freeze({vehicleStopped:false,source:'unverified',
     observedAtMs:safe(at)?at:0});
   return Object.freeze({...evidence});
  }
 });
}
