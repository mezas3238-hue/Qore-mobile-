/** G125: only an independent certified server route can price a stored cargo delivery.
 * No provider is bundled/auto-enabled. A synthetic QA witness is never LIVE.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG=/^[A-Z_]{3,60}$/;
const ZONE=/^(AUTO|MOTO)_[A-Z_]{3,20}$/;
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createG125CargoPricingContext({
 enabled=false,loadSenderDelivery,resolveVerifiedCargoRoute,
 recordVerifiedRoute,now=Date.now
}={}){
 if(enabled!==true||[loadSenderDelivery,resolveVerifiedCargoRoute,
  recordVerifiedRoute,now].some(fn=>typeof fn!=='function'))
  throw Error('G125 independent cargo route authority not approved or unavailable');
 return async({actorId,fareMode,subjectKind,subjectId}={})=>{
  if(!UUID.test(actorId??'')||!UUID.test(subjectId??'')||
   fareMode!=='DELIVERY'||subjectKind!=='DELIVERY')
   throw Error('G125 requires authenticated saved delivery');
  const row=await loadSenderDelivery({actorId,deliveryId:subjectId});
  if(!obj(row)||row.id!==subjectId||row.sender_id!==actorId||
   !['AUTO','MOTO'].includes(row.requested_vehicle_kind)||
   row.status!=='requested'||row.courier_id!==null||
   !TAG.test(row.pickup_tag??'')||!TAG.test(row.delivery_tag??'')||
   row.pickup_tag===row.delivery_tag)
   throw Error('G125 delivery ownership or dispatch state invalid');
  const at=now();
  if(!int(at,1000000000000,9000000000000))
   throw Error('G125 invalid trusted route clock');
  // The adapter must verify coverage, places, Google/other real Routes response
  // and toll authority. Not a Client-supplied metric or zone.
  const route=await resolveVerifiedCargoRoute(Object.freeze({
   actorId,deliveryId:subjectId,vehicleKind:row.requested_vehicle_kind,
   pickupTag:row.pickup_tag,deliveryTag:row.delivery_tag
  }));
  if(!obj(route)||route.source!=='INDEPENDENT_ROAD_ROUTING_AUTHORITY'||
   route.coverageVerified!==true||route.routingVerified!==true||
   route.tollsVerified!==true||route.trafficAware!==true||
   route.fallbackUsed!==false||route.actorId!==actorId||
   route.deliveryId!==subjectId||
   route.vehicleKind!==row.requested_vehicle_kind||
   route.pickupTag!==row.pickup_tag||
   route.deliveryTag!==row.delivery_tag||
   !UUID.test(route.evidenceId??'')||!ZONE.test(route.zoneTag??'')||
   !route.zoneTag.startsWith(row.requested_vehicle_kind+'_')||
   !int(route.distanceMeters,1,500000)||
   !int(route.durationSeconds,1,86400)||
   !int(route.tollsPyg,0,1000000)||
   !int(route.verifiedAtMs,at-60000,at)||
   !int(route.expiresAtMs,at+1,route.verifiedAtMs+60000))
   throw Error('G125 unverified, mismatched or stale road evidence');
  const receipt=await recordVerifiedRoute({
   actorId,deliveryId:subjectId,evidenceId:route.evidenceId,
   vehicleKind:route.vehicleKind,zoneTag:route.zoneTag,
   pickupTag:route.pickupTag,deliveryTag:route.deliveryTag,
   distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,
   tollsPyg:route.tollsPyg,verifiedAtMs:route.verifiedAtMs,
   expiresAtMs:route.expiresAtMs
  });
  if(!obj(receipt)||receipt.deliveryId!==subjectId||
   receipt.ownerId!==actorId||receipt.evidenceId!==route.evidenceId||
   receipt.vehicleKind!==route.vehicleKind||
   receipt.zoneTag!==route.zoneTag||
   receipt.distanceMeters!==route.distanceMeters||
   receipt.durationSeconds!==route.durationSeconds||
   receipt.tollsPyg!==route.tollsPyg||
   receipt.routingVerified!==true||receipt.liveEnabled!==false||
   receipt.serverPersisted!==true)
   throw Error('G125 SQL route registration rejected');
  return Object.freeze({
   zoneTag:route.zoneTag,distanceMeters:route.distanceMeters,
   durationSeconds:route.durationSeconds,tollsPyg:route.tollsPyg,
   trafficAware:true,fallbackUsed:false
  });
 };
}
