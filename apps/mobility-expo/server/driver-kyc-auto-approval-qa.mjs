/**
 * Movete Fácil / Driver KYC: mandatory FACE SELFIE and document auto-review.
 * QA ONLY; no document upload, OCR, face recognition or LIVE approval in this
 * module. Input is independently verified backend attestations, NEVER client
 * claimed expiry/authenticity/match.
 */
export const AUTO_DRIVER_ACCOUNT_APPROVAL_LIVE_ENABLED=false;
export const DRIVER_REQUIRED_KYC_KINDS=Object.freeze([
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie'
]);
const VEHICLE=new Set(['cedula_verde','habilitacion','seguro','inspeccion']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAIN=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,k)=>PLAIN(x)&&Object.keys(x).length===k.length&&
 k.every(s=>Object.hasOwn(x,s));
const DOC_FIELDS=['kind','driverId','vehicleId','status','authenticityVerified',
 'issuerVerified','expiryVerified','validUntilMs','verifiedAtMs'];
const FACE_FIELDS=['driverId','photoReceived','consentGranted',
 'livenessVerified','identityFaceMatchVerified','trustedProviderVerified',
 'verifiedAtMs','expiresAtMs'];
const VEH_FIELDS=['driverId','vehicleId','vehicleKind','ownershipVerified',
 'registrationMatchesVehicle','vehicleEligibleForReview'];
const STATES=new Set(['verified','pending','rejected','expired','disputed']);
const status=(reviewState,missingKinds=[],needsReview=[],ready=false)=>
 Object.freeze({mode:'STAGING_DEMO_ONLY',reviewState,
 missingKinds:Object.freeze(missingKinds),
 needsReview:Object.freeze(needsReview),
 eligibleForAutomaticApproval:ready,
 accountApproved:false,driverEligible:false,
 qaOnly:true,productionEnabled:false,liveOperationsEnabled:false});
/**
 * Call only on a trusted server. Evidence must originate from private
 * Storage+malware+document issuer verification, and face from a consented
 * liveness/ID-match provider with a non-biometric manual appeals path.
 */
export function evaluateDriverAutoApproval({
 driverId,vehicleId,vehicleKind,documents,face,vehicle,now=Date.now()
}={}){
 if(!UUID.test(driverId??'')||!UUID.test(vehicleId??'')||
  !['AUTO','MOTO'].includes(vehicleKind)||
  !Number.isSafeInteger(now)||now<0||
  !Array.isArray(documents)||documents.length>8||
  !exact(vehicle,VEH_FIELDS)||vehicle.driverId!==driverId||
  vehicle.vehicleId!==vehicleId||vehicle.vehicleKind!==vehicleKind)
  return status('MANUAL_REVIEW',[],['UNTRUSTED_ONBOARDING_SCOPE']);
 if(vehicle.ownershipVerified!==true||
  vehicle.registrationMatchesVehicle!==true||
  vehicle.vehicleEligibleForReview!==true)
  return status('MANUAL_REVIEW',[],['VEHICLE_NOT_VERIFIED']);
 const seen=new Set(),byKind=new Map(),manual=new Set();
 for(const d of documents){
  if(!exact(d,DOC_FIELDS)||!DRIVER_REQUIRED_KYC_KINDS.includes(d.kind)||
   seen.has(d.kind)||d.driverId!==driverId||
   (VEHICLE.has(d.kind)?d.vehicleId!==vehicleId:d.vehicleId!==null)||
   !STATES.has(d.status)||
   typeof d.authenticityVerified!=='boolean'||
   typeof d.issuerVerified!=='boolean'||
   typeof d.expiryVerified!=='boolean'||
   !Number.isSafeInteger(d.validUntilMs)||
   !Number.isSafeInteger(d.verifiedAtMs)||d.verifiedAtMs>now)
   return status('MANUAL_REVIEW',[],['INVALID_OR_DUPLICATE_EVIDENCE']);
  seen.add(d.kind);byKind.set(d.kind,d);
  if(['rejected','disputed'].includes(d.status))manual.add(d.kind);
 }
 const missing=DRIVER_REQUIRED_KYC_KINDS.filter(k=>!seen.has(k));
 const faceDocument=byKind.get('rostro_selfie');
 if(face!==null&&face!==undefined&&
  (!exact(face,FACE_FIELDS)||face.driverId!==driverId||
   !Number.isSafeInteger(face.verifiedAtMs)||face.verifiedAtMs>now||
   !Number.isSafeInteger(face.expiresAtMs)))
  return status('MANUAL_REVIEW',missing,['INVALID_FACE_ATTESTATION']);
 if(faceDocument&&(!face||face.photoReceived!==true||
  face.consentGranted!==true||face.livenessVerified!==true||
  face.identityFaceMatchVerified!==true||
  face.trustedProviderVerified!==true||face.expiresAtMs<=now))
  manual.add('rostro_selfie');
 if(manual.size>0)return status('MANUAL_REVIEW',missing,[...manual]);
 if(missing.length)return status('PENDING_DOCUMENTS',missing);
 const pending=DRIVER_REQUIRED_KYC_KINDS.filter(k=>{
  const d=byKind.get(k);
  return d.status!=='verified'||d.authenticityVerified!==true||
   d.issuerVerified!==true||d.expiryVerified!==true||
   d.validUntilMs<=now;
 });
 if(pending.length)return status('PENDING_VERIFICATION',[],pending);
 return status('READY_FOR_ATOMIC_APPROVAL',[],[],true);
}
/**
 * Account state is never approved by a mobile action. The only approved
 * receipt must come from a server-side atomic SQL transaction which rechecks
 * evidence, vehicle and session against G42 under locks; this factory has
 * NO such database implementation or fake approved status.
 */
