/**
 * G319: one expensive native location operation at a time, never a loop.
 * Only ephemeral scheduling metadata; no GPS, address, tokens or logging.
 */
export function createClientLocationWorkBudget({now=()=>Date.now(),
 gpsIntervalMs=30000,destinationIntervalMs=3000}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(gpsIntervalMs)||
  gpsIntervalMs<1000||!Number.isSafeInteger(destinationIntervalMs)||
  destinationIntervalMs<1000)throw Error('INVALID_LOCATION_BUDGET');
 let active=null,autoGpsUsed=false;
 let lastGps=-Infinity,lastDestination=-Infinity;
 const denial=(code)=>Object.freeze({ok:false,code});
 const success=Object.freeze({ok:true});
 const time=()=>{const x=now();return Number.isFinite(x)?x:0;};
 return Object.freeze({
  beginGps({manual=false}={}){
   if(active!==null)return denial('LOCATION_BUSY');
   if(!manual&&autoGpsUsed)return denial('GPS_AUTO_ALREADY_USED');
   const current=time();
   if(current-lastGps<gpsIntervalMs)return denial('GPS_COOLDOWN');
   autoGpsUsed=true;lastGps=current;active='gps';
   return success;
  },
  beginDestination(query){
   if(typeof query!=='string'||query.trim().length<4||
    query.length>120)return denial('INVALID_DESTINATION');
   if(active!==null)return denial('LOCATION_BUSY');
   const current=time();
   if(current-lastDestination<destinationIntervalMs)
    return denial('SEARCH_COOLDOWN');
   lastDestination=current;active='destination';
   return success;
  },
  end(kind){
   if(kind!=='gps'&&kind!=='destination')return false;
   if(active!==kind)return false;
   active=null;return true;
  },
  busy:()=>active!==null
 });
}
