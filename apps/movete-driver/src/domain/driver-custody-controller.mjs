/**
 * G66 delivery custody controller. Never invent receipt, GPS, proof or sender
 * identity. Unknown COMMIT blocks further POSTs until an independently
 * observed SQL revision proves a later state. Local proof UUID is prohibited.
 */
export const DRIVER_CUSTODY_CONTROLLER_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const NEXT=Object.freeze({accepted:'pickup',picked_up:'deliver',
 delivered:null,disputed:'return',returned:null,cancelled:null});
const AFTER=Object.freeze({pickup:'picked_up',deliver:'delivered',return:'returned'});
const empty=()=>Object.freeze({phase:'signed-out',deliveryId:null,status:null,
 revision:null,nextEvent:null,uncertain:false,proofVerified:false,
 qaOnly:true,productionEnabled:false});
export function createDriverCustodyController({
 readStatus,transition,makeRequestKey,obtainVerifiedProof=null,
 liveEnabled=false
}={}){
 if(liveEnabled!==false||
  [readStatus,transition,makeRequestKey].some(f=>typeof f!=='function')||
  (obtainVerifiedProof!==null&&typeof obtainVerifiedProof!=='function'))
  throw Error('G66 trusted custody callbacks required');
 let actor=null,deliveryId=null,epoch=0,pending=null,state=empty();
 const listeners=new Set();
 const update=x=>{
  state=Object.freeze({...state,...x,qaOnly:true,productionEnabled:false});
  for(const f of listeners)try{f(state)}catch{}
  return state;
 };
 function clear(){
  epoch++;actor=null;deliveryId=null;pending=null;state=empty();
  for(const f of listeners)try{f(state)}catch{}
  return state;
 }
 async function refresh(){
  if(!actor||!deliveryId)return state;
  const version=++epoch,who=actor,id=deliveryId;
  const current=()=>version===epoch&&actor===who&&deliveryId===id;
  if(!pending)update({phase:'loading'});
  let row;
  try{row=await readStatus({accessToken:who.accessToken,deliveryId:id});}
  catch{
   if(!current())return state;
   return update({phase:pending?'uncertain':'offline',
    status:null,revision:null,nextEvent:null,uncertain:!!pending,proofVerified:false});
  }
  if(!current())return state;
  if(!row||row.deliveryId!==id||!Object.hasOwn(NEXT,row.phase)||
   row.nextEvent!==NEXT[row.phase]||
   !Number.isSafeInteger(row.revision)||row.revision<2||
   typeof row.proofVerified!=='boolean'||row.qaOnly!==true||
   row.productionEnabled!==false)
   return update({phase:pending?'uncertain':'unverified',
    status:null,revision:null,nextEvent:null,uncertain:!!pending,proofVerified:false});
  if(pending){
   // A later verified SQL state demonstrates progress, not the HTTP
   // response's receipt ID. Missing progress does not prove rollback.
   const progressed=row.revision>pending.revision &&
    (row.phase===AFTER[pending.event]||
     (pending.event==='pickup'&&['delivered','disputed','returned'].includes(row.phase))||
     (pending.event==='deliver'&&['disputed','returned'].includes(row.phase)));
   if(!progressed)
    return update({phase:'uncertain',status:row.phase,revision:row.revision,
     nextEvent:null,uncertain:true,proofVerified:row.proofVerified});
   pending=null;
  }
  const terminal=['delivered','returned','cancelled'].includes(row.phase);
  return update({phase:terminal?'terminal':'active',status:row.phase,
   revision:row.revision,nextEvent:row.nextEvent,uncertain:false,
   proofVerified:row.proofVerified});
 }
 return Object.freeze({
  current:()=>state,
  subscribe(fn){if(typeof fn!=='function')throw Error('G66 listener required');
   listeners.add(fn);return()=>listeners.delete(fn);},
  clear,
  setSession(session){
   clear();
   if(!session)return state;
   if(session.role!=='driver'||!UUID.test(session.userId??'')||
    typeof session.accessToken!=='string'||!TOKEN.test(session.accessToken))
    return update({phase:'authorization-required'});
   actor={userId:session.userId,accessToken:session.accessToken};
   return update({phase:'ready'});
  },
  async open(id){
   if(!actor)return state;
   if(!UUID.test(id??''))
    return update({phase:'unverified',nextEvent:null});
   if(pending&&deliveryId!==id)return update({phase:'uncertain',nextEvent:null});
   if(deliveryId!==id){
    epoch++;deliveryId=id;
    update({phase:'ready',deliveryId:id,status:null,revision:null,
     uncertain:false,nextEvent:null,proofVerified:false});
   }
   return refresh();
  },
  refresh,
  async advance(){
   if(!actor||!deliveryId||pending||state.phase!=='active'||
    state.nextEvent!==NEXT[state.status]||!state.nextEvent)
    return state;
   const version=++epoch,who=actor,id=deliveryId,event=state.nextEvent,
    revision=state.revision;
   pending={event,revision,submitted:false};
   update({phase:'submitting',nextEvent:null});
   try{
    let proofRef=null;
    if(event==='deliver'){
     // No proof source is configured by default. A UI toggle, locally
     // minted UUID, or unknown media object cannot unlock delivery.
     if(!obtainVerifiedProof)throw Error('No server proof registry');
     const proof=await obtainVerifiedProof({accessToken:who.accessToken,
      deliveryId:id,actorId:who.userId});
     if(epoch!==version||actor!==who||deliveryId!==id)return state;
     if(!proof||proof.deliveryId!==id||proof.actorId!==who.userId||
      proof.verifiedByServer!==true||!UUID.test(proof.proofRef??''))
      throw Error('No independently verified delivery evidence');
     proofRef=proof.proofRef;
    }
    const key=await makeRequestKey();
    if(epoch!==version||actor!==who||deliveryId!==id)return state;
    if(!UUID.test(key??''))throw Error('Unsafe custody key');
    pending={event,revision,submitted:true};
    const receipt=await transition({accessToken:who.accessToken,
     deliveryId:id,event,eventKey:key,...(proofRef?{proofRef}:{})});
    if(epoch!==version||actor!==who||deliveryId!==id)return state;
    if(!receipt||receipt.deliveryId!==id||receipt.event!==event||
     receipt.serverPersisted!==true||receipt.qaOnly!==true||
     receipt.productionEnabled!==false)throw Error('Untrusted custody ACK');
    update({phase:'uncertain',uncertain:true});
    return refresh();
   }catch{
    if(epoch!==version||actor!==who||deliveryId!==id)return state;
    if(!pending?.submitted){
     pending=null;
     return update({phase:'unverified',uncertain:false,nextEvent:null});
    }
    return update({phase:'uncertain',uncertain:true,nextEvent:null});
   }
  }
 });
}
