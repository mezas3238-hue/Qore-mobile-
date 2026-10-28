import {readBoundedResponseText} from './bounded-http-response.mjs';
/**
 * Cliente B — cancelación propia STAGING, contrato OpenAPI G11 del Arquitecto A.
 * Una cancelación confirmada NO confirma reembolso, comisión ni saldo:
 * se debe recuperar el estado persistido con GET del servidor.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const fail=(code,status=0)=>Object.freeze({ok:false,code,status});
const originOf=value=>{
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash
   ||url.pathname!=='/'||url.port||url.hostname.endsWith('.'))return null;
  return url.origin;
 }catch{return null;}
};
const validAuth=(s,now)=>s&&uuid(s.subject)&&s.role==='passenger'
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isFinite(s.expiresAt)&&s.expiresAt>now+1000
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.authRevision===b.authRevision&&a.expiresAt===b.expiresAt
 &&a.sessionRevision===b.sessionRevision;
const receipt=(json,id)=>json&&typeof json==='object'&&!Array.isArray(json)
 &&Object.keys(json).length===6
 &&['mode','commercialRidesEnabled','tripId','event','eventId','serverPersisted']
   .every(key=>Object.hasOwn(json,key))
 &&json.mode==='STAGING_DEMO_ONLY'&&json.commercialRidesEnabled===false
 &&json.tripId===id&&json.event==='cancel'&&uuid(json.eventId)
 &&json.serverPersisted===true;
export function createRideCancellationGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000
}={}){
 const base=originOf(origin),pin=originOf(pinnedOrigin);
 const configured=enabled===true&&contractCertified===true&&base!==null&&base===pin
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let inFlight=false;
 async function cancel(tripId,requestKey,expectedSessionRevision=null){
  if(!configured)return fail('CANCEL_CONTRACT_PENDING');
  if(!uuid(tripId)||!uuid(requestKey))return fail('INVALID_INPUT');
  if(inFlight)return fail('CANCEL_IN_FLIGHT');
  inFlight=true;
  let timeout=null;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!validAuth(before,now()))return fail('AUTH_REQUIRED');
   if(expectedSessionRevision!==null&&before.sessionRevision!==expectedSessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const ctl=new AbortController();
   const ms=Number.isSafeInteger(timeoutMs)
    &&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;
   timeout=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const result=await fetchImpl(base+'/v1/staging/rider/trips/'+encodeURIComponent(tripId)+'/cancel',{
    method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',headers:{
     Authorization:'Bearer '+before.token,'Content-Type':'application/json',
     Accept:'application/json'
    },body:JSON.stringify({requestKey}),signal:ctl.signal
   });
   // No interpretar ACK ni 401/403 tardíos como confirmación de cancelación.
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!result||result.redirected===true)return fail('UNTRUSTED_REDIRECT');
   if(result.status===401||result.status===403){
    let after;
    try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
    if(!validAuth(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
    onSessionInvalid();
    return fail(result.status===401?'AUTH_REQUIRED':'FORBIDDEN',result.status);
   }
   if(result.status===409)return fail('CONFLICT_RELOAD_TRIP',409);
   if(result.status===429)return fail('RATE_LIMITED',429);
   if(result.status===503)return fail('SERVICE_UNAVAILABLE',503);
   if(result.status!==200||result.ok!==true)return fail('CANCEL_UNCONFIRMED',result.status);
   const kind=result.headers?.get?.('content-type');
   if(typeof kind!=='string'||!/^application\/json(?:\s*;|$)/i.test(kind))
    return fail('BAD_CONTENT_TYPE');
   const length=result.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>8192))
    return fail('BAD_SERVER_RESPONSE');
   const bodyResult=await readBoundedResponseText(result,{
    limit:8192,signal:ctl.signal,timedOut
   });
   if(!bodyResult.ok)return fail(bodyResult.code==='RESPONSE_TOO_LARGE'
    ?'BAD_SERVER_RESPONSE':bodyResult.code);
   const body=bodyResult.text;
   let json;
   try{json=JSON.parse(body);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!receipt(json,tripId))return fail('INVALID_CANCEL_RECEIPT');
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!validAuth(after,now())||!same(before,after))return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:200,refreshRequired:true,eventId:json.eventId});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{
   if(timeout!==null)clearTimeout(timeout);
   inFlight=false;
  }
 }
 return Object.freeze({isConfigured:()=>Boolean(configured),cancel});
}
export function createRideCancellationController({gateway,getSession}={}){
 let state={phase:'idle',subject:null,tripId:null,requestKey:null,sessionRevision:null};
 let generation=0;
 const clear=()=>{generation++;state={phase:'idle',subject:null,tripId:null,requestKey:null,sessionRevision:null};};
 const snapshot=()=>Object.freeze({phase:state.phase,tripId:state.tripId,
  requestKey:state.requestKey,contractReady:Boolean(gateway?.isConfigured?.())});
 function prepare({tripId,requestKey,subject,sessionRevision=null}={}){
  if(state.phase==='in_flight')return fail('CANCEL_IN_FLIGHT');
  // Después de timeout, 409 o ACK, nunca fabricar otro eventKey para el mismo
  // viaje: una nueva clave podría duplicar una transición ya persistida.
  if(state.phase==='retryable')return fail('EXPLICIT_RETRY_REQUIRED');
  if(state.phase==='acknowledged')return fail('ALREADY_ACKNOWLEDGED');
  if(state.phase==='failed')return fail('RELOAD_TRIP_BEFORE_NEW_CANCEL');
  if(!uuid(tripId)||!uuid(requestKey)||!uuid(subject)
   ||(sessionRevision!==null&&(!Number.isSafeInteger(sessionRevision)||sessionRevision<0)))
   return fail('INVALID_INPUT');
  if(state.subject&&state.subject!==subject)clear();
  generation++;state={phase:'ready',tripId,requestKey,subject,sessionRevision};
  return Object.freeze({ok:true,requestKey});
 }
 async function run(retry=false){
  if(state.phase==='retryable'&&!retry)return fail('EXPLICIT_RETRY_REQUIRED');
  if(!['ready','retryable'].includes(state.phase))return fail('NO_READY_CANCEL');
  if(!gateway?.isConfigured?.()||!getSession)return fail('CANCEL_CONTRACT_PENDING');
  const started=++generation,actor=state.subject,tripId=state.tripId,
   requestKey=state.requestKey,sessionRevision=state.sessionRevision;
  state.phase='in_flight';
  let session;
  try{session=await getSession();}catch{if(started!==generation)return fail('STALE_RESPONSE_IGNORED');clear();return fail('AUTH_UNAVAILABLE');}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!session||session.role!=='passenger'||session.subject!==actor
   ||(sessionRevision!==null&&session.sessionRevision!==sessionRevision)){
   clear();return fail('SESSION_CHANGED');
  }
  let response;
  try{response=await gateway.cancel(tripId,requestKey,sessionRevision);}
  catch{response=fail('NETWORK_OR_TIMEOUT');}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(response?.ok===true){
   state.phase='acknowledged';
   // Solo un evento cancel persistido, no cambio optimista de estado.
   return Object.freeze({ok:true,refreshRequired:true});
  }
  const code=response?.code||'CANCEL_UNCONFIRMED';
  if(['AUTH_REQUIRED','FORBIDDEN','SESSION_CHANGED','STALE_SESSION_RESPONSE'].includes(code)){
   clear();return fail(code);
  }
  state.phase=['NETWORK_OR_TIMEOUT','SERVICE_UNAVAILABLE','RATE_LIMITED'].includes(code)?'retryable':'failed';
  return fail(code,response?.status||0);
 }
 return Object.freeze({prepare,submit:()=>run(false),retry:()=>run(true),clear,snapshot});
}
