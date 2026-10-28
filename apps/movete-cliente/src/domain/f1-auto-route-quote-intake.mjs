/**
 * F1 AUTO: Passenger route-intake -> server attestation -> authoritative quote.
 *
 * Route identity is NEVER derived from an address, a tag, browser geolocation
 * or a fixture. A owns the route resolver, coverage, pricing and SQL.
 * This B-only coordinator is disabled until the independently certified API
 * and HTTPS STAGING runtime are available. It NEVER requests a Driver.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&UUID.test(x);
const ROUTE_FIELDS=['routeId','ownerId','quoteRequestKey','origin','destination',
 'service','routingVerified','coverageVerified','expiresAt','source','status'];
const strict=x=>obj(x)&&Object.keys(x).length===ROUTE_FIELDS.length
 &&ROUTE_FIELDS.every(k=>Object.hasOwn(x,k));
const address=x=>typeof x==='string'&&x.length>=3&&x.length<=120
 &&x.trim()===x&&!/[\u0000-\u001f]/.test(x);
const sameActor=(a,scope,now)=>obj(a)&&a.role==='passenger'
 &&a.subject===scope.ownerId&&uuid(a.subject)
 &&Number.isSafeInteger(a.sessionRevision)
 &&a.sessionRevision===scope.sessionRevision
 &&Number.isSafeInteger(a.expiresAt)&&a.expiresAt>now+1000;
const attested=(value,scope,now)=>strict(value)
 &&uuid(value.routeId)&&value.ownerId===scope.ownerId
 &&value.quoteRequestKey===scope.quoteRequestKey
 &&value.origin===scope.origin&&value.destination===scope.destination
 &&value.service===scope.service
 &&value.routingVerified===true&&value.coverageVerified===true
 &&value.source==='SERVER_VERIFIED_ROUTE'
 &&value.status==='ROUTE_VERIFIED_QA'
 &&Number.isSafeInteger(value.expiresAt)
 &&value.expiresAt>now&&value.expiresAt<=now+600000;

export function createF1AutoRouteQuoteIntake({
 enabled=false,routeContractCertified=false,stagingRuntimeVerified=false,
 routeGateway=null,quoteFlow=null,getActor=null,now=()=>Date.now()
}={}){
 const ready=enabled===true&&routeContractCertified===true
  &&stagingRuntimeVerified===true
  &&typeof routeGateway==='function'&&typeof getActor==='function'
  &&typeof quoteFlow?.prepare==='function'&&typeof quoteFlow?.load==='function'
  &&typeof quoteFlow?.snapshot==='function'
  &&quoteFlow.isQuoteConfigured?.()===true;
 let generation=0,busy=false;
 function clear(){generation++;busy=false;}
 function snapshot(){return Object.freeze({available:ready,busy,productionEnabled:false});}
 async function request({origin,destination,service,ownerId,sessionRevision,
  quoteRequestKey}={}){
  if(!ready)return fail('VERIFIED_ROUTE_CONTRACT_PENDING');
  if(busy)return fail('VERIFIED_ROUTE_IN_FLIGHT');
  if(!address(origin)||!address(destination)
   ||origin.toLocaleLowerCase()===destination.toLocaleLowerCase()
   ||!SERVICES.has(service)||!uuid(ownerId)||!uuid(quoteRequestKey)
   ||!Number.isSafeInteger(sessionRevision)||sessionRevision<0)
   return fail('INVALID_ROUTE_INTENT');
  if(quoteFlow.snapshot().phase!=='idle')
   return fail('PREQUOTE_ALREADY_ACTIVE');
  busy=true;
  const run=++generation;
  const scope=Object.freeze({origin,destination,service,ownerId,
   sessionRevision,quoteRequestKey});
  try{
   let actor;try{actor=await getActor();}catch{actor=null;}
   if(run!==generation)return fail('STALE_ROUTE_RESPONSE');
   if(!sameActor(actor,scope,now()))return fail('SESSION_CHANGED');
   let response;try{response=await routeGateway(scope);}catch{response=null;}
   if(run!==generation)return fail('STALE_ROUTE_RESPONSE');
   let after;try{after=await getActor();}catch{after=null;}
   if(run!==generation)return fail('STALE_ROUTE_RESPONSE');
   if(!sameActor(after,scope,now()))return fail('SESSION_CHANGED');
   if(response?.ok!==true||response.status!==200
    ||!attested(response.data,scope,now()))
    return fail('ROUTE_ATTESTATION_NOT_VERIFIED');
   const prepared=quoteFlow.prepare({routeId:response.data.routeId,
    service,quoteRequestKey,ownerId,sessionRevision});
   if(!prepared?.ok)return fail('PREQUOTE_NOT_READY');
   const quoted=await quoteFlow.load();
   if(run!==generation)return fail('STALE_ROUTE_RESPONSE');
   let finalActor;try{finalActor=await getActor();}catch{finalActor=null;}
   if(run!==generation)return fail('STALE_ROUTE_RESPONSE');
   if(!sameActor(finalActor,scope,now())){
    quoteFlow.clear?.();return fail('SESSION_CHANGED');
   }
   // A quote must not arrive after the independently attested route expired.
   // A sent/uncertain BOOKING is not part of this method; no POST replay.
   if(response.data.expiresAt<=now()){
    quoteFlow.clear?.();return fail('ROUTE_ATTESTATION_EXPIRED');
   }
   if(quoted?.ok!==true)return fail(quoted?.code==='PREQUOTE_NOT_VERIFIED'
    ?'PREQUOTE_NOT_VERIFIED':'PREQUOTE_NOT_READY');
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false,
    routeId:response.data.routeId,quote:quoted.quote});
  }finally{
   if(run===generation)busy=false;
  }
 }
 return Object.freeze({isConfigured:()=>ready,snapshot,request,clear,
  productionEnabled:false});
}
