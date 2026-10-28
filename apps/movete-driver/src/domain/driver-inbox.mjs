/** Movete Fácil Driver: one-off STAGING QA inbox bridge.
 * Separate binary from Cliente. Only localhost; requires external verified JWT
 * provider. Never caches a bearer, assumes push receipt, or dispatches LIVE.
 */
export const DRIVER_INBOX_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearer=/^[A-Za-z0-9._~-]{20,7900}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export async function readDriverPrivateInbox({
 apiOrigin,accessToken,approvedStagingHost=null,allowedByOwner=false,
 request=fetch,now=Date.now
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||
    !bearer.test(accessToken)||typeof request!=='function'||typeof now!=='function')
  throw Error('Driver QA login or connection not configured');
 const origin=resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
 const at=now();
 if(!Number.isSafeInteger(at)||at<0)throw Error('Driver QA clock invalid');
 let response;
 try{
  response=await request(origin+'/v1/staging/driver/inbox',{
   method:'GET',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
 }catch{throw Error('Driver inbox unavailable');}
 if(response?.status===401)throw Error('Driver session expired');
 if(response?.status===403)throw Error('Driver role not authorized');
 if(response?.status!==200)throw Error('Driver inbox unavailable');
 let data;
 try{data=await response.json();}catch{throw Error('Driver inbox invalid response');}
 if(!object(data)||data.mode!=='STAGING_DEMO_ONLY'||
   data.liveTripsEnabled!==false||data.liveDeliveriesEnabled!==false||
   data.pushDelivered!==false||data.deviceReceived!==false||
   data.suggestedPollIntervalMs!==5000||
   !Array.isArray(data.offers)||data.offers.length>10)
  throw Error('Driver inbox invalid response');
 const seen=new Set(),offers=[];
 for(const row of data.offers){
  if(!object(row)||Object.keys(row).length!==4||
     !['AUTO_RIDE','DELIVERY'].includes(row.kind)||
     typeof row.offerId!=='string'||!UUID.test(row.offerId)||
     typeof row.serviceId!=='string'||!UUID.test(row.serviceId)||
     !Number.isSafeInteger(row.expiresAtMs)||row.expiresAtMs<=at+3000||
     row.expiresAtMs>at+45000)
   throw Error('Driver inbox invalid offer');
  const id=row.kind+':'+row.offerId;
  if(seen.has(id))throw Error('Driver inbox duplicate offer');
  seen.add(id);
  offers.push(Object.freeze({
   kind:row.kind,offerId:row.offerId,serviceId:row.serviceId,expiresAtMs:row.expiresAtMs
  }));
 }
 return Object.freeze(offers);
}
