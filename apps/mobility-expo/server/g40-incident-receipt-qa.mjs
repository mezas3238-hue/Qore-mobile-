/**
 * G40 passenger incident receipt & owner status contract.
 * Transport-free QA adapter; NOT a live safety hotline, SOS or 911.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const CATEGORY=new Set(['SAFETY','LOSS','DISPUTE','FRAUD','QUALITY']);
const SEVERITY=new Set(['LOW','MEDIUM','HIGH']);
const STATES=new Set(['open','triaged','investigating','resolved','dismissed']);
const KEYS=['incidentId','receiptId','state','revision','createdAt',
 'observedAt','receiptStatus'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||
   Object.getPrototypeOf(v)===null);
const id=v=>typeof v==='string'&&UUID.test(v);
const response=(status,body)=>Object.freeze({status,body:Object.freeze(body)});
const failure=(status,code)=>response(status,{code});
function safeDto(dto){
 return plain(dto)&&Object.keys(dto).length===KEYS.length&&
  KEYS.every(k=>Object.hasOwn(dto,k))&&id(dto.incidentId)&&id(dto.receiptId)&&
  STATES.has(dto.state)&&Number.isSafeInteger(dto.revision)&&dto.revision>=1&&
  typeof dto.createdAt==='string'&&Number.isFinite(Date.parse(dto.createdAt))&&
  typeof dto.observedAt==='string'&&Number.isFinite(Date.parse(dto.observedAt))&&
  Date.parse(dto.observedAt)>=Date.parse(dto.createdAt)&&
  dto.receiptStatus==='RECEIVED_IN_QA_DATABASE_ONLY';
}
export function createG40IncidentReceiptQa({
 environment,liveEnabled,localQaOnly,verifyAccessToken,
 verifySessionNotRevoked,allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true||
  ![verifyAccessToken,verifySessionNotRevoked,allowRequest,rpc,now]
   .every(f=>typeof f==='function'))
  throw Error('G40 trusted JWT/revocation/DB adapters and isolated QA required');
 async function authorized(bearer,operation){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
    !/^[A-Za-z0-9._~-]+$/.test(bearer))
   return {error:failure(401,'JWT_REQUIRED')};
  const t=now();
  if(!Number.isSafeInteger(t)||t<0)
   return {error:failure(503,'CLOCK_UNAVAILABLE')};
  let user;
  try{user=await verifyAccessToken(bearer);}
  catch{return {error:failure(401,'SESSION_UNVERIFIED')};}
  if(!plain(user)||!id(user.id)||user.is_anonymous===true||
    typeof user.sessionId!=='string'||user.sessionId.length<8||
    user.sessionId.length>128||!Number.isSafeInteger(user.expiresAtMs)||
    user.expiresAtMs<=t)return {error:failure(401,'SESSION_UNVERIFIED')};
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at:t
   })!==true)return {error:failure(401,'SESSION_REVOKED')};
  }catch{return {error:failure(503,'REVOCATION_UNAVAILABLE')};}
  try{
   if(allowRequest({userId:user.id,operation})!==true)
    return {error:failure(429,'RATE_LIMITED')};
  }catch{return {error:failure(503,'RATE_LIMIT_UNAVAILABLE')};}
  return {user};
 }
 return Object.freeze({
  async report({bearer,requestKey,subjectKind,subjectId,category,severity}={}){
   if(!id(requestKey)||!id(subjectId)||!SUBJECT.has(subjectKind)||
     !CATEGORY.has(category)||!SEVERITY.has(severity))
    return failure(400,'INVALID_INCIDENT_REQUEST_OR_UNCERTIFIED_SOS');
   const auth=await authorized(bearer,'incident.report');
   if(auth.error)return auth.error;
   let result;
   try{result=await rpc('mobility_stage_g40_report_receipt',{
    _reporter:auth.user.id,_request_key:requestKey,
    _subject_kind:subjectKind,_subject_id:subjectId,
    _category:category,_severity:severity
   });}catch(e){
    if(e?.code==='G4009')return failure(409,'IDEMPOTENCY_CONFLICT');
    return failure(503,'INCIDENT_WRITE_UNAVAILABLE');
   }
   if(result?.error?.code==='G4009')
    return failure(409,'IDEMPOTENCY_CONFLICT');
   if(result?.error)return failure(503,'INCIDENT_WRITE_UNAVAILABLE');
   if(!safeDto(result?.data))return failure(503,'INVALID_RECEIPT_SOURCE');
   return response(201,{...result.data});
  },
  async ownStatus({bearer,incidentId}={}){
   if(!id(incidentId))return failure(400,'INVALID_INCIDENT_ID');
   const auth=await authorized(bearer,'incident.status');
   if(auth.error)return auth.error;
   let result;
   try{result=await rpc('mobility_stage_g40_owner_incident_status',{
    _reporter:auth.user.id,_incident_id:incidentId
   });}catch{return failure(503,'INCIDENT_READ_UNAVAILABLE');}
   if(result?.error)return failure(503,'INCIDENT_READ_UNAVAILABLE');
   if(result?.data===null)return failure(404,'INCIDENT_NOT_FOUND');
   if(!safeDto(result?.data)||result.data.incidentId!==incidentId)
    return failure(503,'INVALID_RECEIPT_SOURCE');
   return response(200,{...result.data});
  }
 });
}
