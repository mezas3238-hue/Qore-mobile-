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
 request=fetch,now=Date.now,timeoutMs=8000,maxJsonChars=8192
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||
    !bearer.test(accessToken)||typeof request!=='function'||typeof now!=='function')
  throw Error('Driver QA login or connection not configured');
 const origin=resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
 const at=now();
 if(!Number.isSafeInteger(at)||at<0)throw Error('Driver QA clock invalid');
 // The 5s private-inbox polling must not hang indefinitely when a
 // network stack or body reader ignores AbortSignal. No automatic POST.
 const ctl=new AbortController();
 const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=100
  &&timeoutMs<=30000?timeoutMs:8000;
 const limit=Number.isSafeInteger(maxJsonChars)&&maxJsonChars>=1024
  &&maxJsonChars<=32768?maxJsonChars:8192;
 let timeoutId;
 const timedOut=new Promise((_,reject)=>{
  timeoutId=setTimeout(()=>{
   ctl.abort();reject(Error('Driver inbox unavailable'));
  },ms);
 });
 const within=p=>Promise.race([p,timedOut]);
 let response,data;
 try{
  try{
   response=await within(request(origin+'/v1/staging/driver/inbox',{
    method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
    referrerPolicy:'no-referrer',signal:ctl.signal,
    headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
   }));
  }catch{throw Error('Driver inbox unavailable');}
  if(response?.status===401)throw Error('Driver session expired');
  if(response?.status===403)throw Error('Driver role not authorized');
  if(response?.status!==200||response?.redirected===true)
   throw Error('Driver inbox unavailable');
  const length=response.headers?.get?.('content-length');
  if(length!=null&&(!/^\\d+$/.test(length)||Number(length)>limit))
   throw Error('Driver inbox invalid response');
  try{
   data=await within(response.json());
   if(JSON.stringify(data).length>limit)
    throw Error('Driver inbox body too large');
  }catch{throw Error('Driver inbox invalid response');}
 }finally{clearTimeout(timeoutId);}
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
