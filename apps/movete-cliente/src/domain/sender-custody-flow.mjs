/**
 * R62 — sender-owned DELIVERY status read model aligned with G66.
 * IMPORTANT: Courier G66 GET is driver-only. Never call it as Passenger.
 * A must publish/certify a distinct sender-authorized HTTPS GET and DTO.
 * This capability is OFF by default and stores no bearer, phone or address.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
const KINDS=new Set(['AUTO','MOTO']);
const FIELDS=['mode','deliveryId','ownerId','state','revision','vehicleKind',
 'assignmentPersisted','proofVerified','qaOnly','productionEnabled','liveDeliveriesEnabled'];
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&UUID.test(x);
const exact=x=>obj(x)&&Object.keys(x).length===FIELDS.length
 &&FIELDS.every(k=>Object.hasOwn(x,k));
const validSession=(s,at)=>obj(s)&&s.role==='passenger'&&uuid(s.subject)
 &&typeof s.token==='string'&&s.token.length>=20
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>at+1000;
const sameSession=(a,b)=>a.subject===b.subject&&a.token===b.token
 &&a.expiresAt===b.expiresAt&&a.sessionRevision===b.sessionRevision;
function proof(dto,deliveryId,subject){
 if(!exact(dto)||dto.mode!=='STAGING_DEMO_ONLY'
  ||dto.deliveryId!==deliveryId||dto.ownerId!==subject
  ||!STATES.has(dto.state)||!KINDS.has(dto.vehicleKind)
  ||!Number.isSafeInteger(dto.revision)||dto.revision<1
  ||typeof dto.assignmentPersisted!=='boolean'
  ||typeof dto.proofVerified!=='boolean'
  ||dto.qaOnly!==true||dto.productionEnabled!==false
  ||dto.liveDeliveriesEnabled!==false)return false;
 if(dto.state==='requested'&&(dto.assignmentPersisted||dto.proofVerified))return false;
 if(['accepted','picked_up','delivered','disputed','returned'].includes(dto.state)
  &&dto.assignmentPersisted!==true)return false;
 if(['delivered','disputed','returned'].includes(dto.state)&&dto.proofVerified!==true)return false;
 if(dto.state==='cancelled'&&dto.proofVerified!==false)return false;
 if(['requested','accepted','picked_up'].includes(dto.state)
  &&dto.proofVerified!==false)return false;
 return true;
}
export function createSenderCustodyFlow({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 readOwnDelivery=null,getSession,now=()=>Date.now()
}={}){
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&typeof readOwnDelivery==='function'
  &&typeof getSession==='function'&&typeof now==='function';
 let epoch=0,busy=false,record=null,error=null;
 function clear(){epoch++;busy=false;record=null;error=null;}
 function snapshot(){
  return Object.freeze({readReady:Boolean(ready),loading:busy,
   deliveryId:record?.deliveryId??null,revision:record?.revision??-1,
   state:record?.state??null,vehicleKind:record?.vehicleKind??null,
   proofVerified:record?.proofVerified??false,
   error,qaOnly:true,productionEnabled:false});
 }
 async function refresh(deliveryId,expectedSubject,expectedSessionRevision){
  if(!ready)return fail('SENDER_CUSTODY_NOT_CERTIFIED');
  if(!uuid(deliveryId)||!uuid(expectedSubject)
   ||!Number.isSafeInteger(expectedSessionRevision)
   ||expectedSessionRevision<0)return fail('INVALID_SENDER_CUSTODY_SCOPE');
  if(busy)return fail('SENDER_CUSTODY_READ_IN_FLIGHT');
  // Never expose a previous proof while another GET may replace its scope.
  const prior=record;record=null;
  const generation=++epoch;busy=true;error=null;
  try{
   let before;
   try{before=await getSession();}catch{before=null;}
   if(generation!==epoch)return fail('STALE_CUSTODY_RESPONSE');
   if(!validSession(before,now())||before.subject!==expectedSubject
    ||before.sessionRevision!==expectedSessionRevision){
    clear();return fail('SENDER_CUSTODY_SESSION_CHANGED');
   }
   let response;
   try{
    // Server must verify bearer Passenger AND sender_id independently.
    response=await readOwnDelivery(Object.freeze({
     deliveryId,ownerId:expectedSubject,
     sessionRevision:expectedSessionRevision,bearer:before.token
    }));
   }catch{response=fail('SENDER_CUSTODY_UNAVAILABLE');}
   if(generation!==epoch)return fail('STALE_CUSTODY_RESPONSE');
   let after;
   try{after=await getSession();}catch{after=null;}
   if(!validSession(after,now())||!sameSession(before,after)){
    clear();return fail('SENDER_CUSTODY_SESSION_CHANGED');
   }
   if(response?.ok!==true||response.status!==200
    ||!proof(response.data,deliveryId,expectedSubject)){
    // Never leave an old delivered proof visible after an uncertain read.
    record=null;error='SENDER_CUSTODY_UNVERIFIED';
    return fail(error);
   }
   const dto=response.data;
   if(prior!==null&&prior.deliveryId===deliveryId&&dto.revision<prior.revision){
    record=null;error='SENDER_CUSTODY_STALE_REVISION';
    return fail(error);
   }
   record=Object.freeze({deliveryId:dto.deliveryId,
    revision:dto.revision,state:dto.state,vehicleKind:dto.vehicleKind,
    proofVerified:dto.proofVerified});
   error=null;
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
  }finally{if(generation===epoch)busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),snapshot,refresh,clear});
}
