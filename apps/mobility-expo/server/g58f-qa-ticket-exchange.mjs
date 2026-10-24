/**
 * G58F/A46: private QA-only adapter for synthetic owner-attested SQL exchange.
 * A verified server-side provider context is REQUIRED; no HTTP mint route,
 * no client identity/role/iat, no live credentials, and no production opt-in.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string'&&UUID.test(x);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const OPS=Object.freeze({
 CHAT_OPEN:{role:'passenger',fields:['operation','serviceKind','serviceId','conversationId']},
 CHAT_HISTORY:{role:'passenger',fields:['operation','serviceKind','serviceId','conversationId']},
 CHAT_INBOX:{role:'passenger',fields:['operation']},
 CHAT_READ:{role:'passenger',fields:['operation','conversationId']},
 DRIVER_INBOX:{role:'driver',fields:['operation']},
 DRIVER_HISTORY:{role:'driver',fields:['operation','serviceKind','serviceId','conversationId']},
 DRIVER_MARK_VISIBLE:{role:'driver',fields:['operation','conversationId']}
});
const safe=x=>Number.isSafeInteger(x)&&x>0;

export function createG58FQaTicketExchange({
 environment,localQaOnly,productionEnabled,
 verifyPinnedSession,seedOwnerAttestation,exchangeInTransaction,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
    productionEnabled!==false||
    [verifyPinnedSession,seedOwnerAttestation,exchangeInTransaction,now]
    .some(f=>typeof f!=='function'))
  throw Error('G58F_DISABLED_NO_TRUSTED_QA_PROVIDER_CHAIN');
 return Object.freeze({async mintForServerVerifiedJwt({jwt,scope}={}){
  if(typeof jwt!=='string'||jwt.length<12||jwt.length>16000)
   throw Error('G58F_JWT_REQUIRED');
  const rule=OPS[scope?.operation];
  if(!rule||!exact(scope,rule.fields)||
    Object.hasOwn(scope,'actorId')||Object.hasOwn(scope,'role')||
    Object.hasOwn(scope,'tokenIatMs')||Object.hasOwn(scope,'sessionId'))
   throw Error('G58F_FORGED_SCOPE');
  if(Object.hasOwn(scope,'serviceKind')&&
    (!['RIDE','DELIVERY','MERCHANT_ORDER'].includes(scope.serviceKind)||
     !isUuid(scope.serviceId)))
   throw Error('G58F_INVALID_SERVICE');
  if(Object.hasOwn(scope,'conversationId')&&
    (scope.operation==='CHAT_OPEN'?
      scope.conversationId!==null:!isUuid(scope.conversationId)))
   throw Error('G58F_INVALID_CONVERSATION');
  const verified=await verifyPinnedSession(jwt);
  if(!exact(verified,['actorId','sessionId','tokenIatMs','role',
      'providerPinVerified','sessionActive'])||
     !isUuid(verified.actorId)||!isUuid(verified.sessionId)||
     !safe(verified.tokenIatMs)||verified.tokenIatMs>now()||
     verified.role!==rule.role||verified.providerPinVerified!==true||
     verified.sessionActive!==true)
   throw Error('G58F_UNTRUSTED_PROVIDER_SESSION');
  // In QA the attestation seed is an owner-only fixture. It is not a JWT
  // issuer, not a remotely mounted endpoint, and never uses client claims.
  const seeded=await seedOwnerAttestation(Object.freeze({
   actorId:verified.actorId,sessionId:verified.sessionId,
   tokenIatMs:verified.tokenIatMs,...scope
  }));
  if(!exact(seeded,['attestation'])||!isUuid(seeded.attestation))
   throw Error('G58F_UNTRUSTED_OWNER_ATTESTATION');
  const result=await exchangeInTransaction(seeded.attestation);
  const at=now();
  if(!exact(result,['ticket','operation','expiresAtMs','productionEnabled','qaOnly'])||
     !isUuid(result.ticket)||result.operation!==scope.operation||
     !safe(result.expiresAtMs)||result.expiresAtMs<=at||
     result.expiresAtMs>at+20000||
     result.productionEnabled!==false||result.qaOnly!==true)
   throw Error('G58F_UNSAFE_DELEGATED_TICKET');
  return Object.freeze({...result});
 }});
}
