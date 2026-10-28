/**
 * G58E / A45 — additional QA-only issuance fence (NOT production mint).
 * Reattests G42 session and exclusive DB role before AND after injecting
 * server-only synthetic ticket issuer. No user-supplied role/iat trusted.
 * The private mint function remains owner-only and is NEVER mounted to HTTP.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const id=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const names=Object.freeze({
 DRIVER_INBOX:{role:'driver',keys:['operation','actorId','sessionId','tokenIatMs']},
 DRIVER_HISTORY:{role:'driver',keys:['operation','actorId','sessionId','tokenIatMs','serviceKind','serviceId','conversationId']},
 DRIVER_MARK_VISIBLE:{role:'driver',keys:['operation','actorId','sessionId','tokenIatMs','conversationId']},
 CHAT_OPEN:{role:'passenger',keys:['operation','actorId','sessionId','tokenIatMs','serviceKind','serviceId','conversationId']},
 CHAT_HISTORY:{role:'passenger',keys:['operation','actorId','sessionId','tokenIatMs','serviceKind','serviceId','conversationId']},
 CHAT_READ:{role:'passenger',keys:['operation','actorId','sessionId','tokenIatMs','conversationId']}
});
export function createG58EAuditedQaTicketIssuer({
 environment,localQaOnly,liveEnabled,
 verifySessionNotRevoked,resolveExclusiveRole,issueSyntheticTicket,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||[verifySessionNotRevoked,resolveExclusiveRole,
   issueSyntheticTicket,now].some(f=>typeof f!=='function'))
  throw Error('G58E synthetic issuer must be server-only with independent G42 and role checks');
 return Object.freeze({async mintOwnerTicket(scope){
  const rule=names[scope?.operation];
  if(!rule||!exact(scope,rule.keys)||!id(scope.actorId)||!id(scope.sessionId)||
   !safe(scope.tokenIatMs)||scope.tokenIatMs===0)
   throw Error('G58E_INVALID_TICKET_SCOPE');
  if(Object.hasOwn(scope,'serviceKind')&&
   (!['RIDE','DELIVERY','MERCHANT_ORDER'].includes(scope.serviceKind)||
    !id(scope.serviceId)))
   throw Error('G58E_INVALID_SERVICE_SCOPE');
  if(Object.hasOwn(scope,'conversationId')&&
   !(scope.conversationId===null&&scope.operation==='CHAT_OPEN'||
    id(scope.conversationId)))
   throw Error('G58E_INVALID_CONVERSATION_SCOPE');
  const attested=async()=>{
   const at=now();
   if(!safe(at)||scope.tokenIatMs>at||
    await verifySessionNotRevoked({
     userId:scope.actorId,sessionId:scope.sessionId,at})!==true||
    await resolveExclusiveRole(scope.actorId)!==rule.role)
    throw Error('G58E_REVOKED_OR_WRONG_ROLE');
   return at;
  };
  const started=await attested();
  const result=await issueSyntheticTicket({...scope});
  const completed=await attested();
  if(completed<started||!exact(result,['ticket','operation','expiresAtMs','productionEnabled','qaOnly'])||
   !id(result.ticket)||result.operation!==scope.operation||
   result.productionEnabled!==false||result.qaOnly!==true||
   !safe(result.expiresAtMs)||result.expiresAtMs<=completed||
   result.expiresAtMs>completed+20000)
   throw Error('G58E_INVALID_ISSUED_CAPABILITY');
  return Object.freeze({...result});
 }});
}
