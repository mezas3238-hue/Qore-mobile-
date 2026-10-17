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
function parsePendingStage(data) {
 const keys=['requestKey','applicationId'];
 if(!exact(data,keys)||typeof data.requestKey!=='string'||!UUID.test(data.requestKey)||
    typeof data.applicationId!=='string'||!UUID.test(data.applicationId))
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
/**
 * Bounded, fail-closed per-identity staging limiter. No IPs, tokens or PII stored.
 * Sliding windows are anchored per actor/operation. Global saturation DENIES
 * new identities rather than evicting limits for an existing attacker.
 * Not a distributed/cloud rate limiter: external deployment needs Redis/WAF.
 */
export function createStagingRateLimiter({
 now=Date.now,windowMs=60_000,maxEntries=1024,
 draftLimit=4,adminLimit=6
}={}) {
 if(typeof now!=='function'||![windowMs,maxEntries,draftLimit,adminLimit]
   .every(n=>Number.isSafeInteger(n)&&n>0)||
   windowMs>3_600_000||maxEntries>100_000||draftLimit>100||adminLimit>100)
  throw new Error('Invalid staging rate limit policy');
 const entries=new Map();
 return function allow({userId,operation}) {
  if(typeof userId!=='string'||!UUID.test(userId)||
     !['draft','review','stage'].includes(operation))return false;
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)return false;
  const key=operation+':'+userId.toLowerCase();
  for(const [k,v] of entries)if(at>=v.until)entries.delete(k);
  const prior=entries.get(key);
  if(prior){
   if(at<prior.started)return false; // time rollback
   if(prior.count>= (operation==='draft'?draftLimit:adminLimit))return false;
   prior.count++;
   return true;
  }
  if(entries.size>=maxEntries)return false;
  entries.set(key,{started:at,until:at+windowMs,count:1});
  return true;
 };
}

export function createStagingVehicleGateway({
 projectRef,verifyAccessToken,submitDraft,reviewVehicle,stagePending,
 authorizeAdmin,allowRequest
}) {
 assertStagingRef(projectRef);
 if(![verifyAccessToken,submitDraft,reviewVehicle,authorizeAdmin,allowRequest]
  .every(f=>typeof f==='function'))
  throw new Error('Server-only Auth and DB adapters are mandatory');
 return async function handle({method,path,headers,body}) {
  if(method!=='POST')return reply(405,{error:'Method not allowed'});
  const draftRoute=path==='/v1/staging/vehicle-applications';
  const reviewRoute=path==='/v1/staging/admin/vehicle-reviews';
  const stagingRoute=path==='/v1/staging/admin/materialize-pending';
  if(!draftRoute&&!reviewRoute&&!stagingRoute)return reply(404,{error:'Not found'});
  const token=accessToken(headers);
  if(!token)return reply(401,{error:'Valid bearer session required'});
  const payload=draftRoute?parseDraft(body):reviewRoute?parseReview(body):parsePendingStage(body);
  if(payload===null)return reply(400,{error:'Invalid or unsupported payload'});
  let user;
  try {user=await verifyAccessToken(token);}catch {return reply(401,{error:'Session verification failed'});}
  if(!eligibleIdentity(user))return reply(401,{error:'Verified and confirmed user required'});
  // All identities and roles are obtained on the SERVER, never from JSON.
  const operation=draftRoute?'draft':reviewRoute?'review':'stage';
  try {
   if(allowRequest({userId:user.id,operation})!==true)
    return reply(429,{error:'Staging request rate limit exceeded'});
  }catch{return reply(503,{error:'Staging rate limiter unavailable'});}
  if(!draftRoute){
   let authorized=false;
   try { authorized=await authorizeAdmin(user.id); }
   catch {return reply(503,{error:'Admin verification unavailable'});}
   if(authorized!==true)return reply(403,{error:'Administrator permission required'});
  }
  try {
   const id=draftRoute
     ? await submitDraft({
       _driver_id:user.id,_request_key:payload.requestKey,
       _kind:payload.kind,_service:payload.service,
       _municipality:payload.municipalityCode,_plate:payload.plate,
       _brand:payload.brand,_model:payload.model,
       _year:payload.year,_capacity:payload.passengerCapacity
      })
     : reviewRoute
       ? await reviewVehicle({
         _vehicle_id:payload.vehicleId,_reviewer_id:user.id,
         _approve:payload.approve,_reason:payload.reason,
         _request_key:payload.requestKey
        })
       : typeof stagePending==='function'
         ? await stagePending({
           _application_id:payload.applicationId,
           _reviewer_id:user.id,_request_key:payload.requestKey
          })
         : null;
   if(typeof id!=='string'||!UUID.test(id))return reply(503,{error:'Database contract unavailable'});
   // Audit record != commercial authorization. Even approved AUTO is not a LIVE ride.
   return draftRoute
    ? reply(202,{applicationId:id,status:'pending',evidenceVerified:false,liveTripsEnabled:false})
    : reviewRoute
      ? reply(200,{auditId:id,commercialRidesEnabled:false})
      : reply(202,{vehicleId:id,status:'pending',evidenceVerified:false,commercialRidesEnabled:false});
  }catch {
   // Never echo SQL detail or storage paths to clients.
   return reply(409,{error:'Request rejected by staging compliance checks'});
  }
 };
}
