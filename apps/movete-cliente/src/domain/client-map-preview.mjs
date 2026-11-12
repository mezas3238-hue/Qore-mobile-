/** Only explicit user action may open a third-party map with coordinates. */
export function createPassengerMapPreviewLinks(point,platform='android'){
 if(!point||typeof point!=='object'||Array.isArray(point)||
  typeof point.latitude!=='number'||typeof point.longitude!=='number'||
  !Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||
  Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return null;
 const loc=point.latitude.toFixed(6)+','+point.longitude.toFixed(6);
 // No labels, account IDs, identity or free-text search query in these URLs.
 const fallback='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(loc);
 const primary=platform==='ios'?
  'https://maps.apple.com/?ll='+encodeURIComponent(loc):
  'geo:'+loc+'?q='+encodeURIComponent(loc);
 return Object.freeze({primary,fallback});
}
