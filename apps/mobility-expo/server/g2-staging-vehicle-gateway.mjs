/**
 * G2 STAGING gateway policy only. NEVER import into Expo client.
 * JWT MUST be verified remotely with Supabase Auth (auth.getUser(token)).
 * service_role can call SQL but must never be shipped to a handset.
 * Accepts only UNVERIFIED pending drafts; never creates rides or approvals.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_PROD_REF='qdqrlgzlotnfdxzpacxs';
const services={AUTO:new Set(['economico','confort','xl']),MOTO:new Set(['moto_pasajero'])};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=(o)=>o!==null && typeof o==='object' && !Array.isArray(o) &&
  (Object.getPrototypeOf(o)===Object.prototype || Object.getPrototypeOf(o)===null);
const exact=(o,keys)=>plain(o) &&
  Object.keys(o).length===keys.length && Object.keys(o).every(k=>keys.includes(k)) &&
  keys.every(k=>own(o,k));
const validYear=(x)=>Number.isSafeInteger(x)&&x>=1995&&x<=new Date().getUTCFullYear()+1;

export function assertStagingRef(ref) {
 if(typeof ref!=='string'||!(/^[a-z0-9]{12,30}$/.test(ref))||ref===PRIVATE_PROD_REF)
  throw new Error('A separate STAGING Supabase project is mandatory');
 return ref;
}
function eligibleIdentity(user) {
 return plain(user)&&typeof user.id==='string'&&UUID.test(user.id)&&
  user.is_anonymous!==true&&
  (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
}
function parseDraft(data) {
 const keys=['requestKey','kind','service','municipalityCode','plate','brand','model','year','passengerCapacity'];
 if(!exact(data,keys)||typeof data.requestKey!=='string'||!UUID.test(data.requestKey))
  return null;
 if(!own(services,data.kind)||typeof data.service!=='string'||!services[data.kind].has(data.service))
  return null;
 if(!(/^([A-Z0-9_-]{2,60})$/.test(data.municipalityCode))||
    !(/^[A-Z0-9-]{4,12}$/.test(data.plate))||
    typeof data.brand!=='string'||data.brand.length<2||data.brand.length>80||
    data.brand!==data.brand.trim()||
    typeof data.model!=='string'||data.model.length<1||data.model.length>80||
    data.model!==data.model.trim()||!validYear(data.year)||
    !Number.isSafeInteger(data.passengerCapacity)||data.passengerCapacity<1||data.passengerCapacity>8)
  return null;
 if(data.kind==='MOTO'&&data.passengerCapacity!==1)return null;
 if(data.kind==='AUTO'&&data.passengerCapacity<(data.service==='xl'?6:3))return null;
 return data;
}
function parseReview(data) {
 const keys=['requestKey','vehicleId','approve','reason'];
 if(!exact(data,keys)||typeof data.requestKey!=='string'||!UUID.test(data.requestKey)||
    typeof data.vehicleId!=='string'||!UUID.test(data.vehicleId)||
    typeof data.approve!=='boolean'||typeof data.reason!=='string'||
    data.reason.trim()!==data.reason||data.reason.length<12||data.reason.length>500)
  return null;
 return data;
}
const reply=(status,body)=>({status,body});
function accessToken(headers) {
 const h=headers?.authorization??headers?.Authorization;
 if(typeof h!=='string'||h.length>8192)return null;
 const match=/^Bearer ([A-Za-z0-9._~-]{20,8000})$/.exec(h);
 return match?.[1]??null;
}
export function createStagingVehicleGateway({projectRef,verifyAccessToken,submitDraft,reviewVehicle}) {
 assertStagingRef(projectRef);
 if(![verifyAccessToken,submitDraft,reviewVehicle].every(f=>typeof f==='function'))
  throw new Error('Server-only Auth and DB adapters are mandatory');
 return async function handle({method,path,headers,body}) {
  if(method!=='POST')return reply(405,{error:'Method not allowed'});
  const draftRoute=path==='/v1/staging/vehicle-applications';
  const reviewRoute=path==='/v1/staging/admin/vehicle-reviews';
  if(!draftRoute&&!reviewRoute)return reply(404,{error:'Not found'});
  const token=accessToken(headers);
  if(!token)return reply(401,{error:'Valid bearer session required'});
  const payload=draftRoute?parseDraft(body):parseReview(body);
  if(payload===null)return reply(400,{error:'Invalid or unsupported payload'});
  let user;
  try {user=await verifyAccessToken(token);}catch {return reply(401,{error:'Session verification failed'});}
  if(!eligibleIdentity(user))return reply(401,{error:'Verified and confirmed user required'});
  try {
   const id=draftRoute
     ? await submitDraft({
       _driver_id:user.id,_request_key:payload.requestKey,
       _kind:payload.kind,_service:payload.service,
       _municipality:payload.municipalityCode,_plate:payload.plate,
       _brand:payload.brand,_model:payload.model,
       _year:payload.year,_capacity:payload.passengerCapacity
      })
     : await reviewVehicle({
       _vehicle_id:payload.vehicleId,_reviewer_id:user.id,
       _approve:payload.approve,_reason:payload.reason,
       _request_key:payload.requestKey
      });
   if(typeof id!=='string'||!UUID.test(id))return reply(503,{error:'Database contract unavailable'});
   // Audit record != commercial authorization. Even approved AUTO is not a LIVE ride.
   return draftRoute
    ? reply(202,{applicationId:id,status:'pending',evidenceVerified:false,liveTripsEnabled:false})
    : reply(200,{auditId:id,commercialRidesEnabled:false});
  }catch {
   // Never echo SQL detail or storage paths to clients.
   return reply(409,{error:'Request rejected by staging compliance checks'});
  }
 };
}
