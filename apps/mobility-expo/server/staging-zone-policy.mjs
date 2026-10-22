/** QORE Paraguay STAGING geography != commercial service availability. */
export const NATIONAL_ZONES_LIVE_ENABLED=false;
const validCoord=p=>p&&typeof p==='object'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
const safeId=x=>typeof x==='string'&&/^[a-z0-9_-]{1,64}$/.test(x);
const services=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Polygon boundaries are verified elsewhere; a matching zone never authorizes real dispatch. */
export function evaluateSyntheticZone({zone,service,point,insidePolygon}={}){
 if(!zone||!safeId(zone.id)||!services.has(service)||!validCoord(point)||typeof insidePolygon!=='function')return fail('Invalid zone request');
 if(zone.country!=='PY'||zone.mode!=='SYNTHETIC_STAGING'||zone.liveEnabled!==false)return fail('Zone not approved for staging');
 if(zone.status!=='test_enabled'||!Array.isArray(zone.allowedServices)||!zone.allowedServices.includes(service))return fail('Service not enabled in zone');
 if(service==='MOTO'&&zone.motoPassengerLegalityVerified!==true)return fail('Motorcycle passenger legality not verified');
 try{if(insidePolygon(zone.polygon,point)!==true)return fail('Outside synthetic zone');}
 catch{return fail('Geofence unavailable');}
 return {ok:true,zoneId:zone.id,service,liveEnabled:false,dispatchAuthorized:false};
}
