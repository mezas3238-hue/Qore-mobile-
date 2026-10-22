/** QORE STAGING E2E orchestration: no real GPS, SQL, notifications or trips. */
import {createSyntheticDispatch} from './dispatch-synthetic.mjs';
import {evaluateStagingDriver} from './staging-driver-eligibility.mjs';
import {evaluateSyntheticZone} from './staging-zone-policy.mjs';
export const ORCHESTRATOR_LIVE_ENABLED=false;
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Only trusted synthetic fixtures; zone evaluation never grants commercial dispatch. */
export function createSyntheticScenario({now,insidePolygon}={}){
 if(typeof now!=='function'||typeof insidePolygon!=='function')throw Error('Missing staging adapters');
 const dispatch=createSyntheticDispatch({now});
 function start({rideId,passengerId,zone,point,service='AUTO'}){
  const z=evaluateSyntheticZone({zone,service,point,insidePolygon});
  if(!z.ok)return fail('Zone gate denied');
  return dispatch.request({rideId,passengerId});
 }
 function propose({rideId,driverId,driver,vehicle,service='AUTO',expiresAtMs}){
  if(driver?.id!==driverId)return fail('Driver identity mismatch');
  const eligibility=evaluateStagingDriver({driver,vehicle,service,nowMs:now()});
  if(!eligibility.ok)return fail('Eligibility gate denied');
  return dispatch.offer({rideId,driverId,expiresAtMs});
 }
 return Object.freeze({start,propose,accept:dispatch.accept,transition:dispatch.transition,snapshot:dispatch.snapshot});
}
