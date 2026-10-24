/**
 * G63B — Driver offer decision orchestration, STAGING QA only.
 * Never auto-accept, auto-decline or automatically replay a POST. A timeout
 * MAY be after SQL COMMIT, and absence from the inbox is NOT an ACK.
 * Session actor and bearer exist only in closure, never in snapshots.
 */
export const DRIVER_OFFER_ACTIONS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const none=()=>Object.freeze({phase:'signed-out',offers:Object.freeze([]),
 decisions:Object.freeze([]),busy:false,qaOnly:true,productionEnabled:false});
function frozen(current){
 return Object.freeze({...current,
  offers:Object.freeze(current.offers.map(o=>Object.freeze({...o}))),
  decisions:Object.freeze(current.decisions.map(d=>Object.freeze({...d}))),
  qaOnly:true,productionEnabled:false});
}
export function createDriverOfferActionsController({
 decide,reconcile=null,makeRequestKey,now=Date.now,liveEnabled=false
}={}){
 if(liveEnabled!==false||[decide,makeRequestKey,now].some(f=>typeof f!=='function'))
  throw Error('G63 requires trusted QA decision and cryptographic key callbacks');
 if(reconcile!==null&&typeof reconcile!=='function')
  throw Error('G64 reconciliation must be a trusted function');
 let epoch=0,identity=null,offers=[],pending=null,usedKeys=new Set(),
  decisionMap=new Map(),originalRequests=new Map();
 let state=none();
 const listeners=new Set();
 const notify=next=>{
  state=frozen(next);
  for(const fn of [...listeners])try{fn(state);}catch{/*subscriber isolation*/}
  return state;
 };
 const publish=(phase=state.phase)=>notify({
  phase,offers,decisions:[...decisionMap.values()],busy:pending!==null
 });
 const reset=()=>{
  ++epoch;identity=null;offers=[];pending=null;
  usedKeys.clear();decisionMap.clear();originalRequests.clear();
  return publish('signed-out');
 };
 const validOffer=(offer,at)=>offer&&typeof offer==='object'&&
  !Array.isArray(offer)&&['AUTO_RIDE','DELIVERY'].includes(offer.kind)&&
  ID.test(offer.offerId)&&ID.test(offer.serviceId)&&
  safe(offer.expiresAtMs)&&offer.expiresAtMs<=at+45000&&
  offer.expiresAtMs>at+3000;
 return Object.freeze({
  current:()=>state,
  subscribe(fn){if(typeof fn!=='function')throw Error('G63 observer required');
   listeners.add(fn);return()=>listeners.delete(fn);},
  clear:reset,
  setSession(session){
   reset();
   if(session===null||session===undefined)return state;
   if(typeof session!=='object'||session.role!=='driver'||
    !ID.test(session.userId)||typeof session.accessToken!=='string'||
    !TOKEN.test(session.accessToken))
    return publish('authorization-required');
   identity={userId:session.userId,accessToken:session.accessToken};
   return publish('ready');
  },
  setOffers(newOffers,{currentLicenseApproved=false}={}){
   if(!identity)return state;
   if(!Array.isArray(newOffers)||newOffers.length>10||
    typeof currentLicenseApproved!=='boolean')
    return reset();
   let at;
   try{at=now();}catch{return reset();}
   if(!safe(at))return reset();
   const distinct=new Set();
   for(const offer of newOffers){
    if(!validOffer(offer,at)||distinct.has(offer.offerId))
     return reset();
    distinct.add(offer.offerId);
   }
   // Server re-validates KYC, role, vehicle, current assignment and expiry;
   // this flag only prevents knowingly invalid UI attempts.
   offers=currentLicenseApproved?newOffers.map(o=>({
    offerId:o.offerId,serviceId:o.serviceId,kind:o.kind,
    expiresAtMs:o.expiresAtMs
   })):[];
   return publish('ready');
  },
  async decide({offerId,action}={}){
   if(!identity||pending||!ID.test(offerId)||
    !['accept','decline'].includes(action))return state;
   const offered=offers.find(o=>o.offerId===offerId);
   if(!offered||decisionMap.has(offerId)||offered.expiresAtMs<=now()+3000)
    return state;
   const stamp=++epoch,oldIdentity=identity,kind=offered.kind;
   pending={offerId,action};
   decisionMap.set(offerId,{offerId,serviceId:offered.serviceId,kind,action,phase:'sending'});
   publish('ready');
   let key,submitted=false;
   try{
    key=await makeRequestKey();
    if(stamp!==epoch||identity!==oldIdentity)return state;
    if(typeof key!=='string'||!UUID.test(key)||usedKeys.has(key))
     throw Error('G63 unsafe key');
    usedKeys.add(key);
    submitted=true;
    originalRequests.set(offerId,Object.freeze({offerId,kind,action,requestKey:key}));
    const receipt=await decide({
     accessToken:oldIdentity.accessToken,kind,offerId,
     requestKey:key,action
    });
    if(stamp!==epoch||identity!==oldIdentity)return state;
    if(!receipt||receipt.kind!==kind||receipt.action!==action||
     receipt.outcome!==(action==='accept'?'accepted':'declined')||
     typeof receipt.receiptId!=='string'||!ID.test(receipt.receiptId)||
     receipt.liveEnabled!==false||receipt.pushDelivered!==false)
     throw Error('G63 untrusted server receipt');
    decisionMap.set(offerId,{offerId,serviceId:offered.serviceId,kind,action,phase:'confirmed'});
    originalRequests.delete(offerId);
    offers=offers.filter(o=>o.offerId!==offerId);
    pending=null;
    return publish('ready');
   }catch{
    if(stamp!==epoch||identity!==oldIdentity)return state;
    // Any error may follow a COMMIT. Never repeat POST with a new key.
    decisionMap.set(offerId,{offerId,serviceId:offered.serviceId,kind,action,
     phase:submitted?'uncertain':'blocked'});
    pending=null;
    return publish('ready');
   }finally{
    if(stamp===epoch&&pending!==null){pending=null;publish('ready');}
   }
  },
  async reconcilePending(offerId){
   if(!identity||pending||typeof reconcile!=='function'||!ID.test(offerId)||
    decisionMap.get(offerId)?.phase!=='uncertain')
    return state;
   const original=originalRequests.get(offerId);
   if(!original||original.offerId!==offerId)return state;
   const stamp=++epoch,oldIdentity=identity;
   pending={offerId,action:original.action};
   // Keep the decision 'uncertain' during network wait; no phantom ACK.
   publish('ready');
   try{
    const receipt=await reconcile({
     accessToken:oldIdentity.accessToken,...original
    });
    if(stamp!==epoch||identity!==oldIdentity)return state;
    if(!receipt||receipt.kind!==original.kind||
     receipt.action!==original.action||
     receipt.outcome!==(original.action==='accept'?'accepted':'declined')||
     !ID.test(receipt.receiptId)||receipt.serverPersisted!==true||
     receipt.liveEnabled!==false||receipt.pushDelivered!==false||
     (original.action==='decline'&&receipt.receiptId!==offerId))
     throw Error('G64 original SQL receipt invalid');
    originalRequests.delete(offerId);
    decisionMap.set(offerId,{offerId,serviceId:decisionMap.get(offerId)?.serviceId,
     kind:original.kind,action:original.action,phase:'confirmed'});
    offers=offers.filter(o=>o.offerId!==offerId);
    pending=null;
    return publish('ready');
   }catch{
    // Failed reconcile remains uncertain and original request key is kept.
    if(stamp!==epoch||identity!==oldIdentity)return state;
    pending=null;
    return publish('ready');
   }finally{
    if(stamp===epoch&&pending!==null){pending=null;publish('ready');}
   }
  }
 });
}
