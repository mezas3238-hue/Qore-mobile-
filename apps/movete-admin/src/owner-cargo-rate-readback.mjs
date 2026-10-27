/** Read-after-write G124 Owner cargo tariffs.
 * POST alone is not a reconciled policy. Pure, no secrets.
 */
const fields=['basePyg','perKmPyg','perMinutePyg','minimumPyg',
 'commissionBps','ruleId','ruleVersion','validUntil','active',
 'vehicleKind','cargoZone','passengerSubsidyPolicyApplicable',
 'mode','liveEnabled','version'];
const valid=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export function certifyOwnerCargoRateReadback({written,readback,
 previousVersion=0,kind,zone}={}){
 if(!valid(written)||!valid(readback)||!['AUTO','MOTO'].includes(kind)
  ||typeof zone!=='string'||!/^[A-Z_]{3,20}$/.test(zone)
  ||!Number.isSafeInteger(previousVersion)||previousVersion<0)
  return Object.freeze({ok:false,code:'CARGO_INVALID_WRITE_PROOF'});
 for(const o of [written,readback]){
  if(o.vehicleKind!==kind||o.cargoZone!==zone
   ||o.mode!=='STAGING_DEMO_ONLY'||o.liveEnabled!==false
   ||o.passengerSubsidyPolicyApplicable!==false||o.active!==true
   ||!Number.isSafeInteger(o.version)||o.version<=previousVersion)
   return Object.freeze({ok:false,code:'CARGO_WRITE_NOT_RECONCILED'});
 }
 if(fields.some(f=>written[f]!==readback[f]))
  return Object.freeze({ok:false,code:'CARGO_WRITE_READBACK_MISMATCH'});
 return Object.freeze({ok:true,version:readback.version,ruleId:readback.ruleId});
}
