/** C #17 — one more private GET before a delivery offer ACCEPT POST.
 * Compares the user's previously inspected parcel with the exact same
 * persisted delivery offer, verified Driver identity and fresh inbox.
 * This is a client safety fence; G123/G38/G71 remain server-authoritative.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const actor=s=>s&&s.role==='driver'&&ID.test(s.userId??'')
 &&typeof s.accessToken==='string'&&s.accessToken.length>=20;
const matched=(a,b)=>a&&b&&a.offerId===b.offerId
 &&a.deliveryId===b.deliveryId&&a.vehicleKind===b.vehicleKind
 &&a.category===b.category&&a.grams===b.grams
 &&a.expiresAtMs===b.expiresAtMs
 &&['length','width','height'].every(k=>a.dimensionsCm?.[k]===b.dimensionsCm?.[k])
 &&a.qaOnly===true&&b.qaOnly===true
 &&a.productionEnabled===false&&b.productionEnabled===false;
export async function verifyFreshDeliveryAccept({
 offer,preview,getSession,readDetail,getWorkspace,now=Date.now
}={}){
 if(!offer||offer.kind!=='DELIVERY'||!ID.test(offer.offerId??'')
  ||!ID.test(offer.serviceId??'')||!preview
  ||typeof getSession!=='function'||typeof readDetail!=='function'
  ||typeof getWorkspace!=='function'||typeof now!=='function')
  return fail('DELIVERY_DETAIL_REQUIRED');
 if(!matched(preview,{...preview,offerId:offer.offerId,
  deliveryId:offer.serviceId,expiresAtMs:offer.expiresAtMs})
  ||offer.expiresAtMs<=now()+3000)
  return fail('DELIVERY_PREVIEW_STALE');
 try{
  const before=await getSession();
  if(!actor(before))return fail('DRIVER_AUTH_REQUIRED');
  const verified=await readDetail({accessToken:before.accessToken,
   offerId:offer.offerId});
  const after=await getSession();
  if(!actor(after)||before.userId!==after.userId
   ||before.accessToken!==after.accessToken)
   return fail('DRIVER_SESSION_CHANGED');
  const ws=getWorkspace();
  const live=ws?.phase==='connected'&&ws.currentLicenseApproved===true
   &&Array.isArray(ws.offers)
   &&ws.offers.some(x=>x.kind==='DELIVERY'
    &&x.offerId===offer.offerId&&x.serviceId===offer.serviceId
    &&x.expiresAtMs===offer.expiresAtMs);
  if(!live||offer.expiresAtMs<=now()+3000
   ||!matched(preview,verified))
   return fail('DELIVERY_OFFER_CHANGED');
  return Object.freeze({ok:true,code:'FRESH_DELIVERY_CONFIRMED'});
 }catch{return fail('DELIVERY_FRESH_READ_UNAVAILABLE');}
}
