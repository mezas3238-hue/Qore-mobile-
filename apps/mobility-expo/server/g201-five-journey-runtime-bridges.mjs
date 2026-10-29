/**
 * G201: unify the original authenticated G197/G198/G200 SQL-backed
 * participant paths inside the SAME G4 staging HTTP runtime.
 *
 * This never self-certifies external providers or LIVE. Explicit independent
 * G42 identity/motion trust is mandatory. The original PostgreSQL RPCs
 * remain sole authority; missing migrations/IdP are returned as 503.
 */
import {createG197DriverPickupGateway} from './g197-driver-pickup-gateway.mjs';
import {createG198LostItemsGateway} from './g198-lost-items-gateway.mjs';
import {createG200MotoLostItemsGateway} from './g200-moto-lost-items-gateway.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TRUST_KEYS=['verifyParticipantSession','verifySessionNotRevoked',
 'verifyDriverStopped'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
export function validG201IndependentTrust(t){
 return plain(t)&&Object.keys(t).length===TRUST_KEYS.length&&
 TRUST_KEYS.every(k=>Object.hasOwn(t,k)&&typeof t[k]==='function');
}
export function createG201FiveJourneyRuntimeBridges({
 independentTrust,verifySupabaseUser,resolveExclusiveRole,
 allowRequest,admin,now=Date.now
}={}){
 if(!validG201IndependentTrust(independentTrust)||
  [verifySupabaseUser,resolveExclusiveRole,allowRequest,now]
   .some(f=>typeof f!=='function')||
  !admin||typeof admin.rpc!=='function')
  throw Error('G201 requires independent G42 participant, motion and original PostgreSQL RPC authorities');
 const identify=async token=>{
  const [provider,attested]=await Promise.all([
   verifySupabaseUser(token),
   independentTrust.verifyParticipantSession(token)
  ]);
  if(provider?.id!==attested?.id||!UUID.test(attested?.id)||
   provider?.is_anonymous!==false||attested?.is_anonymous!==false||
   !UUID.test(attested?.sessionId)||
   !(typeof provider?.email_confirmed_at==='string'||
     typeof provider?.phone_confirmed_at==='string')||
   !Number.isSafeInteger(attested.tokenIatMs)||
   !Number.isSafeInteger(attested.expiresAtMs)||
   attested.tokenIatMs>now()||attested.expiresAtMs<=now())
   throw Error('G201 provider and G42 session identity disagree');
  return Object.freeze({
   id:attested.id,sessionId:attested.sessionId,
   tokenIatMs:attested.tokenIatMs,expiresAtMs:attested.expiresAtMs,
   is_anonymous:false
  });
 };
 const rpc=async(name,params)=>{
  const {data,error}=await admin.rpc(name,params);
  if(error||data===null||data===undefined)
   throw Error('G201 original SQL receipt missing or denied');
  return data;
 };
 const common={
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now,verifyAccessToken:identify,
  verifySessionNotRevoked:s=>independentTrust.verifySessionNotRevoked(s),
  resolveExclusiveRole,allowRequest
 };
 const pickupPreferenceHandler=createG197DriverPickupGateway({
  ...common,
  readPreferences:p=>rpc('mobility_stage_g197_read_pickup_qa',{
   _driver:p.driverId,_session:p.sessionId,_iat_ms:p.tokenIatMs
  }),
  savePreference:p=>rpc('mobility_stage_g197_save_pickup_qa',{
   _driver:p.driverId,_session:p.sessionId,_iat_ms:p.tokenIatMs,
   _kind:p.serviceKind,_distance_meters:p.maximumRoadMeters,
   _expected_revision:p.expectedRevision
  })
 });
 const lostCase=(prefix)=>{
  const call=(suffix,params)=>rpc('mobility_stage_'+prefix+'_'+suffix+'_qa',params);
  const scope=p=>({_actor:p.actorId,_session:p.sessionId,_iat_ms:p.tokenIatMs});
  return {
   ...common,
   verifyDriverStopped:p=>independentTrust.verifyDriverStopped(p),
   openCase:p=>call('open_case',{
    _passenger:p.actorId,_session:p.sessionId,_iat_ms:p.tokenIatMs,
    _trip:p.tripId
   }),
   readCase:p=>call('read_case',{
    _case:p.caseId,...scope(p)
   }),
   sendCaseMessage:p=>call('send_message',{
    _case:p.caseId,...scope(p),_request:p.requestKey,_body:p.body
   }),
   driverInbox:p=>call('driver_inbox',{
    _driver:p.actorId,_session:p.sessionId,_iat_ms:p.tokenIatMs
   }),
   // Closure must return an independently read-backed state; the existing
   // G198/G200 Boolean SQL API does not. Refuse until audited response RPC.
   closeCase:async()=>{throw Error('G201 terminal case write needs verified state receipt');}
  };
 };
 return Object.freeze({
  pickupPreferenceHandler,
  lostItemsHandler:createG198LostItemsGateway(lostCase('g198')),
  motoLostItemsHandler:createG200MotoLostItemsGateway(lostCase('g200')),
  productionEnabled:false
 });
}
