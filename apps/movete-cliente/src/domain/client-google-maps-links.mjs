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
