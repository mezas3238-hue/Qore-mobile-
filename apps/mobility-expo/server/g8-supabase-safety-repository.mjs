/** Server-only G8 safety and operations persistence adapter. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECTS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const CATEGORIES=new Set(['SOS','SAFETY','LOSS','DISPUTE','FRAUD','QUALITY']);
const SEVERITIES=new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
const STATUSES=new Set(['open','triaged','investigating','resolved','dismissed']);
const ACTIONS=new Set(['triage','investigate','resolve','dismiss']);
const SCOPES=new Set(['DRIVER','BUYER','MERCHANT_STAFF']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&UUID.test(value);
const reason=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{2,39}$/.test(value);
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
function assertClient(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only safety persistence client required');
}
function assertBase(params){
 if(!plain(params)||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||
   !id(params.actorId))throw Error('Invalid staging safety input');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!id(data))throw Error('Staging safety RPC rejected');
 return data;
}
function safeIncident(row,incidentId,actorId){
 if(!plain(row)||row.id!==incidentId||row.reporter_id!==actorId||
   !SUBJECTS.has(row.subject_kind)||!id(row.subject_id)||
   !CATEGORIES.has(row.category)||!SEVERITIES.has(row.severity)||
   !STATUSES.has(row.status)||!Number.isSafeInteger(row.revision)||row.revision<1||
   (row.category==='SOS'&&row.severity!=='CRITICAL'))
  throw Error('Malformed safety incident');
 return Object.freeze({id:row.id,subjectKind:row.subject_kind,subjectId:row.subject_id,
  category:row.category,severity:row.severity,status:row.status,
  revision:row.revision,createdAt:row.created_at,changedAt:row.changed_at});
}
export const SUPABASE_SAFETY_LIVE_ENABLED=false;
export function createSupabaseStagingSafetyRepository(client){
 assertClient(client);
 return Object.freeze({
  async report(params){
   assertBase(params);
   if(!id(params.requestKey)||!SUBJECTS.has(params.subjectKind)||!id(params.subjectId)||
     !CATEGORIES.has(params.category)||!SEVERITIES.has(params.severity)||
     (params.category==='SOS'&&params.severity!=='CRITICAL'))
    throw Error('Invalid safety report');
   const incidentId=await rpc(client,'mobility_stage_safety_report',{
    _reporter_id:params.actorId,_request_key:params.requestKey,
    _subject_kind:params.subjectKind,_subject_id:params.subjectId,
    _category:params.category,_severity:params.severity,
   });
   return ok({incidentId});
  },
  async transition(params){
   assertBase(params);
   if(!id(params.incidentId)||!ACTIONS.has(params.event)||
     !reason(params.reasonCode)||!id(params.eventKey))
    throw Error('Invalid safety transition');
   const eventId=await rpc(client,'mobility_stage_safety_transition',{
    _incident_id:params.incidentId,_admin_id:params.actorId,_action:params.event,
    _reason_code:params.reasonCode,_request_key:params.eventKey,
   });
   return ok({eventId});
  },
  async applySuspension(params){
   assertBase(params);
   if(!id(params.targetUserId)||!SCOPES.has(params.scope)||
     !reason(params.reasonCode)||!id(params.requestKey))
    throw Error('Invalid operational suspension');
   const suspensionId=await rpc(client,'mobility_stage_suspension_apply',{
    _subject_user_id:params.targetUserId,_scope:params.scope,
    _admin_id:params.actorId,_reason_code:params.reasonCode,
    _request_key:params.requestKey,
   });
   return ok({suspensionId});
  },
  async liftSuspension(params){
   assertBase(params);
   if(!id(params.suspensionId)||!reason(params.reasonCode)||!id(params.eventKey))
    throw Error('Invalid suspension lift');
   const eventId=await rpc(client,'mobility_stage_suspension_lift',{
    _suspension_id:params.suspensionId,_admin_id:params.actorId,
    _reason_code:params.reasonCode,_request_key:params.eventKey,
   });
   return ok({eventId});
  },
  async incidentSnapshot(params){
   assertBase(params);
   if(!id(params.incidentId))throw Error('Invalid incident snapshot');
   const {data,error}=await client.from('mobility_stage_safety_incidents')
    .select('id,reporter_id,subject_kind,subject_id,category,severity,status,revision,created_at,changed_at')
    .eq('id',params.incidentId).eq('reporter_id',params.actorId).maybeSingle();
   if(error||!data)throw Error('Safety incident unavailable');
   return ok({incident:safeIncident(data,params.incidentId,params.actorId)});
  },
 });
}
