/** Concurrency-safe client fare workflow. Does not store money or credentials. */
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
export function createFareQuoteFlow({gateway,getActor,onAccept=()=>false}={}){
 let state={phase:'idle',subject:null,tripId:null,requestKey:null,sessionRevision:null,error:null},epoch=0;
 function clear(){epoch++;state={phase:'idle',subject:null,tripId:null,requestKey:null,sessionRevision:null,error:null};}
 function snapshot(){return Object.freeze({phase:state.phase,tripId:state.tripId,
  requestKey:state.requestKey,error:state.error,contractReady:Boolean(gateway?.isConfigured?.())});}
 function prepare({tripId,requestKey,subject,sessionRevision=null}={}){
  if(state.phase==='in_flight')return fail('FARE_IN_FLIGHT');
  if(state.phase==='retryable')return fail('EXPLICIT_RETRY_REQUIRED');
  if(state.phase==='acknowledged')return fail('ALREADY_QUOTED');
  if(state.phase==='failed')return fail('RESET_FARE_FIRST');
  if(!ID.test(tripId??'')||!ID.test(requestKey??'')||!ID.test(subject??'')
   ||(sessionRevision!==null&&(!Number.isSafeInteger(sessionRevision)||sessionRevision<0)))
   return fail('INVALID_INPUT');
  epoch++;state={phase:'ready',subject,tripId,requestKey,sessionRevision,error:null};
  return Object.freeze({ok:true,requestKey});
 }
 async function run(retry=false){
  if(state.phase==='retryable'&&!retry)return fail('EXPLICIT_RETRY_REQUIRED');
  if(!['ready','retryable'].includes(state.phase))return fail('NO_READY_QUOTE');
  if(!gateway?.isConfigured?.())return fail('FARE_CONTRACT_PENDING');
  const seq=++epoch,{subject,tripId,requestKey,sessionRevision}=state;
  state.phase='in_flight';state.error=null;
  let actor;
  try{actor=await getActor();}catch{if(seq!==epoch)return fail('STALE_RESPONSE');clear();return fail('AUTH_UNAVAILABLE');}
  if(seq!==epoch)return fail('STALE_RESPONSE');
  if(actor?.role!=='passenger'||actor.subject!==subject
   ||(sessionRevision!==null&&actor.sessionRevision!==sessionRevision)){
   clear();return fail('SESSION_CHANGED');
  }
  let result;
  try{result=await gateway.fetchQuote(tripId,requestKey,sessionRevision);}
  catch{result=fail('NETWORK_OR_TIMEOUT');}
  if(seq!==epoch)return fail('STALE_RESPONSE');
  if(result?.ok){
   let current;
   try{current=await getActor();}catch{clear();return fail('AUTH_UNAVAILABLE');}
   if(seq!==epoch)return fail('STALE_RESPONSE');
   if(current?.role!=='passenger'||current.subject!==subject
    ||(sessionRevision!==null&&current.sessionRevision!==sessionRevision)){
    clear();return fail('SESSION_CHANGED');
   }
   if(onAccept(result.data,subject,tripId)!==true){
    state.phase='failed';state.error='QUOTE_REJECTED';return fail('QUOTE_REJECTED');
   }
   state.phase='acknowledged';return Object.freeze({ok:true,status:201,requestKey});
  }
  const code=result?.code??'QUOTE_UNCONFIRMED';
  if(['AUTH_REQUIRED','FORBIDDEN','STALE_SESSION_RESPONSE'].includes(code)){
   clear();return fail(code);
  }
  state.phase=['NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE'].includes(code)
   ?'retryable':'failed';
  state.error=code;return fail(code);
 }
 return Object.freeze({clear,snapshot,prepare,submit:()=>run(false),retry:()=>run(true)});
}
