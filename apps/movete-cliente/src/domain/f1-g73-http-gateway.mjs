import {readBoundedResponseText} from './bounded-http-response.mjs';
/**
 * F1 G73 canonical Passenger HTTP transport. Four *separate* mutations/reads
 * sharing a pinned STAGING HTTPS origin and one verified session authority.
 * CI lab contract != authorization to connect or run commercial traffic.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const K=['route','quote','book','reconcile'];
const PATH=Object.freeze({
 route:'/v1/staging/rider/auto/routes',
 quote:'/v1/staging/rider/auto/prequote',
 book:'/v1/staging/rider/auto/book'
});
const ROUTE=['routeId','ownerId','quoteRequestKey','origin','destination',
 'service','routingVerified','coverageVerified','expiresAt','source','status'];
const QUOTE=['mode','commercialEnabled','ownerId','routeId','quoteId',
 'quoteRequestKey','fareMode','service','currency','amountGs','fareVersion',
 'expiresAt','serverPriced','routingVerified','status'];
const BOOK=['mode','commercialEnabled','ownerId','requestKey','quoteId',
 'routeId','tripId','revision','serverPersisted','status'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&ID.test(x);
const exact=(x,a)=>object(x)&&Object.keys(x).length===a.length&&a.every(k=>Object.hasOwn(x,k));
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const address=x=>typeof x==='string'&&x.length>=3&&x.length<=120
 &&x.trim()===x&&!/[\u0000-\u001f]/.test(x);
const version=x=>typeof x==='string'&&/^[a-z0-9._-]{1,48}$/i.test(x);
function pinOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password
   &&!url.hash&&!url.search&&!url.port&&!url.hostname.endsWith('.')
   &&url.pathname==='/'?url.origin:null;
 }catch{return null;}
}
const sessionOk=(a,t)=>object(a)&&a.role==='passenger'&&id(a.subject)
 &&typeof a.token==='string'&&a.token.length>=20&&a.token.length<=7900
 &&Number.isSafeInteger(a.authRevision)&&a.authRevision>=0
 &&Number.isSafeInteger(a.sessionRevision)&&a.sessionRevision>=0
 &&Number.isSafeInteger(a.expiresAt)&&a.expiresAt>t+1000;
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
function goodRoute(x,s,t){
 return exact(x,ROUTE)&&id(x.routeId)&&x.ownerId===s.ownerId
  &&x.quoteRequestKey===s.quoteRequestKey
  &&x.origin===s.origin&&x.destination===s.destination
  &&x.service===s.service&&x.routingVerified===true
  &&x.coverageVerified===true&&x.source==='SERVER_VERIFIED_ROUTE'
  &&x.status==='ROUTE_VERIFIED_QA'&&Number.isSafeInteger(x.expiresAt)
  &&x.expiresAt>t&&x.expiresAt<=t+600000;
}
function goodQuote(x,s,t){
 return exact(x,QUOTE)&&x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false
  &&x.ownerId===s.ownerId&&x.routeId===s.routeId
  &&id(x.quoteId)&&x.quoteRequestKey===s.quoteRequestKey
  &&x.fareMode==='AUTO'&&x.service===s.service
  &&x.currency==='PYG'&&Number.isSafeInteger(x.amountGs)
  &&x.amountGs>=1&&x.amountGs<=100000000
  &&version(x.fareVersion)&&Number.isSafeInteger(x.expiresAt)
  &&x.expiresAt>t&&x.expiresAt<=t+3600000
  &&x.serverPriced===true&&x.routingVerified===true&&x.status==='QUOTED_QA';
}
function goodBook(x,s){
 return exact(x,BOOK)&&x.mode==='STAGING_DEMO_ONLY'
  &&x.commercialEnabled===false&&x.ownerId===s.ownerId
  &&x.requestKey===s.requestKey&&x.quoteId===s.quoteId
  &&x.routeId===s.routeId&&id(x.tripId)&&Number.isSafeInteger(x.revision)
  &&x.revision>=1&&x.serverPersisted===true&&x.status==='ACCEPTED_QA';
}
const validScope=(kind,s)=>{
 if(!object(s)||!id(s.ownerId)||!Number.isSafeInteger(s.sessionRevision)
  ||s.sessionRevision<0)return false;
 if(kind==='route')return id(s.quoteRequestKey)&&address(s.origin)
  &&address(s.destination)&&s.origin.toLocaleLowerCase()!==s.destination.toLocaleLowerCase()
  &&SERVICES.has(s.service);
 if(kind==='quote')return id(s.quoteRequestKey)&&id(s.routeId)
  &&SERVICES.has(s.service);
 if(kind==='book')return id(s.requestKey)&&id(s.quoteId)&&id(s.routeId)
  &&version(s.fareVersion)&&SERVICES.has(s.service);
 return id(s.requestKey)&&id(s.quoteId)&&id(s.routeId);
};
/**
 * An external runtime owner MUST attest independently that provider-backed
 * route/coverage, IdP and persistent PG are mounted. This client deliberately
 * offers no boolean alias for production permission.
 */
