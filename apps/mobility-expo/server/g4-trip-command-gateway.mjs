/**
 * Authenticated trip command API for isolated STAGING.
 *
 * Passenger: create an AUTO demo request and cancel its own active trip.
 * Driver: mark arriving, pickup/in-progress and completion.
 * The actor always comes from server-verified Auth; identity fields are not
 * accepted in the payload. Database RPCs remain the state authority.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST='/v1/staging/rider/trips/request';
const TRANSITION=/^\/v1\/staging\/trips\/([0-9a-f-]{36})\/transition$/i;
const RIDER_CANCEL=/^\/v1\/staging\/rider\/trips\/([0-9a-f-]{36})\/cancel$/i;
const DRIVER_EVENTS=new Set(['arrive','pickup','complete']);
const SERVICES=new Set(['economico','confort','xl']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const tokenFrom=headers=>{
 const header=headers?.authorization??headers?.Authorization;
 return typeof header==='string'&&header.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(header)?.[1]??null:null;
};
const verified=user=>plain(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const requestBody=body=>fields(body,
 ['requestKey','originTag','destinationTag','service'])&&
 UUID.test(body.requestKey??'')&&/^[A-Z_]{3,40}$/.test(body.originTag??'')&&
 /^[A-Z_]{3,40}$/.test(body.destinationTag??'')&&
 body.originTag!==body.destinationTag&&SERVICES.has(body.service);
const transitionBody=body=>fields(body,['event','eventKey'])&&
 UUID.test(body.eventKey??'')&&
 (DRIVER_EVENTS.has(body.event)||body.event==='cancel');
const cancelBody=body=>fields(body,['requestKey'])&&UUID.test(body.requestKey??'');
const response=(status,body)=>({status,body});

export function createQoreTripCommandGateway({
 projectRef,verifyAccessToken,resolveRole,requestTrip,transitionTrip,allowRequest,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,resolveRole,requestTrip,transitionTrip,allowRequest]
  .every(value=>typeof value==='function'))
  throw Error('Authenticated trip command adapters required');
 return async({method,path,headers,body})=>{
  const create=method==='POST'&&path===REQUEST;
  const found=method==='POST'&&typeof path==='string'?TRANSITION.exec(path):null;
  const cancel=method==='POST'&&typeof path==='string'?RIDER_CANCEL.exec(path):null;
  if(!create&&!found&&!cancel)return response(404,{error:'Not found'});
  if(create&&!requestBody(body))return response(400,{error:'Invalid trip request'});
  if(found&&!transitionBody(body))return response(400,{error:'Invalid trip transition'});
  if(cancel&&!cancelBody(body))return response(400,{error:'Invalid passenger cancellation'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{
   return response(401,{error:'Session invalid'});
  }
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  let role;
  try{role=await resolveRole(user.id);}catch{
   return response(503,{error:'Role verification unavailable'});
  }
  if(role!=='passenger'&&role!=='driver')
   return response(403,{error:'Single passenger or driver role required'});
  if((create||cancel)&&role!=='passenger')return response(403,{error:'Passenger role required'});
  if(found&&((body.event==='cancel'&&role!=='passenger')||
    (DRIVER_EVENTS.has(body.event)&&role!=='driver')))
   return response(403,{error:'Role cannot perform transition'});
  try{
   if(allowRequest({
    userId:user.id,operation:create?'trip_request':cancel?'trip_cancel':'trip_'+body.event,
   })!==true)return response(429,{error:'Trip command limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  try{
   if(create){
    const result=await requestTrip({
     actorId:user.id,requestKey:body.requestKey,
     originTag:body.originTag,destinationTag:body.destinationTag,
     service:body.service,
    });
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.tripId??''))throw Error('Invalid trip receipt');
    return response(201,{
     mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
     tripId:result.tripId,status:'searching',serverPersisted:true,
    });
   }
   const tripId=cancel?.[1]??found[1];
   const event=cancel?'cancel':body.event;
   const eventKey=cancel?body.requestKey:body.eventKey;
   const result=await transitionTrip({
    actorId:user.id,tripId,event,eventKey,
   });
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !UUID.test(result.eventId??''))throw Error('Invalid transition receipt');
   return response(200,{
    mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
    tripId,event,eventId:result.eventId,
    serverPersisted:true,
   });
  }catch{
   return response(409,{error:'Trip command rejected by persistent state'});
  }
 };
}
