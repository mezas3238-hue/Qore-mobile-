/**
 * G188 Driver MOTO: original booking lifecycle (not an offer or assignment).
 * No navigation, commercial unlock, GPS, PSP, or automatic POST retry.
 * Every transition requires a NEW authenticated GET at the SAME revision.
 */
export const DRIVER_MOTO_CONTROLLER_LIVE_ENABLED=false;
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const NEXT=Object.freeze({accepted:'arriving',arriving:'in_progress',
 in_progress:'completed',completed:null});
const REV=Object.freeze({accepted:2,arriving:3,in_progress:4,completed:5});
const blank=()=>Object.freeze({phase:'signed-out',bookingKey:null,
 tripId:null,status:null,revision:null,nextState:null,
 uncertain:false,qaOnly:true,productionEnabled:false});
const valid=row=>row&&typeof row==='object'&&!Array.isArray(row)
 &&ID.test(row.bookingKey??'')&&ID.test(row.tripId??'')
 &&Object.hasOwn(NEXT,row.status)&&row.revision===REV[row.status]
 &&row.nextState===NEXT[row.status]
 &&row.qaOnly===true&&row.productionEnabled===false;
export function createDriverMotoJourneyController({
 readStatus,advanceState,makeRequestKey,liveEnabled=false
}={}){
 if(liveEnabled!==false||
  [readStatus,advanceState,makeRequestKey].some(f=>typeof f!=='function'))
  throw Error('G188 private Driver MOTO adapters required');
 let identity=null,epoch=0,currentBooking=null,pending=null;
 let state=blank();
 const listeners=new Set();
 const publish=changes=>{
  state=Object.freeze({...state,...changes,qaOnly:true,productionEnabled:false});
  for(const fn of [...listeners])try{fn(state);}catch{}
  return state;
 };
 const reset=()=>{
  epoch++;identity=null;currentBooking=null;pending=null;
  state=blank();for(const fn of [...listeners])try{fn(state);}catch{}
  return state;
 };
 const sameRow=(row,id)=>valid(row)&&row.bookingKey===id
  &&(!state.tripId||row.tripId===state.tripId)
  &&(!Number.isSafeInteger(state.revision)||
   row.revision>=state.revision)
  &&(!Number.isSafeInteger(state.revision)||
   row.revision!==state.revision||row.status===state.status);
 async function refresh(){
  if(!identity||!currentBooking)return state;
  const seq=++epoch,who=identity,bookingKey=currentBooking;
  const current=()=>seq===epoch&&who===identity&&currentBooking===bookingKey;
  if(!pending)publish({phase:'loading',nextState:null});
  let row;
  try{row=await readStatus({accessToken:who.accessToken,bookingKey});}
  catch{
   if(!current())return state;
   return publish({phase:pending?'uncertain':'offline',nextState:null,
    uncertain:pending!==null});
  }
  if(!current())return state;
  if(!sameRow(row,bookingKey))
   return publish({phase:pending?'uncertain':'unverified',
    nextState:null,uncertain:pending!==null});
  if(pending){
   if(row.revision<pending.revision+1||
    (row.revision===pending.revision+1&&row.status!==pending.nextState))
    return publish({phase:'uncertain',tripId:row.tripId,status:row.status,
     revision:row.revision,nextState:null,uncertain:true});
   pending=null;
  }
  return publish({phase:row.status==='completed'?'terminal':'active',
   bookingKey,tripId:row.tripId,status:row.status,
   revision:row.revision,nextState:row.nextState,uncertain:false});
 }
 return Object.freeze({
  current:()=>state,
  subscribe(fn){if(typeof fn!=='function')throw Error('G188 observer required');
   listeners.add(fn);return()=>listeners.delete(fn);},
  clear:reset,
  setSession(session){
   reset();
   if(!session)return state;
   if(session.role!=='driver'||!ID.test(session.userId??'')||
    !TOKEN.test(session.accessToken??''))
    return publish({phase:'authorization-required'});
   identity={userId:session.userId,accessToken:session.accessToken};
   return publish({phase:'ready'});
  },
  async open(bookingKey){
   if(!identity)return state;
   if(!ID.test(bookingKey??''))
    return publish({phase:'unverified',nextState:null});
   if(pending&&currentBooking!==bookingKey)
    return publish({phase:'uncertain',nextState:null,uncertain:true});
   if(currentBooking!==bookingKey){
    epoch++;currentBooking=bookingKey;pending=null;
    publish({phase:'ready',bookingKey,tripId:null,status:null,
     revision:null,nextState:null,uncertain:false});
   }
   return refresh();
  },
  refresh,
  async advance(){
   if(!identity||!currentBooking||pending||state.phase!=='active'||
    !state.nextState||!ID.test(state.tripId??'')||
    state.nextState!==NEXT[state.status]||
    state.revision!==REV[state.status])return state;
   const seq=++epoch,who=identity,bookingKey=currentBooking;
   const prior=state,validScope=()=>seq===epoch&&identity===who
    &&currentBooking===bookingKey;
   // A tap does NOT trust cached state. The original G169 owner/IdP GET
   // must still attest the same trip, phase and revision before POST.
   publish({phase:'loading',nextState:null});
   let before;
   try{before=await readStatus({accessToken:who.accessToken,bookingKey});}
   catch{if(validScope())publish({phase:'offline',nextState:null});return state;}
   if(!validScope())return state;
   if(!sameRow(before,bookingKey)||before.tripId!==prior.tripId||
    before.revision!==prior.revision||before.status!==prior.status){
    publish({phase:'unverified',nextState:null});return state;
   }
   let key;
   try{key=await makeRequestKey();}
   catch{if(validScope())publish({phase:'unverified',nextState:null});return state;}
   if(!validScope())return state;
   if(!ID.test(key??'')){
    publish({phase:'unverified',nextState:null});return state;
   }
   pending={revision:prior.revision,nextState:prior.nextState};
   publish({phase:'submitting',nextState:null,uncertain:true});
   let answer;
   try{answer=await advanceState({accessToken:who.accessToken,bookingKey,
    expectedRevision:prior.revision,nextState:prior.nextState,commandKey:key});}
   catch{
    if(validScope())publish({phase:'uncertain',nextState:null,uncertain:true});
    return state;
   }
   if(!validScope())return state;
   // An apparently successful POST still requires an independent GET;
   // malformed or mismatched receipt remains UNKNOWN_COMMIT.
   if(!valid(answer)||answer.bookingKey!==bookingKey||
    answer.tripId!==prior.tripId||answer.revision!==prior.revision+1||
    answer.status!==prior.nextState){
    publish({phase:'uncertain',nextState:null,uncertain:true});return state;
   }
   publish({phase:'uncertain',nextState:null,uncertain:true});
   return refresh();
  }
 });
}
