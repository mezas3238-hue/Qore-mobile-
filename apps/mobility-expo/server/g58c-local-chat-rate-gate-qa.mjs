/**
 * G58C A43: bounded fixed-window chat budget in isolated QA only.
 * Call ONLY with the independently verified actor from G42, never an IP or
 * actor supplied by mobile JSON. Real distributed throttling still needed.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS=new Set([
 'DRIVER_INBOX','DRIVER_HISTORY','DRIVER_MARK_VISIBLE_ORDERED',
 'CHAT_HISTORY','CHAT_MARK_VISIBLE_ORDERED'
]);
export function createG58CLocalChatRateGateQa({
 environment,localQaOnly,liveEnabled,now=Date.now,
 maxRequestsPerMinute=30,maxTrackedActors=512
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||typeof now!=='function'||
  !Number.isInteger(maxRequestsPerMinute)||maxRequestsPerMinute<1||
  maxRequestsPerMinute>100||!Number.isInteger(maxTrackedActors)||
  maxTrackedActors<2||maxTrackedActors>10000)
  throw Error('G58C only supports bounded isolated QA budget');
 const budget=new Map();
 let lastTime=-1;
 return Object.freeze({allowRequest(input){
  const actor=input?.actorId??input?.userId;
  if((input?.actorId!==undefined&&input?.userId!==undefined)||
   typeof actor!=='string'||!UUID.test(actor)||
   !OPERATIONS.has(input?.operation))return false;
  let ms;
  try{ms=now();}catch{return false;}
  if(!Number.isSafeInteger(ms)||ms<0||ms<lastTime)return false;
  lastTime=ms;
  const bucket=Math.floor(ms/60000);
  let row=budget.get(actor);
  if(row&&row.bucket!==bucket){
   budget.delete(actor);row=null;
  }
  if(!row){
   if(budget.size>=maxTrackedActors){
    for(const [key,value] of budget){
     if(value.bucket!==bucket)budget.delete(key);
    }
    if(budget.size>=maxTrackedActors)return false;
   }
   row={bucket,count:0};budget.set(actor,row);
  }
  if(row.count>=maxRequestsPerMinute)return false;
  row.count++;
  return true;
 }});
}
