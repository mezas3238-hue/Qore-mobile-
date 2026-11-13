/** Google Maps universal URLs: opens installed Maps (or browser), no API key.
 * It is an outgoing action only; it DOES NOT return a selected destination.
 */
const valid=p=>p&&typeof p==='object'&&!Array.isArray(p)&&
 typeof p.latitude==='number'&&typeof p.longitude==='number'&&
 Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&
 Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const coordinates=p=>p.latitude.toFixed(6)+','+p.longitude.toFixed(6);
export function createGoogleMapsLaunchUrl(kind,point=null){
 if(kind!=='pickup'&&kind!=='destination')return null;
 if(kind==='pickup'){
  return valid(point)?
   'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(coordinates(point)):
   'https://www.google.com/maps/@?api=1&map_action=map';
 }
 return valid(point)?
  'https://www.google.com/maps/@?api=1&map_action=map&center='+
   encodeURIComponent(coordinates(point))+'&zoom=16':
  'https://www.google.com/maps/@?api=1&map_action=map';
}

/**
 * Opens a passenger-confirmed route in the phone's Google Maps app/browser.
 * Maps calculates the road route and travel time itself; the app must NOT
 * treat those as a server-authoritative quote, ETA, or vehicle availability.
 * Returns null until BOTH coordinates exist and are distinct. No labels,
 * account identifiers, API credentials, or tracking parameters are sent.
 */
export function createGoogleMapsDirectionsUrl(pickup,destination){
 if(!valid(pickup)||!valid(destination))return null;
 const from=coordinates(pickup),to=coordinates(destination);
 if(from===to)return null;
 return 'https://www.google.com/maps/dir/?api=1&origin='+
  encodeURIComponent(from)+'&destination='+encodeURIComponent(to)+
  '&travelmode=driving';
}
