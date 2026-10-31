/**
 * G275 trusted-operator one-shot STAGING QA Auth proof.
 * Intentionally never executes on GitHub Actions or in live deployments.
 * It creates exactly eight synthetic QA Auth accounts ONLY on explicit --apply,
 * then audits independent provider identities, roles and locally revoked sessions.
 * A partially failed run requires manual audit: never automatically retries/deletes.
 */
import {pathToFileURL} from 'node:url';
import {assertStage,verifyManifest,bootstrapQa,QA_SLOTS} from './qore-staging-qa-identity-bootstrap.mjs';
import {inspectEightActorQa} from './g254-eight-actor-qa-readonly-audit.mjs';
import {verifyEightQaSessions} from './g261-eight-real-qa-auth-sessions.mjs';

const BLOCKED='G275 blocked. Inspect STAGING Auth state privately; never auto-retry after partial creation.';
export async function stageAndProveEightQa({
 ref,environment,liveTripsEnabled,publicKey,secret,manifest,
 provision=bootstrapQa,audit=inspectEightActorQa,verifySessions=verifyEightQaSessions
}={}){
 // Validate the entire manifest and environment BEFORE touching the provider.
 assertStage({ref,environment,liveTripsEnabled,publicKey,secret});
 verifyManifest(manifest);
 if(typeof provision!=='function'||typeof audit!=='function'||typeof verifySessions!=='function')
  throw Error(BLOCKED);
 const created=await provision({ref,environment,liveTripsEnabled,publicKey,secret,manifest});
 if(created?.mode!=='STAGING_ONLY'||created.count!==8||
    created.commercialEnabled!==false||!Array.isArray(created.roles)||
    created.roles.join('|')!==QA_SLOTS.map(x=>x[1]).join('|'))throw Error(BLOCKED);

 const observed=await audit({ref,environment,liveTripsEnabled:false,
  publicKey,serviceKey:secret});
 if(observed?.mode!=='STAGING_READ_ONLY'||observed.qaAuthAccounts!==8||
    observed.exclusiveQaRoles!==8||observed.signupDisabled!==true||
    observed.projectPinned!==true||
    observed.roleCounts?.admin!==1||observed.roleCounts?.driver!==4||
    observed.roleCounts?.passenger!==3||
    observed.externalJourneysCertified!==0)throw Error(BLOCKED);

 const verified=await verifySessions({ref,environment,liveTripsEnabled:false,
  publicKey,serviceKey:secret,manifest});
 if(verified?.mode!=='PROVIDER_AUTH_SESSION_ONLY'||
    verified.eightIndependentPasswordSessionsVerified!==8||
    verified.crossIdentitySessionDenied!==1||
    verified.verifiedLocallyRevokedSessions!==8||
    verified.commercialLaunchAllowed!==false||
    verified.externalJourneysCertified!==0)throw Error(BLOCKED);

 return Object.freeze({
  mode:'STAGING_QA_ONLY',authAccounts:8,exclusiveRoles:8,
  independentSessionsVerified:8,revokedLocalSessionsVerified:8,
  backofficeOwnerApprovalCertified:false,
  driverKycApproved:false,externalJourneysCertified:0,
  commercialLaunchAllowed:false
 });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  if(process.argv.length===3&&process.argv[2]==='--plan'){
   console.log('G275 plan: 8 QA slots, Auth bootstrap -> G254 audit -> G261 sessions/revocation.');
   console.log('No network or credentials loaded. No Owner approval, no LIVE, no E2E certificate.');
  }else if(process.argv.length===3&&process.argv[2]==='--apply'){
   // Even if secrets are accidentally injected into CI or a deployed service,
   // never create QA users outside an explicit private operator host.
   if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
      typeof process.env.RAILWAY_ENVIRONMENT==='string')throw Error(BLOCKED);
   if(process.env.QORE_QA_EXPLICIT_APPLY!=='CONFIRM_STAGING_ONLY'||
      process.env.QORE_QA_SESSION_VERIFY_APPROVED!=='CONFIRM_STAGING_ONLY'||
      process.env.LIVE_TRIPS_ENABLED!=='false')throw Error(BLOCKED);
   let manifest;
   try{manifest=JSON.parse(process.env.QORE_QA_ACTORS_JSON??'');}
   catch{throw Error(BLOCKED);}
   const result=await stageAndProveEightQa({
    ref:process.env.QORE_STAGING_PROJECT_REF,
    environment:process.env.QORE_MOBILITY_ENV,
    liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED,
    publicKey:process.env.QORE_STAGING_ANON_KEY,
    secret:process.env.QORE_STAGING_SERVICE_ROLE_KEY,manifest
   });
   console.log(JSON.stringify(result));
  }else throw Error(BLOCKED);
 }catch{
  console.error(BLOCKED);
  process.exitCode=1;
 }
}
