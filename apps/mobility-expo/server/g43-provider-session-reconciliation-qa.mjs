/**
 * G43 A24 - private provider-session observation adapter (isolated QA ONLY).
 *
 * This is NOT an HTTP route, an Auth provider connection, or a durable DB RPC.
 * In production, writeVersionedObservation must be backed by an independently
 * authenticated provider event and a compare-and-swap DB transaction.
 * The returned receipt NEVER grants permission to dispatch / finance / KYC.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const safeUuid=x=>typeof x==='string'&&UUID.test(x);
const deny=()=>{throw Error('G43_PROVIDER_SESSION_UNVERIFIED');};

/**
 * Provider user and provider session MUST be read independently, privately.
 * The DB writer MUST perform a revision CAS atomically (not implemented here).
 * No authority may be derived from token claims, request body or client roles.
 */
export function createG43ProviderSessionReconcilerQa({
 environment,liveEnabled,localQaOnly,readProviderUser,readProviderSession,
 readStoredRevision,writeVersionedObservation,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
    localQaOnly!==true||[
      readProviderUser,readProviderSession,readStoredRevision,
      writeVersionedObservation,now
    ].some(f=>typeof f!=='function'))
   throw Error('G43 private QA provider and DB sources required');

 return Object.freeze(async function reconcilePrivateProviderSession({
  userId,sessionId
 }={}){
  if(!safeUuid(userId)||!safeUuid(sessionId))deny();
  const at=now();
  if(!integer(at)||at>8640000000000000)deny();

  // Failure of EITHER external source aborts; never synthesize an active grant.
  const [user,s]=await Promise.all([
   readProviderUser(userId),
   readProviderSession({userId,sessionId})
  ]);
  if(!record(user)||user.id!==userId||
     user.is_anonymous===true||
     !(typeof user.email_confirmed_at==='string'||
       typeof user.phone_confirmed_at==='string')||
     !record(s)||s.userId!==userId||s.sessionId!==sessionId||
     !integer(s.revision)||s.revision<1||
     !integer(s.observedAtMs)||s.observedAtMs>at||
     at-s.observedAtMs>30000||
     !integer(s.providerConfirmedAtMs)||
     s.providerConfirmedAtMs>at||
     !integer(s.tokenAllowedFromMs)||
     s.tokenAllowedFromMs<s.providerConfirmedAtMs||
     !integer(s.expiresAtMs)||
     s.expiresAtMs<=s.providerConfirmedAtMs||
     !(s.active===true||s.active===false)||
     !['aal1','aal2'].includes(s.assuranceLevel))
   deny();
  // Provider AAL2 cannot be inferred from JWT 'aal' or Admin role claim.
  if(s.assuranceLevel==='aal2'&&
     (!integer(s.mfaVerifiedAtMs)||s.mfaVerifiedAtMs>at||
      at-s.mfaVerifiedAtMs>43200000))deny();

  const prior=await readStoredRevision({userId,sessionId});
  if(!integer(prior))deny();
  if(s.revision<=prior)
   return Object.freeze({outcome:'QA_STALE_IGNORED',revision:prior});
  const active=s.active===true&&s.expiresAtMs>at&&
    s.tokenAllowedFromMs<s.expiresAtMs;
  const status=active?'GRANT_QA_ONLY':'REVOKE_QA_ONLY';
  const change=Object.freeze({
   userId,sessionId,revision:s.revision,expectedPreviousRevision:prior,
   status,providerConfirmedAtMs:s.providerConfirmedAtMs,
   tokenAllowedFromMs:s.tokenAllowedFromMs,expiresAtMs:s.expiresAtMs,
   observedAtMs:s.observedAtMs,
   evidenceKind:'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
  });
  // Must be a privileged, revision-conditional write. Any failed CAS denies.
  const receipt=await writeVersionedObservation(change);
  if(!record(receipt)||receipt.applied!==true||
     receipt.revision!==s.revision)deny();
  return Object.freeze({
    outcome:'QA_OBSERVATION_RECORDED_NOT_AUTHORIZED',
    status,revision:s.revision
  });
 });
}
