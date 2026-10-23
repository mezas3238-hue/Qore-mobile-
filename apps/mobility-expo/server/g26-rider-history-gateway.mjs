/**
 * G26: JWT-bound, owner-only Client history envelope, STAGING QA.
 * No prices, driver information, plates, personal documents or locations.
 * Incomplete page/errors never become an apparently complete empty list.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH='/v1/staging/rider/history';
const kinds=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const states=new Set(['searching','assigned','in_progress','completed','cancelled','failed']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const respond=(status,body)=>({status,body});
const bearerFrom=h=>{
 const v=h?.authorization??h?.Authorization;
 return typeof v==='string'&&v.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(v)?.[1]??null:null;
};
export function createQoreRiderHistoryGateway({
 projectRef,verifyAccessToken,authorizePassenger,allowRequest,loadOwnHistory,now=Date.now
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,allowRequest,loadOwnHistory,now]
  .every(x=>typeof x==='function'))throw Error('Private history adapters required');
 return async({method,path,headers,body})=>{
  if(method!=='GET'||path!==PATH)return respond(404,{error:'Not found'});
  if(body!==null&&body!==undefined)return respond(400,{error:'No GET body'});
  const token=bearerFrom(headers);
  if(!token)return respond(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{
   return respond(401,{error:'Session unavailable'});
  }
  if(!plain(user)||!UUID.test(user.id??'')||user.is_anonymous===true||
    !(typeof user.email_confirmed_at==='string'||
      typeof user.phone_confirmed_at==='string'))
   return respond(401,{error:'Confirmed passenger required'});
  try{
   if(await authorizePassenger(user.id)!==true)
    return respond(403,{error:'Passenger role required'});
  }catch{return respond(503,{error:'Authorization unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:'rider_history'})!==true)
    return respond(429,{error:'History polling limit exceeded'});
  }catch{return respond(503,{error:'History limiter unavailable'});}
  const at=now();
  if(!Number.isSafeInteger(at)||at<0||at>Number.MAX_SAFE_INTEGER-60000)
   return respond(503,{error:'Server clock invalid'});
  let items;
  try{items=await loadOwnHistory({ownerId:user.id,limit:51});}
  catch{return respond(503,{error:'History service unavailable'});}
  if(!Array.isArray(items)||items.length>50)
   return respond(503,{error:'History pagination unavailable'});
  const seen=new Set();
  for(const item of items){
   if(!plain(item)||Object.keys(item).length!==5||
     !UUID.test(item.serviceId??'')||seen.has(item.serviceId)||
     !kinds.has(item.kind)||!states.has(item.status)||
     !Number.isSafeInteger(item.createdAt)||item.createdAt<0||
     item.createdAt>at||!Number.isSafeInteger(item.revision)||
     item.revision<1)return respond(503,{error:'Invalid history snapshot'});
   seen.add(item.serviceId);
  }
  return respond(200,{
   ownerId:user.id,generatedAt:at,expiresAt:at+60000,
   items:items.map(({serviceId,kind,status,createdAt,revision})=>({
    serviceId,kind,status,createdAt,revision
   })),nextCursor:null
  });
 };
}
