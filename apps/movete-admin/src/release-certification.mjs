/**
 * QORE Mobile R60 — auditable release evidence assessment.
 *
 * This is a fail-closed, offline consistency checker, NOT a certifying
 * authority. Links, test reports, legal attestations and Owner signatures
 * must be verified independently before changing any release decision.
 */
export const MANDATORY_GATES=Object.freeze([
 'IDP_BACKEND_AUTH','HTTPS_BACKEND','POSTGRES_PERSISTENCE',
 'DRIVER_ONBOARDING','DRIVER_LIVE_TRIPS','CLIENT_LIVE_BOOKINGS',
 'PAYMENT_SETTLEMENT','PRIVACY_KYC','EMERGENCY_SAFETY',
 'MAPS_GPS_DEVICE','DELIVERY_MERCHANTS','CHAT_PHYSICAL',
 'ADMIN_OPERATIONS','NATIVE_RELEASES','LEGAL_COMPLIANCE',
 'OPS_24_7_MONITORING','PROD_GO_NOGO'
]);
export const MANDATORY_FLOWS=Object.freeze([
 'AUTH_PASSENGER','AUTH_DRIVER_KYC','FARE_QUOTE_GS','AUTO_BOOKING',
 'DRIVER_DISPATCH','GPS_TRACKING','TRIP_COMPLETION_CANCELLATION',
 'MOTO_CARGO_DELIVERY','AUTO_CARGO_DELIVERY','SUPERMARKET_ORDER',
 'PHARMACY_OTC_ORDER','RESTAURANT_ORDER','CUSTOMER_DRIVER_CHAT',
 'PAYMENTS_REFUNDS','COMMISSIONS_PAYOUTS','ADMIN_KYC_ZONES',
 'EMERGENCY_RESPONSE','DATA_PRIVACY','SIGNED_NATIVE_RELEASES',
 'ZONE_ACTIVATION_SUPPORT'
]);
export const EVIDENCE_KINDS=Object.freeze([
 'DOMAIN_CI','API_CONTRACT','NEGATIVE_SECURITY','STAGING_E2E',
 'ANDROID_DEVICE','IOS_DEVICE','POSTGRES_DURABILITY',
 'LEGAL_REVIEW','OPS_EXERCISE','PSP_RECONCILIATION','OWNER_SIGNOFF'
]);
const SHA=/^[0-9a-f]{40}$/;
const OWNER_REPO='mezas3238-hue/Qore-mobile-';
const REQUIRED_ENV=Object.freeze({
 DOMAIN_CI:['CI_QA'],
 API_CONTRACT:['CI_QA','STAGING'],
 NEGATIVE_SECURITY:['CI_QA','STAGING','ANDROID_PHYSICAL','IOS_PHYSICAL'],
 STAGING_E2E:['STAGING'],
 ANDROID_DEVICE:['ANDROID_PHYSICAL'],
 IOS_DEVICE:['IOS_PHYSICAL'],
 POSTGRES_DURABILITY:['STAGING','PRODUCTION_READINESS_REVIEW'],
 LEGAL_REVIEW:['PRODUCTION_READINESS_REVIEW'],
 OPS_EXERCISE:['STAGING','PRODUCTION_READINESS_REVIEW'],
 PSP_RECONCILIATION:['STAGING','PRODUCTION_READINESS_REVIEW'],
 OWNER_SIGNOFF:['PRODUCTION_READINESS_REVIEW']
});
const STATUSES=new Set(['BLOCKED','QA_ONLY','CERTIFIED']);
const SOURCE_STATES=new Set(['blocked','qa-only']);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(items)=>new Set(items);
const exactIdSet=(entries,ids)=>{
 if(!Array.isArray(entries)||entries.length!==ids.length)return false;
 const expected=keys(ids),seen=new Set();
 for(const x of entries){
  if(!isObj(x)||typeof x.id!=='string'
   ||!expected.has(x.id)||seen.has(x.id))return false;
  seen.add(x.id);
 }
 return seen.size===ids.length;
};
function evidenceValid(e){
 if(!isObj(e))return false;
 const allowed=['kind','result','commitSha','url','environment',
  'verifiedBy','executedAt'];
 if(Object.keys(e).length!==allowed.length
  ||!allowed.every(k=>Object.hasOwn(e,k)))return false;
 if(!EVIDENCE_KINDS.includes(e.kind)||e.result!=='PASS'
  ||typeof e.commitSha!=='string'||!SHA.test(e.commitSha)
  ||typeof e.environment!=='string'
  ||!REQUIRED_ENV[e.kind]?.includes(e.environment)
  ||typeof e.verifiedBy!=='string'
  ||!/^[A-Za-z0-9_.-]{3,60}$/.test(e.verifiedBy)
  ||typeof e.executedAt!=='string'
  ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(e.executedAt)
  ||Number.isNaN(Date.parse(e.executedAt))
  ||typeof e.url!=='string')return false;
 try{
  const u=new URL(e.url);
  if(u.protocol!=='https:'||u.hostname!=='github.com'
   ||u.username||u.password||u.search||u.hash)return false;
  return u.pathname.startsWith('/'+OWNER_REPO+'/actions/runs/')
   ? /^\/[^/]+\/[^/]+\/actions\/runs\/[0-9]+$/.test(u.pathname)
   : u.pathname.startsWith('/'+OWNER_REPO+'/blob/'+e.commitSha+'/');
 }catch{return false;}
}
const safeOwner=new Set(['A','B','A+B','Owner','Owner+A+B']);
const REQUIRED_KINDS={
 DOMAIN_CI:['DOMAIN_CI'],API_CONTRACT:['API_CONTRACT'],
 NEGATIVE_SECURITY:['NEGATIVE_SECURITY'],STAGING_E2E:['STAGING_E2E'],
 ANDROID_DEVICE:['ANDROID_DEVICE'],IOS_DEVICE:['IOS_DEVICE'],
 POSTGRES_DURABILITY:['POSTGRES_DURABILITY'],
 LEGAL_REVIEW:['LEGAL_REVIEW'],OPS_EXERCISE:['OPS_EXERCISE'],
 PSP_RECONCILIATION:['PSP_RECONCILIATION'],OWNER_SIGNOFF:['OWNER_SIGNOFF']
};
function proofComplete(x){
 if(!Array.isArray(x.requiredEvidence)||x.requiredEvidence.length<1
  ||new Set(x.requiredEvidence).size!==x.requiredEvidence.length
  ||x.requiredEvidence.some(k=>!Object.hasOwn(REQUIRED_KINDS,k))
  ||!Array.isArray(x.evidence)
  ||x.evidence.some(e=>!evidenceValid(e)))return false;
 const kinds=new Set(x.evidence.map(e=>e.kind));
 return x.requiredEvidence.every(k=>kinds.has(k));
}
export function assessMoveteReleaseRegistry(registry){
 const problems=[];
 if(!isObj(registry)||registry.schemaVersion!=='qore-mobile-r60-v1'
  ||registry.project!=='QORE Mobile / Movete Fácil'
  ||!isObj(registry.source)
  ||registry.source.repository!==OWNER_REPO
  ||registry.source.path!=='docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json'
  ||typeof registry.source.commitSha!=='string'
  ||!SHA.test(registry.source.commitSha)
  ||!isObj(registry.release)
  ||registry.release.ownerGoLiveAuthorization!==false
  ||registry.release.decision!=='NO_GO'){
  problems.push('INVALID_SOURCE_OR_GOVERNANCE');
 }
 if(!exactIdSet(registry?.gates,MANDATORY_GATES))
  problems.push('MISSING_OR_DUPLICATED_CRITICAL_GATE');
 if(!exactIdSet(registry?.flows,MANDATORY_FLOWS))
  problems.push('MISSING_OR_DUPLICATED_FUNCTIONAL_FLOW');
 const gateNames=keys(MANDATORY_GATES);
 const gateCounts={blocked:0,qaOnly:0,certified:0};
 if(Array.isArray(registry?.gates))for(const g of registry.gates){
  if(!isObj(g)||!safeOwner.has(g.owner)
   ||!SOURCE_STATES.has(g.sourceStatus)
   ||!STATUSES.has(g.status)
   ||typeof g.reason!=='string'
   ||g.reason.length<12||g.reason.length>700
   ||!Array.isArray(g.evidence)
   ||g.evidence.some(e=>!evidenceValid(e)))
   problems.push('INVALID_GATE_EVIDENCE_OR_STATUS');
  if(g?.status==='BLOCKED')gateCounts.blocked++;
  else if(g?.status==='QA_ONLY')gateCounts.qaOnly++;
  else if(g?.status==='CERTIFIED')gateCounts.certified++;
  if(g?.status==='CERTIFIED'&&!proofComplete(g))
   problems.push('UNSUPPORTED_GATE_CERTIFICATION');
 }
 const flowCounts={blocked:0,qaOnly:0,certified:0};
 if(Array.isArray(registry?.flows))for(const f of registry.flows){
  if(!isObj(f)||!safeOwner.has(f.owner)
   ||!STATUSES.has(f.status)
   ||typeof f.acceptance!=='string'
   ||f.acceptance.length<35||f.acceptance.length>1400
   ||!Array.isArray(f.requiredGates)
   ||f.requiredGates.length===0
   ||new Set(f.requiredGates).size!==f.requiredGates.length
   ||f.requiredGates.some(g=>!gateNames.has(g))
   ||!Array.isArray(f.evidence)
   ||f.evidence.some(e=>!evidenceValid(e))
   ||!Array.isArray(f.requiredEvidence)
   ||f.requiredEvidence.length<1
   ||f.requiredEvidence.some(k=>!EVIDENCE_KINDS.includes(k)))
   problems.push('INVALID_FUNCTIONAL_FLOW');
  if(f?.status==='BLOCKED')flowCounts.blocked++;
  else if(f?.status==='QA_ONLY')flowCounts.qaOnly++;
  else if(f?.status==='CERTIFIED')flowCounts.certified++;
  if(f?.status==='CERTIFIED'&&!proofComplete(f))
   problems.push('UNSUPPORTED_FLOW_CERTIFICATION');
  if(f?.status==='CERTIFIED'&&Array.isArray(f.requiredGates)
   &&f.requiredGates.some(g=>!Array.isArray(registry?.gates)
    ||registry.gates.find(x=>x?.id===g)?.status!=='CERTIFIED'))
   problems.push('FLOW_DEPENDS_ON_UNCERTIFIED_GATE');
 }
 // Even complete local evidence is not an independent review of external
 // truth or a signed production authorization. This checker NEVER emits GO.
 const allComplete=problems.length===0
  &&gateCounts.certified===MANDATORY_GATES.length
  &&flowCounts.certified===MANDATORY_FLOWS.length;
 const decision='NO_GO';
 return Object.freeze({
  structurallyValid:problems.length===0,
  decision,
  readyForIndependentAudit:allComplete,
  gateCounts:Object.freeze(gateCounts),
  flowCounts:Object.freeze(flowCounts),
  problems:Object.freeze([...new Set(problems)]),
  // Owner GO requires separate independent approval, never an inline flag.
  releaseAuthorized:false
 });
}
