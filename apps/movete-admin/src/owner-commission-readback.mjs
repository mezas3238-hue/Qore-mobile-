/** D #18 — after an Owner G116 commission POST, demand a separate GET.
 * Neither browser nor HTTP 200 may attest a persisted change alone.
 */
const kinds=new Set(['AUTO_RIDE','MOTO_RIDE']);
const valid=d=>d!==null&&typeof d==='object'&&!Array.isArray(d)
 &&kinds.has(d.serviceKind)&&Number.isSafeInteger(d.commissionBps)
 &&d.commissionBps>=1000&&d.commissionBps<=3000
 &&d.subsidyBps===1000&&Number.isSafeInteger(d.version)
 &&d.version>=1&&d.mode==='STAGING_DEMO_ONLY'
 &&d.productionEnabled===false;
const deny=code=>Object.freeze({ok:false,code});
export function certifyOwnerCommissionReadback({
 written,readback,previousVersion,service
}={}){
 if(!valid(written)||!valid(readback)
  ||!kinds.has(service)||written.serviceKind!==service
  ||readback.serviceKind!==service)
  return deny('G116_INVALID_POLICY');
 if(!Number.isSafeInteger(previousVersion)||previousVersion<1
  ||written.version<=previousVersion
  ||readback.version!==written.version)
  return deny('G116_POLICY_VERSION_MISMATCH');
 if(readback.commissionBps!==written.commissionBps
  ||readback.subsidyBps!==written.subsidyBps)
  return deny('G116_POLICY_NOT_PERSISTED');
 return Object.freeze({ok:true,code:'G116_READBACK_VERIFIED'});
}
