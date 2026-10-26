/**
 * G65 Driver trip lifecycle: server-authoritative status is always required
 * before and after any state mutation. Never simulate ETA/GPS or ride success.
 * Unknown COMMIT blocks further transitions; manual status refresh only.
 */
export const DRIVER_TRIP_CONTROLLER_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const EVENT={accepted:'arrive',arriving:'pickup',
 in_progress:'complete',completed:null,cancelled:null};
const AFTER={arrive:'arriving',pickup:'in_progress',complete:'completed'};
const initial=()=>Object.freeze({phase:'signed-out',tripId:null,status:null,
 revision:null,nextEvent:null,uncertain:false,qaOnly:true,
 productionEnabled:false});
export function createDriverTripLifecycleController({
 readStatus,transition,makeRequestKey,liveEnabled=false
}={}){
 if(liveEnabled!==false||[readStatus,transition,makeRequestKey]
  .some(x=>typeof x!=='function'))
  throw Error('G65 requires verified status, DB command and CSPRNG');
 let identity=null,epoch=0,activeTrip=null,pending=null,polling=false;
 let state=initial();
 const listeners=new Set();
 const publish=patch=>{
  state=Object.freeze({...state,...patch,qaOnly:true,productionEnabled:false});
  for(const fn of listeners)try{fn(state)}catch{/*isolated subscribers*/}
  return state;
 };
 const invalidate=()=>{
  epoch++;identity=null;activeTrip=null;pending=null;polling=false;
  state=initial();
  for(const fn of listeners)try{fn(state)}catch{}
  return state;
 };
 async function refresh({quiet=false}={}){
  if(!identity||!activeTrip)return state;
  const stamp=++epoch,who=identity,id=activeTrip;
  const isCurrent=()=>epoch===stamp&&identity===who&&activeTrip===id;
  if(!pending&&!quiet)publish({phase:'loading'});
  let row;
  try{row=await readStatus({accessToken:who.accessToken,tripId:id});}
  catch{
   if(!isCurrent())return state;
   return publish({phase:pending?'uncertain':'offline',
    status:null,revision:null,nextEvent:null,uncertain:!!pending});
  }
  if(!isCurrent())return state;
  if(!row||row.tripId!==id||!Object.hasOwn(EVENT,row.phase)||
   row.nextEvent!==EVENT[row.phase]||
   !Number.isSafeInteger(row.revision)||row.revision<2||
   row.qaOnly!==true||row.productionEnabled!==false)
   return publish({phase:pending?'uncertain':'unverified',
    status:null,revision:null,nextEvent:null,uncertain:!!pending});
  // Reject a lagging/read-replica response rather than re-enabling an
  // already superseded Driver action after an external cancellation.
  if(Number.isSafeInteger(state.revision)&&row.revision<state.revision)
   return publish({phase:pending?'uncertain':'unverified',
    status:null,revision:null,nextEvent:null,uncertain:!!pending});
  const phase=row.phase;
  const prior=pending;
  if(prior){
   const observedProgress=row.revision>prior.revision &&
    (phase===AFTER[prior.event]||
     (prior.event!=='complete'&&phase==='completed'));
   const terminal=phase==='cancelled';
   if(!observedProgress&&!terminal)
    return publish({phase:'uncertain',status:phase,revision:row.revision,
     nextEvent:null,uncertain:true});
   // Verified server state is the authority. Do NOT claim which HTTP POST
   // created it or manufacture a receipt/event ID from status alone.
   pending=null;
  }
  return publish({phase:['completed','cancelled'].includes(phase)?
   'terminal':'active',status:phase,revision:row.revision,
   nextEvent:EVENT[phase],uncertain:false});
 }
 return Object.freeze({
  current:()=>state,
  subscribe(fn){if(typeof fn!=='function')throw Error('G65 listener required');
   listeners.add(fn);return()=>listeners.delete(fn);},
  clear:invalidate,
  setSession(s){
   invalidate();
   if(!s)return state;
   if(s.role!=='driver'||typeof s.userId!=='string'||!UUID.test(s.userId)||
    typeof s.accessToken!=='string'||!TOKEN.test(s.accessToken))
    return publish({phase:'authorization-required'});
   identity={userId:s.userId,accessToken:s.accessToken};
   return publish({phase:'ready'});
  },
  async open(tripId){
   if(!identity)return state;
   if(typeof tripId!=='string'||!UUID.test(tripId)){
    activeTrip=null;
    return publish({phase:'unverified',tripId:null,status:null,
     revision:null,nextEvent:null,uncertain:false});
   }
   // Avoid dropping an uncertain decision by navigating away from it.
   if(pending&&activeTrip!==tripId)
    return publish({phase:'uncertain',uncertain:true,nextEvent:null});
   if(activeTrip!==tripId){
    epoch++;activeTrip=tripId;
    publish({phase:'ready',tripId,status:null,revision:null,
     nextEvent:null,uncertain:false});
   }
   return refresh();
  },
  refresh,
  async poll(){
   // Foreground screen must opt in. No request after an uncertain POST,
   // while loading, or after a confirmed terminal outcome.
   if(!identity||!activeTrip||polling||pending||state.phase!=='active')
    return state;
   polling=true;
   try{return await refresh({quiet:true});}
   finally{polling=false;}
  },
  async advance(){
   if(!identity||!activeTrip||pending||state.phase!=='active'||
    !Object.hasOwn(EVENT,state.status)||
    state.nextEvent!==EVENT[state.status]||!state.nextEvent||
    !Number.isSafeInteger(state.revision))
    return state;
   const stamp=++epoch,who=identity,id=activeTrip,event=state.nextEvent;
   const revision=state.revision;
   pending={event,revision,tripId:id};
   publish({phase:'submitting',nextEvent:null});
   try{
    const key=await makeRequestKey();
    if(epoch!==stamp||identity!==who||activeTrip!==id)return state;
    if(typeof key!=='string'||!UUID.test(key))throw Error('unsafe key');
    // Once the network call is submitted, ANY error may follow DB COMMIT.
    pending={event,revision,tripId:id,submitted:true};
    const reply=await transition({accessToken:who.accessToken,tripId:id,
     event,eventKey:key});
    if(epoch!==stamp||identity!==who||activeTrip!==id)return state;
    if(!reply||reply.tripId!==id||reply.event!==event||
     reply.serverPersisted!==true||reply.productionEnabled!==false||
     reply.qaOnly!==true)
     throw Error('G65 untrusted transition receipt');
    // A POST receipt is not enough: require the separate authoritative
    // participant status read before enabling the next lifecycle command.
    publish({phase:'uncertain',uncertain:true});
    return refresh();
   }catch{
    if(epoch!==stamp||identity!==who||activeTrip!==id)return state;
    if(!pending.submitted){
     pending=null;
     return publish({phase:'unverified',nextEvent:null,uncertain:false});
    }
    return publish({phase:'uncertain',nextEvent:null,uncertain:true});
   }
  }
 });
}
