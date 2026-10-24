/**
 * R50 — recheck a G44 branch at tap time, against the current authenticated
 * Client snapshot. This allows ONLY a local selection for subsequent catalog
 * lookup; it is not availability, ordering, payment or delivery authorization.
 */
import {isCommercePageFresh} from './commerce-ttl-refresh.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERTICALS=new Set(['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER']);
const SERVICES=new Set(['MOTO_DELIVERY','AUTO_DELIVERY']);
const ROW_KEYS=['branchId','branchTag','merchantKind','municipality',
 'serviceKind','eligibleByPolicy','orderEnabled'];
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(key=>Object.hasOwn(x,key));
const actor=x=>x?.authenticated===true&&x.account?.role==='passenger'
 &&typeof x.account.subject==='string'&&UUID.test(x.account.subject)
 &&Number.isSafeInteger(x.privateViewRevision)&&x.privateViewRevision>=0;
const safeRow=x=>exact(x,ROW_KEYS)&&typeof x.branchId==='string'
 &&UUID.test(x.branchId)&&typeof x.branchTag==='string'
 &&x.branchTag.length>0&&x.branchTag.length<=120
 &&VERTICALS.has(x.merchantKind)&&typeof x.municipality==='string'
 &&SERVICES.has(x.serviceKind)
 &&x.eligibleByPolicy===false&&x.orderEnabled===false;
const rowEqual=(a,b)=>ROW_KEYS.every(key=>a[key]===b[key]);

export function guardCommerceBranchSelection(displayed,current,{
 branchId=null,vertical=null,municipality=null,serviceKind=null,
 now=Date.now()
}={}){
 if(!actor(displayed)||!actor(current)
  ||displayed.account.subject!==current.account.subject
  ||displayed.privateViewRevision!==current.privateViewRevision)
  return fail('BRANCH_SESSION_CHANGED');
 if(typeof branchId!=='string'||!UUID.test(branchId)
  ||!VERTICALS.has(vertical)||typeof municipality!=='string'
  ||municipality.length<2||municipality.length>80||!SERVICES.has(serviceKind))
  return fail('INVALID_BRANCH_SELECTION');
 const shown=displayed.branchDirectory,live=current.branchDirectory;
 if(!obj(shown)||!obj(live)||shown.readReady!==true
  ||live.readReady!==true||shown.loading!==false||live.loading!==false
  ||shown.error!==null||live.error!==null
  ||shown.ordersEnabled!==false||live.ordersEnabled!==false
  ||shown.paymentsEnabled!==false||live.paymentsEnabled!==false
  ||shown.availabilityVerified!==false||live.availabilityVerified!==false
  ||shown.serverSnapshotConsistent!==false||live.serverSnapshotConsistent!==false
  ||shown.globalTotalKnown!==false||live.globalTotalKnown!==false)
  return fail('BRANCH_DIRECTORY_NOT_CERTIFIED');
 if(!isCommercePageFresh(shown.expiresAt,now)
  ||!isCommercePageFresh(live.expiresAt,now))
  return fail('BRANCH_PAGE_EXPIRED');
 if(shown.expiresAt!==live.expiresAt
  ||shown.pageNumber!==live.pageNumber
  ||!Number.isSafeInteger(live.pageNumber)||live.pageNumber<1
  ||shown.municipality!==municipality||live.municipality!==municipality
  ||shown.serviceKind!==serviceKind||live.serviceKind!==serviceKind
  ||!Array.isArray(shown.items)||!Array.isArray(live.items)
  ||shown.items.length!==live.items.length||live.items.length>100)
  return fail('BRANCH_PAGE_CHANGED');
 // Compare the entire bounded page to prevent old-row selection after a
 // refresh that reused the same cursor/page number.
 const seen=new Set();
 for(let i=0;i<live.items.length;i++){
  const before=shown.items[i],after=live.items[i];
  if(!safeRow(before)||!safeRow(after)||!rowEqual(before,after)
   ||after.municipality!==municipality||after.serviceKind!==serviceKind
   ||seen.has(after.branchId))
   return fail('BRANCH_PAGE_CHANGED');
  seen.add(after.branchId);
 }
 const selected=live.items.find(row=>row.branchId===branchId);
 if(!selected||selected.merchantKind!==vertical)
  return fail('BRANCH_NOT_IN_SELECTED_CATEGORY');
 return Object.freeze({ok:true,branchId,
  scope:'CURRENT_VERIFIED_BRANCH_PAGE_ONLY',
  availabilityVerified:false,ordersEnabled:false,paymentsEnabled:false});
}
