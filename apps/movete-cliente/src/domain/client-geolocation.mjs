/**
 * G309: validate on-device GPS and geocoded suggestions without exporting
 * location, addresses or history to analytics, URLs or persistent storage.
 * This does not certify commercial geospatial routing/price/availability.
 */
const safeText=text=>typeof text==='string'&&text.trim().length>=3&&
 text.trim().length<=120&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text);
const failure=(code)=>Object.freeze({ok:false,code});
export function inspectPassengerGpsFix(fix){
 if(!fix||typeof fix!=='object'||Array.isArray(fix)||
  typeof fix.latitude!=='number'||typeof fix.longitude!=='number'||
  !Number.isFinite(fix.latitude)||!Number.isFinite(fix.longitude)||
  Math.abs(fix.latitude)>90||Math.abs(fix.longitude)>180)
  return failure('INVALID_COORDINATES');
 if(fix.mocked===true)return failure('SIMULATED_GPS');
 if(typeof fix.accuracyMeters!=='number'||
  !Number.isFinite(fix.accuracyMeters)||fix.accuracyMeters<0)
  return failure('UNKNOWN_ACCURACY');
 if(fix.accuracyMeters>100)return failure('GPS_NOT_PRECISE');
 return Object.freeze({ok:true,point:Object.freeze({
  latitude:fix.latitude,longitude:fix.longitude,
  accuracyMeters:fix.accuracyMeters
 }),commercialVerified:false});
}
export function makePassengerAddressLabel(address, fallback=null){
 if(!address||typeof address!=='object'||Array.isArray(address))
  return safeText(fallback)?fallback.trim():null;
 const parts=[address.streetNumber,address.street,address.district,
  address.city,address.region].filter(x=>typeof x==='string'&&x.trim().length>0)
  .map(x=>x.trim());
 const unique=[...new Set(parts)],label=unique.join(', ');
 return safeText(label)?label.slice(0,120):
  safeText(fallback)?fallback.trim():null;
}
export function inspectDestinationCandidates(candidates){
 if(!Array.isArray(candidates))return Object.freeze([]);
 const accepted=[];
 for(const candidate of candidates.slice(0,5)){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||
   !Number.isFinite(candidate.latitude)||!Number.isFinite(candidate.longitude)||
   Math.abs(candidate.latitude)>90||Math.abs(candidate.longitude)>180||
   !safeText(candidate.label))continue;
  if(accepted.some(p=>p.latitude===candidate.latitude&&p.longitude===candidate.longitude))continue;
  accepted.push(Object.freeze({
   label:candidate.label.trim(),latitude:candidate.latitude,
   longitude:candidate.longitude
  }));
 }
 return Object.freeze(accepted);
}
export function isCurrentPassengerLocationResult({
 requestEpoch,currentEpoch,privateRevision,activeRevision,appActive
}={}){
 return Number.isSafeInteger(requestEpoch)&&requestEpoch>=0&&
  requestEpoch===currentEpoch&&Number.isSafeInteger(privateRevision)&&
  privateRevision===activeRevision&&appActive===true;
}
