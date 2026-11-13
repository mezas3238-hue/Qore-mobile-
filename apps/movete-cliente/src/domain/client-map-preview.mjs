/** User-triggered Google Maps point preview, no API key. */
export function createPassengerMapPreviewLinks(point,platform='android'){
 if(!point||typeof point!=='object'||Array.isArray(point)||
  typeof point.latitude!=='number'||typeof point.longitude!=='number'||
  !Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||
  Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return null;
 const loc=point.latitude.toFixed(6)+','+point.longitude.toFixed(6);
 // Only coordinates after an explicit tap; Google Maps never returns selection automatically.
 const primary='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(loc);
 const fallback=platform==='android'? 'geo:'+loc+'?q='+encodeURIComponent(loc):
  'https://www.google.com/maps/@?api=1&map_action=map&center='+encodeURIComponent(loc)+'&zoom=16';
 return Object.freeze({primary,fallback});
}
