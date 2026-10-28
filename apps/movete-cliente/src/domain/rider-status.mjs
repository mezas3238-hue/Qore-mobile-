/** Reducer de visualización SOLO CLIENTE, basado en revisiones persistidas de A.
 * No conecta datos hasta que exista DTO servidor tipado y Auth staging validada.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const legalStates=new Set(['idle','draft','quote_pending','searching','assigned','arriving','in_progress','completed','cancelled','failed']);
const eligibleStates=new Set(['assigned','arriving','in_progress']);
const text=(s,max=100)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const initial=()=>({tripId:null,revision:-1,state:'idle',assignedDriver:null,position:null,etaMinutes:null,locationObservedAt:null});
export function createRiderStatusStore({now=()=>Date.now(),locationTtlMs=30000}={}){
 let state=initial(),identity=null,disconnected=true;
 const ttl=Number.isSafeInteger(locationTtlMs)&&locationTtlMs>0&&locationTtlMs<=60000?locationTtlMs:30000;
 function current(){
  const locationFresh=!disconnected&&state.locationObservedAt!==null
   &&now()>=state.locationObservedAt&&now()-state.locationObservedAt<=ttl;
  return {...state,position:locationFresh&&state.position?{...state.position}:null,
   etaMinutes:locationFresh?state.etaMinutes:null,locationObservedAt:locationFresh?state.locationObservedAt:null};
 }
 function clear(){state=initial();identity=null;disconnected=true;}
 function networkLost(){disconnected=true;state={...state,position:null,etaMinutes:null,locationObservedAt:null};}
 function ingest(snapshot,sessionSubject){
  if(!object(snapshot)||typeof sessionSubject!=='string'||!UUID.test(sessionSubject)
    ||!UUID.test(snapshot.tripId||'')||snapshot.ownerId!==sessionSubject
    ||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0
    ||!legalStates.has(snapshot.state)){clear();return false;}
  if(identity!==null&&identity!==sessionSubject){clear();return false;}
  if(state.tripId!==null&&state.tripId!==snapshot.tripId){clear();return false;}
  if(snapshot.revision<=state.revision)return false;
  identity=sessionSubject;disconnected=false;
  const visible=eligibleStates.has(snapshot.state)&&snapshot.assignmentPersisted===true;
  const driver=visible&&object(snapshot.driver)&&snapshot.driver.verified===true
   &&text(snapshot.driver.displayName,80)&&object(snapshot.vehicle)
   &&snapshot.vehicle.kind==='AUTO'&&text(snapshot.vehicle.plate,20)
    ?{name:snapshot.driver.displayName,plate:snapshot.vehicle.plate}:null;
  const gps=Boolean(visible&&driver&&snapshot.gpsConsent===true
    &&object(snapshot.location)&&Number.isFinite(snapshot.location.latitude)
    &&Number.isFinite(snapshot.location.longitude)
    &&Math.abs(snapshot.location.latitude)<=90&&Math.abs(snapshot.location.longitude)<=180
    &&Number.isSafeInteger(snapshot.location.observedAt)
    &&snapshot.location.observedAt<=now()&&now()-snapshot.location.observedAt<=ttl);
  const eta=gps&&snapshot.etaVerified===true
    &&Number.isSafeInteger(snapshot.etaMinutes)&&snapshot.etaMinutes>=0&&snapshot.etaMinutes<=240
      ?snapshot.etaMinutes:null;
  state={
   tripId:snapshot.tripId,revision:snapshot.revision,state:snapshot.state,
   assignedDriver:driver,
   position:gps?{latitude:snapshot.location.latitude,longitude:snapshot.location.longitude}:null,
   etaMinutes:eta,locationObservedAt:gps?snapshot.location.observedAt:null
  };
  return true;
 }
 return Object.freeze({current,ingest,clear,networkLost});
}
