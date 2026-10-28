/**
 * G130 A: adapter contract between G128 and a transactional PostgreSQL16
 * free-tier quota reservation (service-role SQL only; not a mobile API).
 * The independent coverageEvidenceId IS the reservation idempotency key.
 * A duplicate/ambiguous reservation MUST NOT initiate another route HTTP.
 * Deployment remains OFF until a trusted PostgreSQL backend is mounted.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createG130GeoapifyFreeQuotaAdapter({
 enabled=false,ownerFreePlanApproved=false,
 postgresAtomicQuotaVerified=false,reserveInPostgres=null
}={}){
 const ready=enabled===true&&ownerFreePlanApproved===true
  &&postgresAtomicQuotaVerified===true&&typeof reserveInPostgres==='function';
 return async function reserveFreeQuota(body={}){
  if(!ready)throw Error('G130 durable free quota not certified');
  if(!obj(body)||Object.keys(body).length!==8
   ||!['actorId','deliveryId','vehicleKind','coverageEvidenceId',
    'provider','creditReservation','maxDailyCredits','maxDailyCalls']
      .every(k=>Object.hasOwn(body,k))
   ||!UUID.test(body.actorId??'')||!UUID.test(body.deliveryId??'')
   ||!UUID.test(body.coverageEvidenceId??'')
   ||!['AUTO','MOTO'].includes(body.vehicleKind)
   ||body.provider!=='GEOAPIFY_FREE'||body.creditReservation!==3
   ||body.maxDailyCredits!==300||body.maxDailyCalls!==100)
   throw Error('G130 invalid server-only reservation');
  const scope=Object.freeze({
   actorId:body.actorId,deliveryId:body.deliveryId,
   vehicleKind:body.vehicleKind,
   coverageEvidenceId:body.coverageEvidenceId,
   // Same coverage attestation always maps to same request key. A caller
   // cannot create fresh UUID to relaunch a failed provider read.
   requestKey:body.coverageEvidenceId
  });
  let receipt;
  try{receipt=await reserveInPostgres(scope);}
  catch{throw Error('G130 PostgreSQL quota unavailable');}
  if(!obj(receipt)||receipt.durable!==true
   ||receipt.deliveryId!==scope.deliveryId
   ||receipt.vehicleKind!==scope.vehicleKind
   ||receipt.coverageEvidenceId!==scope.coverageEvidenceId
   ||receipt.provider!=='GEOAPIFY_FREE')
   throw Error('G130 mismatched quota receipt');
  if(receipt.approved!==true){
   if(receipt.approved!==false
    ||!['ALREADY_RESERVED_NO_RETRY','FREE_DAILY_BUDGET_EXHAUSTED']
      .includes(receipt.reason))
    throw Error('G130 rejected unsupported quota response');
   return Object.freeze({...scope,approved:false,durable:true,
    reason:receipt.reason});
  }
  if(!UUID.test(receipt.reservationId??'')
   ||receipt.reservedCredits!==3)
   throw Error('G130 unverified quota reservation');
  return Object.freeze({approved:true,durable:true,
   reservationId:receipt.reservationId,
   deliveryId:scope.deliveryId,vehicleKind:scope.vehicleKind,
   coverageEvidenceId:scope.coverageEvidenceId});
 };
}
