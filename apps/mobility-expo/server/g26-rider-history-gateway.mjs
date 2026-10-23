/**
 * G26.1 — every own historic record can be retrieved page-by-page.
 * A signed opaque cursor is bound to the authenticated JWT subject; it carries
 * the (time,id,kind) keyset and original server clock anchor. No global cap.
 * Read-only / STAGING QA / no LIVE or externally reachable listener.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
import {HISTORY_PAGE_SIZE} from './g26-rider-history-repository.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH='/v1/staging/rider/history';
const kindNames=['RIDE','DELIVERY','MERCHANT_ORDER'];
const kinds=new Set(kindNames);
const states=new Set(['searching','assigned','in_progress','completed','cancelled','failed']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const respond=(status,body)=>({status,body});
const lifetimeMs=600000; // renewed on every page; not a total history limit
const uuid=x=>typeof x==='string'&&UUID.test(x);
const bearerFrom=h=>{
 const v=h?.authorization??h?.Authorization;
 return typeof v==='string'&&v.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(v)?.[1]??null:null;
};
function cursorCodec(secret,projectRef){
 const mac=(data,userId)=>createHmac('sha256',secret)
  .update('qore-own-history-v1\0').update(projectRef)
  .update('\0').update(userId).update('\0').update(data).digest();
 return {
  encode({anchorMs,position,userId,at}){
   const payload=Buffer.from(JSON.stringify([
    1,anchorMs,position.time,position.id.replaceAll('-',''),
    kindNames.indexOf(position.kind),at+lifetimeMs
   ])).toString('base64url');
   const base='v1.'+payload;
   const result=base+'.'+mac(base,userId).toString('base64url');
   if(result.length>200)throw Error('History cursor exceeds public DTO');
   return result;
  },
  decode(value,userId,at){
   if(typeof value!=='string'||value.length>200||
     !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value))
    return null;
   const dot=value.lastIndexOf('.');
   const base=value.slice(0,dot),sig=Buffer.from(value.slice(dot+1),'base64url');
   const expected=mac(base,userId);
   if(sig.length!==expected.length||!timingSafeEqual(sig,expected))
    return null;
   try{
    const fields=JSON.parse(Buffer.from(base.slice(3),'base64url').toString('utf8'));
    if(!Array.isArray(fields)||fields.length!==6||fields[0]!==1||
      !Number.isSafeInteger(fields[1])||fields[1]<0||fields[1]>at||
      typeof fields[2]!=='string'||fields[2].length>35||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(fields[2])||
      typeof fields[3]!=='string'||!/^[0-9a-f]{32}$/i.test(fields[3])||
      !Number.isInteger(fields[4])||fields[4]<0||fields[4]>=kindNames.length||
      !Number.isSafeInteger(fields[5])||fields[5]<=at||
      fields[5]>at+lifetimeMs)return null;
    const hex=fields[3];
    const id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),
     hex.slice(16,20),hex.slice(20)].join('-');
    return {anchorMs:fields[1],after:{time:fields[2],id,kind:kindNames[fields[4]]}};
   }catch{return null;}
  }
 };
}
export function createQoreRiderHistoryGateway({
 projectRef,verifyAccessToken,authorizePassenger,allowRequest,loadOwnHistory,
 cursorSecret,now=Date.now
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,allowRequest,loadOwnHistory,now]
  .every(x=>typeof x==='function')||
  typeof cursorSecret!=='string'||cursorSecret.length<32)
  throw Error('Verified private history and signing adapters required');
 const codec=cursorCodec(cursorSecret,projectRef);
 return async({method,path,headers,body})=>{
  if(method!=='GET'||path!==PATH)return respond(404,{error:'Not found'});
  if(body!==null&&body!==undefined)return respond(400,{error:'No GET body'});
  const token=bearerFrom(headers);
  if(!token)return respond(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{
   return respond(401,{error:'Session unavailable'});
  }
  if(!plain(user)||!uuid(user.id)||user.is_anonymous===true||
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
  if(!Number.isSafeInteger(at)||at<0||at>Number.MAX_SAFE_INTEGER-lifetimeMs)
   return respond(503,{error:'Server clock invalid'});
  const supplied=headers?.['x-qore-history-cursor']??headers?.['X-Qore-History-Cursor'];
  const continuation=supplied===undefined?null:codec.decode(supplied,user.id,at);
  if(supplied!==undefined&&continuation===null)
   return respond(400,{error:'History cursor invalid or expired'});
  let page;
  try{page=await loadOwnHistory({
   ownerId:user.id,anchorMs:continuation?.anchorMs??at,
   after:continuation?.after??null
  });}catch{return respond(503,{error:'History service unavailable'});}
  const items=page?.items,position=page?.nextPosition;
  if(!Array.isArray(items)||items.length>HISTORY_PAGE_SIZE||
    !(position===null||plain(position))||
    position!==null&&items.length!==HISTORY_PAGE_SIZE)
   return respond(503,{error:'History page invalid'});
  const seen=new Set();
  for(const item of items){
   if(!plain(item)||Object.keys(item).length!==5||
     !uuid(item.serviceId)||seen.has(item.serviceId)||
     !kinds.has(item.kind)||!states.has(item.status)||
     !Number.isSafeInteger(item.createdAt)||item.createdAt<0||
     item.createdAt>at||!Number.isSafeInteger(item.revision)||
     item.revision<1)return respond(503,{error:'Invalid history snapshot'});
   seen.add(item.serviceId);
  }
  if(position!==null&&(typeof position.time!=='string'||
    !uuid(position.id)||!kinds.has(position.kind)||
    position.id!==items.at(-1)?.serviceId||
    position.kind!==items.at(-1)?.kind))
   return respond(503,{error:'History position mismatch'});
  let nextCursor=null;
  try{
   if(position!==null)nextCursor=codec.encode({
    anchorMs:continuation?.anchorMs??at,position,userId:user.id,at
   });
  }catch{return respond(503,{error:'History signing unavailable'});}
  return respond(200,{
   ownerId:user.id,generatedAt:at,expiresAt:at+60000,
   items:items.map(({serviceId,kind,status,createdAt,revision})=>({
    serviceId,kind,status,createdAt,revision
   })),nextCursor
  });
 };
}
