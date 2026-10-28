import {projectQaIncidentReceipt,validateIncidentG40Request} from './incident-g40-gateway.mjs';

/**
 * G40: controller efímero de incidente estructurado.
 * La clave de idempotencia NO cambia tras resultado incierto. El recibo
 * implica persistencia QA solamente: ningún despacho SOS/operador.
 */
const fail=code=>Object.freeze({ok:false,code});
const actorValid=(value,subject,revision)=>value&&value.role==='passenger'
 &&value.subject===subject&&value.sessionRevision===revision;
export function createIncidentReportFlow({gateway,getActor,now=()=>Date.now()}={}){
 let generation=0;
 let state={phase:'idle',subject:null,sessionRevision:null,request:null,
  receipt:null,statusFresh:false,error:null};
 const publicState=()=>Object.freeze({
  phase:state.phase,requestKey:state.request?.requestKey??null,
  receipt:state.receipt?Object.freeze({...state.receipt}):null,
  statusFresh:state.statusFresh,
  error:state.error,
  contractReady:Boolean(gateway?.isConfigured?.()),
  qaDatabaseOnly:true,sosDispatched:false,operatorNotified:false
 });
 const clear=()=>{
  generation++;
  state={phase:'idle',subject:null,sessionRevision:null,request:null,
   receipt:null,statusFresh:false,error:null};
 };
 function prepare({request,subject,sessionRevision}={}){
  if(!gateway?.isConfigured?.())return fail('INCIDENT_RUNTIME_NOT_CERTIFIED');
  if(state.phase==='in_flight'||state.phase==='checking')return fail('INCIDENT_IN_FLIGHT');
  if(state.phase==='retryable')return fail('EXPLICIT_RETRY_REQUIRED');
  if(state.phase==='acknowledged')return fail('ALREADY_RECEIVED_IN_QA');
  if(state.phase==='failed')return fail('RECONCILIATION_REQUIRED');
  if(!validateIncidentG40Request(request)||typeof subject!=='string'
   ||!Number.isSafeInteger(sessionRevision)||sessionRevision<0)
   return fail('INVALID_INPUT');
  generation++;
  state={phase:'ready',subject,sessionRevision,request:Object.freeze({...request}),
   receipt:null,statusFresh:false,error:null};
  return Object.freeze({ok:true,requestKey:request.requestKey,submitted:false});
 }
 function discard(){
  if(state.phase!=='ready')return fail('NOT_UNSENT_INCIDENT');
  clear();return Object.freeze({ok:true});
 }
 async function send(retry=false){
  if(state.phase==='retryable'&&!retry)return fail('EXPLICIT_RETRY_REQUIRED');
  if(!['ready','retryable'].includes(state.phase))return fail('NO_READY_INCIDENT');
  if(!gateway?.isConfigured?.())return fail('INCIDENT_RUNTIME_NOT_CERTIFIED');
  if(typeof getActor!=='function')return fail('AUTH_REQUIRED');
  const started=++generation,subject=state.subject,revision=state.sessionRevision,
   payload=state.request;
  state.phase='in_flight';state.error=null;
  let actor;
  try{actor=await getActor();}catch{actor=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!actorValid(actor,subject,revision)){clear();return fail('SESSION_CHANGED');}
  let response;
  try{response=await gateway.report(payload,revision);}
  catch{response=fail('NETWORK_OR_TIMEOUT');}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  let latest;
  try{latest=await getActor();}catch{latest=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!actorValid(latest,subject,revision)){clear();return fail('SESSION_CHANGED');}
  if(response?.ok===true){
   const receipt=response.qaDatabaseOnly===true
    &&response.sosDispatched===false&&response.operatorNotified===false
    ?projectQaIncidentReceipt(response.receipt,{now:now()}):null;
   if(!receipt){
    state.phase='failed';state.error='INVALID_INCIDENT_RECEIPT';
    return fail('INVALID_INCIDENT_RECEIPT');
   }
   state.phase='acknowledged';state.receipt=receipt;state.statusFresh=true;
   state.error=null;return Object.freeze({ok:true,qaDatabaseOnly:true,
    sosDispatched:false,operatorNotified:false,receipt});
  }
  const code=response?.code??'INCIDENT_RECEIPT_NOT_CONFIRMED';
  if(['AUTH_REQUIRED','FORBIDDEN','SESSION_CHANGED','STALE_SESSION_RESPONSE'].includes(code)){
   clear();return fail(code);
  }
  state.phase=['NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE'].includes(code)
   ?'retryable':'failed';
  state.statusFresh=false;state.error=code;
  return fail(code);
 }
 async function refresh(){
  if(state.phase!=='acknowledged'||!state.receipt)return fail('NO_CONFIRMED_QA_RECEIPT');
  if(!gateway?.isConfigured?.())return fail('INCIDENT_RUNTIME_NOT_CERTIFIED');
  if(typeof getActor!=='function')return fail('AUTH_REQUIRED');
  const started=++generation,subject=state.subject,revision=state.sessionRevision,
   current=state.receipt;
  state.phase='checking';state.statusFresh=false;
  let actor;try{actor=await getActor();}catch{actor=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!actorValid(actor,subject,revision)){clear();return fail('SESSION_CHANGED');}
  let response;
  try{response=await gateway.status(current.incidentId,current.revision);}
  catch{response=fail('NETWORK_OR_TIMEOUT');}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  let latest;try{latest=await getActor();}catch{latest=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!actorValid(latest,subject,revision)){clear();return fail('SESSION_CHANGED');}
  const receipt=response?.ok&&response.qaDatabaseOnly===true
   &&response.sosDispatched===false&&response.operatorNotified===false
   ?projectQaIncidentReceipt(response.receipt,{now:now(),
     incidentId:current.incidentId,minimumRevision:current.revision}):null;
  state.phase='acknowledged';
  if(!receipt){
   state.error=response?.code||'INVALID_INCIDENT_RECEIPT';
   return fail(state.error);
  }
  if(receipt.receiptId!==current.receiptId){
   state.error='RECEIPT_MISMATCH';return fail('RECEIPT_MISMATCH');
  }
  state.receipt=receipt;state.statusFresh=true;state.error=null;
  return Object.freeze({ok:true,receipt,qaDatabaseOnly:true,
   sosDispatched:false,operatorNotified:false});
 }
 return Object.freeze({
  prepare,discard,submit:()=>send(false),retry:()=>send(true),refresh,clear,
  snapshot:publicState
 });
}
