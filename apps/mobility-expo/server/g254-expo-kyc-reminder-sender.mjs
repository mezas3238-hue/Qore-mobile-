/**
 * G254: Expo transport for a generic, non-identifying Driver KYC reminder.
 * SERVER ONLY. No requests at import. No actual push unless a trusted
 * backend G254 worker explicitly invokes this sender after consent + SQL
 * current-attestation checks.
 *
 * Expo ticket = accepted for processing, NOT delivery or KYC approval.
 */
export const G254_EXPO_KYC_LIVE_ENABLED=false;
const URL='https://exp.host/--/api/v2/push/send';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{16,128}\]$/;
const TICKET=/^[A-Za-z0-9_-]{8,120}$/;
const TITLE='QORE · Documentación';
const BODY='Revisá tus documentos en la aplicación QORE Driver.';
const KIND='QORE_STAGING_KYC_REMINDER';
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===k.length&&k.every(s=>Object.hasOwn(x,s));
export function createG254ExpoKycReminderSender({
 request=fetch,environment,qaOnly,liveEnabled
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  typeof request!=='function')throw Error('G254_SECURE_STAGING_EXPO_REQUIRED');
 return async function sendGenericReminder({token,recipientDriverId,message}={}){
  if(!TOKEN.test(token??'')||!UUID.test(recipientDriverId??'')||
   !exact(message,['title','body','data'])||message.title!==TITLE||
   message.body!==BODY||!exact(message.data,['kind'])||
   message.data.kind!==KIND)
   throw Error('G254_UNVERIFIED_GENERIC_REMINDER');
  // Fixed allowlist: NEVER include identity, source doc, plate, GPS, dates
  // or incident description in third-party notification payload.
  const payload={to:token,title:TITLE,body:BODY,
   data:{kind:KIND},ttl:3600,priority:'normal'};
  let response;
  try{
   response=await request(URL,{method:'POST',redirect:'error',
    headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  }catch{throw Error('G254_EXPO_OUTCOME_UNKNOWN_NO_RETRY');}
  if(!response||response.ok!==true||response.status!==200||
   response.redirected===true||
   !/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))
   throw Error('G254_EXPO_UNTRUSTED_RESPONSE_NO_RETRY');
  let data;
  try{data=await response.json();}
  catch{throw Error('G254_EXPO_UNTRUSTED_RESPONSE_NO_RETRY');}
  if(!exact(data,['data'])||!exact(data.data,['status','id'])||
   data.data.status!=='ok'||!TICKET.test(data.data.id))
   throw Error('G254_EXPO_UNTRUSTED_TICKET_NO_RETRY');
  return Object.freeze({acceptedForProcessing:true,handsetDelivered:false,
   driverApproved:false,productionEnabled:false,
   providerTicketId:data.data.id});
 };
}
