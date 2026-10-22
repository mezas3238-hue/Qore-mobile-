/** Authenticated G8 safety/operations API for isolated STAGING only. */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT='/v1/staging/safety/incidents/report';
const STATUS=/^\/v1\/staging\/safety\/incidents\/([0-9a-f-]{36})\/status$/i;
const TRANSITION=/^\/v1\/staging\/admin\/safety\/incidents\/([0-9a-f-]{36})\/transition$/i;
const APPLY='/v1/staging/admin/safety/suspensions/apply';
const LIFT=/^\/v1\/staging\/admin\/safety\/suspensions\/([0-9a-f-]{36})\/lift$/i;
const SUBJECTS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const CATEGORIES=new Set(['SOS','SAFETY','LOSS','DISPUTE','FRAUD','QUALITY']);
const SEVERITIES=new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
const ACTIONS=new Set(['triage','investigate','resolve','dismiss']);
const SCOPES=new Set(['DRIVER','BUYER','MERCHANT_STAFF']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const fields=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&
 names.every(name=>Object.hasOwn(value,name));
const reason=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{2,39}$/.test(value);
const tokenFrom=headers=>{
 const header=headers?.authorization??headers?.Authorization;
 return typeof header==='string'&&header.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(header)?.[1]??null:null;
};
const verified=user=>plain(user)&&UUID.test(user.id??'')&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
const reportBody=body=>fields(body,
 ['requestKey','subjectKind','subjectId','category','severity'])&&
 UUID.test(body.requestKey??'')&&SUBJECTS.has(body.subjectKind)&&
 UUID.test(body.subjectId??'')&&CATEGORIES.has(body.category)&&
 SEVERITIES.has(body.severity)&&(body.category!=='SOS'||body.severity==='CRITICAL');
const transitionBody=body=>fields(body,['event','reasonCode','eventKey'])&&
 ACTIONS.has(body.event)&&reason(body.reasonCode)&&UUID.test(body.eventKey??'');
const applyBody=body=>fields(body,
 ['targetUserId','scope','reasonCode','requestKey'])&&UUID.test(body.targetUserId??'')&&
 SCOPES.has(body.scope)&&reason(body.reasonCode)&&UUID.test(body.requestKey??'');
const liftBody=body=>fields(body,['reasonCode','eventKey'])&&
 reason(body.reasonCode)&&UUID.test(body.eventKey??'');
const response=(status,body)=>({status,body});

export function createQoreSafetyGateway({
 projectRef,verifyAccessToken,authorizeAdmin,allowRequest,
 reportIncident,transitionIncident,applySuspension,liftSuspension,loadIncident,
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeAdmin,allowRequest,reportIncident,
  transitionIncident,applySuspension,liftSuspension,loadIncident]
  .every(value=>typeof value==='function'))throw Error('Safety adapters required');
 return async({method,path,headers,body})=>{
  const report=method==='POST'&&path===REPORT;
  const status=method==='GET'&&typeof path==='string'?STATUS.exec(path):null;
  const transition=method==='POST'&&typeof path==='string'?TRANSITION.exec(path):null;
  const apply=method==='POST'&&path===APPLY;
  const lift=method==='POST'&&typeof path==='string'?LIFT.exec(path):null;
  if(!report&&!status&&!transition&&!apply&&!lift)return response(404,{error:'Not found'});
  if(report&&!reportBody(body))return response(400,{error:'Invalid safety report'});
  if(transition&&!transitionBody(body))
   return response(400,{error:'Invalid safety transition'});
  if(apply&&!applyBody(body))return response(400,{error:'Invalid suspension'});
  if(lift&&!liftBody(body))return response(400,{error:'Invalid suspension lift'});
  const bearer=tokenFrom(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return response(401,{error:'Session invalid'});}
  if(!verified(user))return response(401,{error:'Confirmed account required'});
  if(transition||apply||lift){
   try{
    if(await authorizeAdmin(user.id)!==true)
     return response(403,{error:'Admin role required'});
   }catch{return response(503,{error:'Safety authorization unavailable'});}
  }
  const operation=report?'incident_report':status?'incident_status':transition?
   'incident_'+body.event:apply?'suspension_apply':'suspension_lift';
  try{
   if(allowRequest({userId:user.id,operation})!==true)
    return response(429,{error:'Safety request limit reached'});
  }catch{return response(503,{error:'Request limiter unavailable'});}
  try{
   if(report){
    const result=await reportIncident({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.incidentId??''))throw Error('Invalid incident receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',externalResponseDispatched:false,
     incidentId:result.incidentId,status:'open',serverPersisted:true});
   }
   if(status){
    const result=await loadIncident({actorId:user.id,incidentId:status[1]});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !plain(result.incident)||result.incident.id!==status[1])
     throw Error('Invalid incident snapshot');
    return response(200,{mode:'STAGING_DEMO_ONLY',externalResponseDispatched:false,
     incident:result.incident,serverPersisted:true});
   }
   if(transition){
    const result=await transitionIncident({actorId:user.id,incidentId:transition[1],...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.eventId??''))throw Error('Invalid safety transition receipt');
    return response(200,{mode:'STAGING_DEMO_ONLY',incidentId:transition[1],
     event:body.event,eventId:result.eventId,serverPersisted:true});
   }
   if(apply){
    const result=await applySuspension({actorId:user.id,...body});
    if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
      !UUID.test(result.suspensionId??''))throw Error('Invalid suspension receipt');
    return response(201,{mode:'STAGING_DEMO_ONLY',suspensionId:result.suspensionId,
     active:true,serverPersisted:true});
   }
   const result=await liftSuspension({actorId:user.id,suspensionId:lift[1],...body});
   if(!plain(result)||result.ok!==true||result.liveEnabled!==false||
     !UUID.test(result.eventId??''))throw Error('Invalid suspension lift receipt');
   return response(200,{mode:'STAGING_DEMO_ONLY',suspensionId:lift[1],
    active:false,eventId:result.eventId,serverPersisted:true});
  }catch{return response(409,{error:'Safety operation rejected by persistent state'});}
 };
}
