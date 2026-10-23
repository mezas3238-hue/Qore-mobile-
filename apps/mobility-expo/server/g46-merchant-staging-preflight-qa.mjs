/**
 * G46: isolated QA-only cutover checklist for merchant backend/Client B.
 *
 * Does NOT perform network I/O, deploy, authenticate users, connect a DB,
 * grant EXECUTE, sign a URL or switch any feature on. No evidence supplied
 * through a client request; only server-injected independent inspectors.
 * A passing synthetic checklist is NOT an authorization for staging or LIVE.
 */
const SHA=/^[0-9a-f]{40}$/;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exactly=(o,keys)=>isRecord(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const CLOCK_MAX=8640000000000000;
const CHECKS=Object.freeze([
 'OWNER_EXPLICIT_STAGING_APPROVAL',
 'HTTPS_TLS_PEER_CERT_VERIFIED',
 'PINNED_JWT_ISSUER_AUDIENCE_JWKS',
 'PROVIDER_SESSION_REVOCATION_AND_AAL2',
 'G6_G9_DML_AND_RPC_DENIAL',
 'JWT_BOUND_PG_TRANSACTION_AND_RLS',
 'REAL_ZONE_LEGAL_ELIGIBILITY',
 'PSP_DISABLED_AND_NO_CLIENT_CHECKOUT',
 'PRODUCTION_SECRETS_OUTSIDE_REPOSITORY',
 'CLIENT_DRIVER_ADMIN_RUNTIME_FLAGS_OFF'
]);
const SOURCE=Object.freeze({
 OWNER_EXPLICIT_STAGING_APPROVAL:'owner',
 HTTPS_TLS_PEER_CERT_VERIFIED:'tls',
 PINNED_JWT_ISSUER_AUDIENCE_JWKS:'provider',
 PROVIDER_SESSION_REVOCATION_AND_AAL2:'provider',
 G6_G9_DML_AND_RPC_DENIAL:'database',
 JWT_BOUND_PG_TRANSACTION_AND_RLS:'database',
 REAL_ZONE_LEGAL_ELIGIBILITY:'legal',
 PSP_DISABLED_AND_NO_CLIENT_CHECKOUT:'flags',
 PRODUCTION_SECRETS_OUTSIDE_REPOSITORY:'secrets',
 CLIENT_DRIVER_ADMIN_RUNTIME_FLAGS_OFF:'flags'
});
function validEvidence(x,sha,at){
 return exactly(x,['headSha','observedAtMs','checks'])&&
  x.headSha===sha&&Number.isSafeInteger(x.observedAtMs)&&
  x.observedAtMs>=0&&x.observedAtMs<=at&&at-x.observedAtMs<=60000&&
  isRecord(x.checks)&&Object.keys(x.checks).every(k=>CHECKS.includes(k))&&
  Object.values(x.checks).every(v=>v===true||v===false);
}
export function createG46MerchantStagingPreflightQa({
 environment,liveEnabled,localQaOnly,expectedHeadSha,
 inspectOwnerApproval,inspectTls,inspectProvider,inspectDatabase,
 inspectLegal,inspectFlags,inspectSecrets,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true||!SHA.test(expectedHeadSha??'')||
  [inspectOwnerApproval,inspectTls,inspectProvider,inspectDatabase,
   inspectLegal,inspectFlags,inspectSecrets,now].some(f=>typeof f!=='function'))
  throw Error('G46 synthetic preflight only; trusted inspectors required');
 const sources=Object.freeze({
  owner:inspectOwnerApproval,tls:inspectTls,provider:inspectProvider,
  database:inspectDatabase,legal:inspectLegal,flags:inspectFlags,
  secrets:inspectSecrets
 });
 return async function inspectCutoverReadinessQa(){
  const at=now();
  if(!Number.isSafeInteger(at)||at<0||at>CLOCK_MAX)
   throw Error('G46 unsafe observation clock');
  const evidence=await Promise.allSettled(
   Object.entries(sources).map(async([name,reader])=>({name,data:await reader()}))
  );
  const proofs=new Map();
  for(let i=0;i<evidence.length;i++){
   const x=evidence[i];
   if(x.status==='fulfilled'&&validEvidence(x.value.data,expectedHeadSha,at))
    proofs.set(x.value.name,x.value.data.checks);
  }
  const missing=[];
  for(const check of CHECKS){
   const source=SOURCE[check];
   if(proofs.get(source)?.[check]!==true)
    missing.push(check);
  }
  return Object.freeze({
   mode:'G46_SYNTHETIC_CHECKLIST_ONLY',
   headSha:expectedHeadSha,
   observedAtMs:at,
   qaChecklistPassed:missing.length===0,
   missingChecks:Object.freeze(missing),
   httpsStagingConnected:false,
   authProviderConnected:false,
   clientRuntimeEnabled:false,
   paymentEnabled:false,
   activationPermitted:false,
   productionEnabled:false
  });
 };
}