export function createDriverKycAutoReviewQa({
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveDriverRole,
 readAttestedDocuments,readAttestedFace,readAttestedVehicle,now=Date.now,
 environment='isolated_staging',liveEnabled=false
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveDriverRole,
   readAttestedDocuments,readAttestedFace,readAttestedVehicle,now]
   .some(x=>typeof x!=='function'))
  throw Error('KYC only in authenticated isolated QA with independent attestors');
 return async({accessToken,vehicleId,vehicleKind}={})=>{
  const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
  if(typeof accessToken!=='string'||!TOKEN.test(accessToken)||
   !UUID.test(vehicleId??'')||!['AUTO','MOTO'].includes(vehicleKind))
   return status('MANUAL_REVIEW',[],['INVALID_REQUEST']);
  let who;
  try{who=await verifyAccessToken(accessToken);}catch{
   return status('MANUAL_REVIEW',[],['UNVERIFIED_IDENTITY']);}
  const at=now();
  if(!exact(who,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(who.id)||!UUID.test(who.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(who.tokenIatMs)||who.tokenIatMs>at||
   !Number.isSafeInteger(who.expiresAtMs)||who.expiresAtMs<=at||
   who.is_anonymous!==false)
   return status('MANUAL_REVIEW',[],['UNVERIFIED_IDENTITY']);
  try{
   if(await verifySessionNotRevoked({
     userId:who.id,sessionId:who.sessionId,at
   })!==true||await resolveExclusiveDriverRole(who.id)!=='driver')
    return status('MANUAL_REVIEW',[],['SESSION_OR_ROLE_INVALID']);
   const [documents,face,vehicle]=await Promise.all([
    readAttestedDocuments({driverId:who.id,vehicleId}),
    readAttestedFace({driverId:who.id,vehicleId}),
    readAttestedVehicle({driverId:who.id,vehicleId})
   ]);
   return evaluateDriverAutoApproval({
    driverId:who.id,vehicleId,vehicleKind,documents,face,vehicle,now:at
   });
  }catch{
   return status('MANUAL_REVIEW',[],['VERIFICATION_SERVICE_UNAVAILABLE']);
  }
 };
}
