/**
 * R42: preferencia de contacto para incidencias de un pedido comercial.
 * SOLO RAM. Nunca comparte el chat de conductor ni realiza operaciones de red.
 * Una intención R40 revisada localmente NO prueba titularidad del pedido.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES=new Set(['LOSS','QUALITY','DISPUTE','SAFETY']);
const LEVELS=new Set(['LOW','MEDIUM','HIGH']);
const RECIPIENTS=new Set(['MERCHANT','SUPPORT']);
const fail=code=>Object.freeze({ok:false,code,localOnly:true,
 contactAttempted:false,caseCreated:false,merchantNotified:false,
 supportNotified:false,sendEnabled:false});
const actorOk=a=>a?.role==='passenger'
 &&typeof a.subject==='string'&&UUID.test(a.subject)
 &&Number.isSafeInteger(a.sessionRevision)&&a.sessionRevision>=0;
const intentOk=g=>g?.ok===true&&g.localOnly===true
 &&g.submitted===false&&g.caseCreated===false
 &&g.operatorNotified===false&&g.merchantContacted===false
 &&g.ownershipVerified===false&&g.sosDispatched===false
 &&g.intent?.subjectKind==='MERCHANT_ORDER'
 &&typeof g.intent.subjectId==='string'&&UUID.test(g.intent.subjectId)
 &&CATEGORIES.has(g.intent.category)&&LEVELS.has(g.intent.severity);
const scopedKey=(g,a)=>JSON.stringify([
 a.subject,a.sessionRevision,g.intent.subjectId,
 g.intent.category,g.intent.severity
]);

export function createMerchantContactPreference({now=()=>Date.now()}={}){
 let key=null,recipient=null,consent=false,createdAt=null,disposed=false;
 function clear(){
  key=null;recipient=null;consent=false;createdAt=null;
 }
 function ensure(g,a){
  if(disposed)return 'CONTACT_DRAFT_DISPOSED';
  if(!actorOk(a)){clear();return 'AUTH_REQUIRED';}
  if(!intentOk(g)){clear();return 'MERCHANT_GUIDE_NOT_REVIEWED';}
  const t=now(),scope=scopedKey(g,a);
  if(!Number.isSafeInteger(t)||t<0){clear();return 'INVALID_CLOCK';}
  if(key!==scope){clear();key=scope;createdAt=t;}
  // No renovar consentimiento a través de un TTL vencido.
  if(t<createdAt||t-createdAt>=600000){
   clear();return 'CONTACT_PREFERENCE_EXPIRED';
  }
  return null;
 }
 function snapshot(g,a){
  const error=ensure(g,a);
  if(error)return fail(error);
  const allowedMerchant=g.intent.category==='QUALITY'||g.intent.category==='LOSS';
  const allowed=recipient==='SUPPORT'
   ||recipient==='MERCHANT'&&allowedMerchant;
  if(!allowed){recipient=null;consent=false;}
  return Object.freeze({ok:true,recipient,consent,localOnly:true,
   allowedRecipients:Object.freeze(allowedMerchant?['MERCHANT','SUPPORT']:['SUPPORT']),
   readyToReview:Boolean(allowed&&consent),
   contactAttempted:false,caseCreated:false,merchantNotified:false,
   supportNotified:false,sendEnabled:false,channelAuthorized:false,
   messageStored:false,serverConsentRecorded:false});
 }
 function choose(g,a,nextRecipient){
  const error=ensure(g,a);if(error)return fail(error);
  if(!RECIPIENTS.has(nextRecipient))return fail('INVALID_RECIPIENT');
  if(nextRecipient==='MERCHANT'&&!['QUALITY','LOSS'].includes(g.intent.category))
   return fail('MERCHANT_CONTACT_NOT_ALLOWED_FOR_CATEGORY');
  if(recipient!==nextRecipient)consent=false;
  recipient=nextRecipient;
  return snapshot(g,a);
 }
 function setConsent(g,a,value){
  const error=ensure(g,a);if(error)return fail(error);
  if(typeof value!=='boolean')return fail('INVALID_CONSENT');
  if(value&&!recipient)return fail('RECIPIENT_REQUIRED');
  consent=value;
  return snapshot(g,a);
 }
 function review(g,a){
  const current=snapshot(g,a);
  if(!current.ok)return current;
  if(!current.readyToReview)return fail('CONSENT_OR_RECIPIENT_REQUIRED');
  return Object.freeze({ok:true,recipient,mode:'IN_APP_ONLY',
   localOnly:true,consentToPrepare:true,orderId:g.intent.subjectId,
   category:g.intent.category,severity:g.intent.severity,
   ownershipVerified:false,channelAuthorized:false,
   contactAttempted:false,caseCreated:false,merchantNotified:false,
   supportNotified:false,sendEnabled:false,messageStored:false,
   serverConsentRecorded:false,submitted:false});
 }
 function dispose(){clear();disposed=true;}
 return Object.freeze({snapshot,choose,setConsent,review,clear,dispose});
}
