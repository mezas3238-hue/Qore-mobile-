/** QORE Mobile GPS STAGING contract — no device access, no network, no live tracking. */
export const GPS_LIVE_ENABLED=false;
export const GPS_MAX_AGE_MS=30_000;
export const GPS_MAX_ACCURACY_METERS=75;
const valid=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
/** Require explicit consent and fresh, plausible location. No implicit fallback. */
export function verifyGpsSample(sample,nowMs){
 if(!sample||typeof sample!=='object'||Array.isArray(sample)||
    sample.consentGranted!==true||sample.available!==true||
    !Number.isSafeInteger(nowMs)||nowMs<0||
    !valid(sample.lat,-90,90)||!valid(sample.lng,-180,180)||
    !valid(sample.accuracyMeters,0,GPS_MAX_ACCURACY_METERS)||
    !Number.isSafeInteger(sample.capturedAtMs)||sample.capturedAtMs<0||
    sample.capturedAtMs>nowMs+10_000||nowMs-sample.capturedAtMs>GPS_MAX_AGE_MS)
  return {ok:false,reason:'GPS unavailable or unverified',liveEnabled:false};
 return {ok:true,liveEnabled:false,location:{lat:sample.lat,lng:sample.lng},accuracyMeters:sample.accuracyMeters};
}
/** Navigation links are opt-in, external only; no keys, passenger data or tracking. */
export function externalNavigationLinks(destination){
 if(!destination||!valid(destination.lat,-90,90)||!valid(destination.lng,-180,180))return null;
 const coords=`${destination.lat},${destination.lng}`;
 return {
  googleMaps:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}`,
  waze:`https://waze.com/ul?ll=${encodeURIComponent(coords)}&navigate=yes`,
 };
}
/** Server-only adapter boundary. Real Google Routes calls need audited server credentials. */
export function createStagingRoutesAdapter(provider){
 if(typeof provider!=='function')throw Error('Routing adapter unavailable');
 return async request=>{
  if(!request||request.mode!=='SYNTHETIC_STAGING'||!Array.isArray(request.origins)||
     request.origins.length<1||request.origins.length>20||
     !request.destination||!valid(request.destination.lat,-90,90)||
     !valid(request.destination.lng,-180,180))
    return {ok:false,reason:'Routing request not authorized',liveEnabled:false};
  try {
   const rows=await provider(request);
   if(!Array.isArray(rows)||rows.length>request.origins.length)return {ok:false,reason:'Routing provider unavailable',liveEnabled:false};
   return {ok:true,rows,liveEnabled:false};
  }catch{return {ok:false,reason:'Routing provider unavailable',liveEnabled:false};}
 };
}