export function createF1G73HttpGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 routeProviderCertified=false,origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,maxBytes=32768
}={}){
 const host=pinOrigin(origin),pin=pinOrigin(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&routeProviderCertified===true
  &&host!==null&&host===pin&&typeof getSession==='function'
  &&typeof fetchImpl==='function';
 let epoch=0,controller=null;
 function cancelPending(){
  epoch++;
  controller?.abort();
  controller=null;
 }
 async function execute(kind,scope){
  if(!ready)return fail('G73_STAGING_NOT_CERTIFIED');
  if(!K.includes(kind)||!validScope(kind,scope))return fail('INVALID_G73_SCOPE');
  if(controller!==null)return fail('G73_REQUEST_IN_FLIGHT');
  const run=epoch,ctl=new AbortController();
  controller=ctl;
  let timeout=null;
  try{
   let actor;
   try{actor=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!sessionOk(actor,now()))return fail('AUTH_REQUIRED');
   if(actor.subject!==scope.ownerId||actor.sessionRevision!==scope.sessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
    ?timeoutMs:8000,deadline=now()+ms;
   timeout=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const method=kind==='reconcile'?'GET':'POST';
   const path=kind==='reconcile'
    ?'/v1/staging/rider/auto/bookings/'+encodeURIComponent(scope.requestKey)
    :PATH[kind];
   const body=kind==='route'
    ?{quoteRequestKey:scope.quoteRequestKey,origin:scope.origin,
      destination:scope.destination,service:scope.service}
    :kind==='quote'?{requestKey:scope.quoteRequestKey,routeId:scope.routeId}
    :kind==='book'?{requestKey:scope.requestKey,quoteId:scope.quoteId,accepted:true}
    :null;
   const response=await fetchImpl(host+path,{
    method,redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+actor.token,Accept:'application/json',
     ...(body===null?{}:{'Content-Type':'application/json'})},
    ...(body===null?{}:{body:JSON.stringify(body)}),
    signal:ctl.signal
   });
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(run!==epoch||timedOut())return fail('STALE_SESSION_RESPONSE');
   if(!sessionOk(after,now())||!same(actor,after))
    return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    onSessionInvalid();
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN',response.status);
   }
   const expected=kind==='book'?201:200;
   if(response.status!==expected||response.ok!==true){
    const statuses={400:'BAD_REQUEST',404:'NOT_FOUND',409:'CONFLICT',
     410:'EXPIRED',429:'RATE_LIMITED',503:'SERVICE_UNAVAILABLE'};
    return fail(statuses[response.status]??'G73_SERVER_UNVERIFIED',response.status);
   }
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=65536
    ?maxBytes:32768;
   const len=response.headers?.get?.('content-length');
   if(len!==null&&len!==undefined&&(!/^\d+$/.test(len)||Number(len)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const read=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(run!==epoch||timedOut())return fail('STALE_SESSION_RESPONSE');
   if(!read.ok)return fail(read.code);
   let data;try{data=JSON.parse(read.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(kind==='route'?!goodRoute(data,scope,now())
    :kind==='quote'?!goodQuote(data,scope,now()):!goodBook(data,scope))
    return fail('G73_RECEIPT_NOT_VERIFIED');
   // Response processing itself can span a JWT rotation.
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(run!==epoch||timedOut())return fail('STALE_SESSION_RESPONSE');
   if(!sessionOk(after,now())||!same(actor,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:expected,data:Object.freeze({...data}),
    qaOnly:true,productionEnabled:false});
  }catch{return fail(run!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   if(controller===ctl)controller=null;
  }
 }
 return Object.freeze({isConfigured:()=>ready,cancelPending,
  resolveRoute:s=>execute('route',s),
  readQuote:s=>execute('quote',s),
  bookQuote:s=>execute('book',s),
  reconcile:s=>execute('reconcile',s),
  productionEnabled:false});
}
