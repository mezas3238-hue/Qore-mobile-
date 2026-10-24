/** G29: resume exclusivamente estados documentales de la página mostrada.
 * La verificación final y toda habilitación operativa corresponden al servidor.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const columns=['vehicleId','vehicleKind','applicationStatus','licenseStatus','insuranceStatus','inspectionStatus','reviewRevision'];
const allowed=new Set(['valid','pending','missing','expired','rejected']);
export const KYC_FILTERS=Object.freeze(['ALL','EXPIRED','REJECTED','MISSING','PENDING','REPORTED_VALID']);
export function classifyKycEvidence(row){
 if(!row||typeof row!=='object'||Array.isArray(row)
  ||Object.keys(row).length!==columns.length||!columns.every(k=>Object.hasOwn(row,k))
  ||typeof row.vehicleId!=='string'||!UUID.test(row.vehicleId)
  ||!['AUTO','MOTO_DELIVERY'].includes(row.vehicleKind)
  ||!['pending','under_review','rejected','approved','expired'].includes(row.applicationStatus)
  ||!Number.isSafeInteger(row.reviewRevision)||row.reviewRevision<0
  ||!['licenseStatus','insuranceStatus','inspectionStatus'].every(k=>allowed.has(row[k])))return null;
 const statuses=[row.licenseStatus,row.insuranceStatus,row.inspectionStatus];
 if(statuses.includes('expired'))return 'EXPIRED';
 if(statuses.includes('rejected'))return 'REJECTED';
 if(statuses.includes('missing'))return 'MISSING';
 if(statuses.includes('pending'))return 'PENDING';
 return 'REPORTED_VALID';
}
export function projectKycPageView(items,{filter='ALL'}={}){
 if(!Array.isArray(items)||items.length>50||!KYC_FILTERS.includes(filter))return null;
 const counts={ALL:items.length,EXPIRED:0,REJECTED:0,MISSING:0,PENDING:0,REPORTED_VALID:0};
 const selected=[];
 for(const item of items){
  const evidence=classifyKycEvidence(item);
  if(!evidence)return null;
  counts[evidence]++;
  if(filter==='ALL'||filter===evidence)
   selected.push(Object.freeze({vehicleId:item.vehicleId,vehicleKind:item.vehicleKind,
    applicationStatus:item.applicationStatus,licenseStatus:item.licenseStatus,
    insuranceStatus:item.insuranceStatus,inspectionStatus:item.inspectionStatus,
    reviewRevision:item.reviewRevision,evidence}));
 }
 return Object.freeze({scope:'VISIBLE_PAGE_ONLY',counts:Object.freeze(counts),
  visibleCount:selected.length,items:Object.freeze(selected),
  operationalEligibilityConfirmed:false});
}
