import {validateClientOperation} from './client-gateway.mjs';

/**
 * Cliente: orquestación efímera para solicitudes idempotentes. Un solo requestKey
 * por intento de usuario, incluso con timeout. Ningún ID ni token se persiste.
 * El backend es quien decide autorización, duplicados, tarifa y asignación.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MUTATIONS=new Set(['rideRequest','deliveryRequest','fareQuote','paymentAuthorize']);
const fail=(code)=>({ok:false,code});
function copy(value){return JSON.parse(JSON.stringify(value));}
export function createClientMutationController({gateway,getSession,clearSensitive=()=>{}}={}){
 let state={phase:'idle',subject:null,operation:null,body:null,requestKey:null,
  sessionRevision:null,error:null};
 let generation=0;
 const publicState=()=>Object.freeze({
  phase:state.phase,operation:state.operation,requestKey:state.requestKey,error:state.error
 });
 function clear(){
  generation++;
  state={phase:'idle',subject:null,operation:null,body:null,requestKey:null,
   sessionRevision:null,error:null};
  clearSensitive();
 }
 function prepare({operation,body,subject,sessionRevision=null}={}){
  if(state.phase==='in_flight')return fail('REQUEST_IN_FLIGHT');
  if(state.phase==='retryable')return fail('EXPLICIT_RETRY_REQUIRED');
  if(state.phase==='acknowledged')return fail('ALREADY_ACKNOWLEDGED');
  // No crear un segundo requestKey tras una respuesta no concluyente (p.ej. 409).
  if(state.phase==='failed')return fail('RECONCILE_BEFORE_NEW_REQUEST');
  if(!MUTATIONS.has(operation)||!validateClientOperation(operation,body)
    ||typeof subject!=='string'||!UUID.test(subject)
    ||(sessionRevision!==null&&(!Number.isSafeInteger(sessionRevision)||sessionRevision<0)))
   return fail('INVALID_INPUT');
  if(state.subject&&state.subject!==subject)clear();
  generation++;
  state={phase:'ready',subject,operation,body:copy(body),requestKey:body.requestKey,
   sessionRevision,error:null};
  return {ok:true,requestKey:state.requestKey};
 }
 async function run(retry=false){
  if(!['ready','retryable'].includes(state.phase))return fail('NO_READY_REQUEST');
  if(retry!==true&&state.phase==='retryable')return fail('EXPLICIT_RETRY_REQUIRED');
  if(!gateway||typeof gateway.send!=='function'||!getSession)return fail('GATEWAY_UNAVAILABLE');
  // La exclusión de doble envío debe suceder ANTES del primer await.
  // Dos taps síncronos no pueden pasar ambos la comprobación de phase.
  const started=++generation;
  const expectedSubject=state.subject;
  const expectedSessionRevision=state.sessionRevision;
  const operation=state.operation;
  const body=copy(state.body);
  state.phase='in_flight';state.error=null;
  let session;
  try{session=await getSession();}
  catch{
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   clear();return fail('AUTH_UNAVAILABLE');
  }
  if(started!==generation||state.subject!==expectedSubject)return fail('STALE_RESPONSE_IGNORED');
  if(!session||session.role!=='passenger'||session.subject!==expectedSubject
   ||(expectedSessionRevision!==null&&session.sessionRevision!==expectedSessionRevision)){
   clear();return fail('SESSION_CHANGED');
  }
  let reply;
  try{reply=await gateway.send(operation,{body,expectedSessionRevision,expectedSubject});}
  catch{reply=fail('NETWORK_OR_TIMEOUT');}
  if(started!==generation||state.subject!==session.subject)return fail('STALE_RESPONSE_IGNORED');
  if(reply&&reply.ok===true){
   state.phase='acknowledged';state.error=null;
   // No se guardan DTOs no certificados ni datos privados del servidor.
   return {ok:true,requestKey:state.requestKey,status:reply.status};
  }
  const code=typeof reply?.code==='string'?reply.code:'REQUEST_REJECTED';
  if(['AUTH_REQUIRED','FORBIDDEN','SESSION_CHANGED'].includes(code)){
   clear();return fail(code);
  }
  state.error=code;
  // R57: a booking POST may have COMMITTED before timeout, 409 or a
  // malformed ACK. Never issue another POST, even with the same key,
  // until the independently certified READ reconciles its outcome.
  state.phase=gateway?.bookingReconciliationRequired===true
   &&['rideRequest','deliveryRequest'].includes(operation)
   ?'failed'
   :['NETWORK_OR_TIMEOUT','SERVICE_UNAVAILABLE','RATE_LIMITED'].includes(code)
    ?'retryable':'failed';
  return fail(code);
 }
 async function reconcileBooking(){
  if(gateway?.bookingReconciliationRequired!==true
   ||typeof gateway.reconcile!=='function')
   return fail('BOOKING_RECONCILIATION_NOT_CERTIFIED');
  if(state.phase!=='failed'
   ||!['rideRequest','deliveryRequest'].includes(state.operation))
   return fail('NO_BOOKING_TO_RECONCILE');
  if(!getSession)return fail('AUTH_UNAVAILABLE');
  const started=++generation;
  const expectedSubject=state.subject;
  const expectedSessionRevision=state.sessionRevision;
  const operation=state.operation,requestKey=state.requestKey;
  state.phase='in_flight';
  let actor;
  try{actor=await getSession();}catch{actor=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!actor||actor.role!=='passenger'||actor.subject!==expectedSubject
   ||actor.sessionRevision!==expectedSessionRevision){
   clear();return fail('SESSION_CHANGED');
  }
  let reply;
  try{reply=await gateway.reconcile(operation,{
   requestKey,expectedSubject,expectedSessionRevision
  });}catch{reply=fail('BOOKING_RECONCILIATION_UNKNOWN');}
  if(started!==generation||state.subject!==expectedSubject)
   return fail('STALE_RESPONSE_IGNORED');
  let after;
  try{after=await getSession();}catch{after=null;}
  if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
  if(!after||after.role!=='passenger'||after.subject!==expectedSubject
   ||after.sessionRevision!==expectedSessionRevision){
   clear();return fail('SESSION_CHANGED');
  }
  if(reply?.ok===true&&reply.recoveredWithoutPost===true
   &&reply.qaOnly===true&&reply.bookingConfirmedForProduction===false){
   state.phase='acknowledged';state.error=null;
   return Object.freeze({ok:true,requestKey,status:200,
    qaOnly:true,productionEnabled:false});
  }
  state.phase='failed';
  state.error=reply?.code??'BOOKING_RECONCILIATION_UNKNOWN';
  return fail(state.error);
 }
 return Object.freeze({prepare,submit:()=>run(false),retry:()=>run(true),
  reconcileBooking,clear,publicState});
}
