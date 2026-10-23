/** G24: servidor determina precio en Gs, sin dinero ni GPS del móvil. */
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const uuid=x=>typeof x==='string'&&ID.test(x);
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fail=(code,status=0)=>({ok:false,code,status});
const keys=['mode','livePaymentsEnabled','serverPriced','ownerId','quoteId','amountGs','fareMode','subjectKind','subjectId','expiresAt','fareVersion','routingVerified','quote'];
export function inspectFareReceipt(x,owner,trip,now){
 if(!obj(x)||Object.keys(x).length!==keys.length||!keys.every(k=>Object.hasOwn(x,k))||
  x.mode!=='STAGING_DEMO_ONLY'||x.livePaymentsEnabled!==false||x.serverPriced!==true||
  x.ownerId!==owner||!uuid(owner)||x.subjectId!==trip||!uuid(trip)||!uuid(x.quoteId)||
  x.fareMode!=='AUTO'||x.subjectKind!=='RIDE'||x.routingVerified!==true||
  !Number.isSafeInteger(x.amountGs)||x.amountGs<1||x.amountGs>100000000||
  !Number.isSafeInteger(x.expiresAt)||x.expiresAt<=now||x.expiresAt>now+3600000||
  typeof x.fareVersion!=='string'||!/^[a-z0-9._-]{1,48}$/i.test(x.fareVersion))return false;
 const q=x.quote;
 if(!obj(q)||q.id!==x.quoteId||q.mode!=='AUTO'||q.subjectKind!=='RIDE'||
  q.subjectId!==trip||q.ruleVersion!==x.fareVersion||q.totalPyg!==x.amountGs||
  typeof q.expiresAt!=='string')return false;
 const expires=Date.parse(q.expiresAt);
 return Number.isFinite(expires)&&Math.abs(expires-x.expiresAt)<=1000;
}
const origin=raw=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash
    &&u.pathname==='/'&&!u.hostname.endsWith('.')?u.origin:null;
 }catch{return null;}
};
const valid=(s,now)=>obj(s)&&s.role==='passenger'&&uuid(s.subject)&&typeof s.token==='string'
 &&s.token.length>=20&&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token&&
 a.expiresAt===b.expiresAt&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision;
export function createFareQuoteGateway({enabled=false,contractCertified=false,origin:source,
 pinnedOrigin,getSession,fetchImpl,onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000}={}){
 const h=origin(source),pin=origin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true&&h!==null&&h===pin
  &&typeof fetchImpl==='function'&&typeof getSession==='function';
 let busy=false;
 async function fetchQuote(tripId,requestKey,expectedSessionRevision=null){
  if(!ready)return fail('FARE_CONTRACT_PENDING');
  if(!uuid(tripId)||!uuid(requestKey))return fail('INVALID_INPUT');
  if(busy)return fail('FARE_IN_FLIGHT');
  busy=true;let timer;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!valid(before,now()))return fail('AUTH_REQUIRED');
   if(expectedSessionRevision!==null&&before.sessionRevision!==expectedSessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ctl=new AbortController();
   timer=setTimeout(()=>ctl.abort(),Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000
    &&timeoutMs<=30000?timeoutMs:8000);
   const r=await fetchImpl(h+'/v1/staging/fares/quote',{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
      'Content-Type':'application/json'},
    body:JSON.stringify({requestKey,fareMode:'AUTO',subjectKind:'RIDE',subjectId:tripId}),signal:ctl.signal
   });
   if(!r||r.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(r.status===401||r.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(!valid(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();return fail(r.status===401?'AUTH_REQUIRED':'FORBIDDEN',r.status);
   }
   if(r.status===409)return fail('QUOTE_CONFLICT',409);
   if(r.status===429)return fail('RATE_LIMITED',429);
   if(r.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(r.status!==201||r.ok!==true)return fail('QUOTE_UNCONFIRMED',r.status);
   if(!/^application\/json(?:\s*;|$)/i.test(r.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const length=r.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>32768))
    return fail('RESPONSE_TOO_LARGE');
   if(typeof r.text!=='function')return fail('BAD_SERVER_RESPONSE');
   const body=await r.text();
   if(typeof body!=='string'||body.length>32768)return fail('RESPONSE_TOO_LARGE');
   let data;
   try{data=JSON.parse(body);}catch{return fail('BAD_SERVER_RESPONSE');}
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(!valid(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
   if(!inspectFareReceipt(data,before.subject,tripId,now()))return fail('INVALID_SERVER_QUOTE');
   return Object.freeze({ok:true,status:201,data});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),fetchQuote});
}
