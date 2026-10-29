/**
 * G192: one encrypted native pending G187 mutation per Passenger and action.
 * No token, phone, address, parcel, money or geographic data is persisted.
 * A write-ahead record MUST survive before sending the original POST.
 * A lost ACK is recovered exclusively through existing G190 read-only GET.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string'&&UUID.test(x);
const kinds=new Set(['bind','confirm']);
const keys=['version','subject','kind','deliveryId','requestKey','recipientId','createdAt'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
function validate(record){
 if(!plain(record)||Object.keys(record).length!==keys.length
  ||!keys.every(k=>Object.hasOwn(record,k))
  ||record.version!==1||!isUuid(record.subject)||!kinds.has(record.kind)
  ||!isUuid(record.deliveryId)||!isUuid(record.requestKey)
  ||!Number.isSafeInteger(record.createdAt)||record.createdAt<=0
  ||(record.kind==='bind'&&(!isUuid(record.recipientId)
    ||record.recipientId===record.subject))
  ||(record.kind==='confirm'&&record.recipientId!==null))
  throw Error('INVALID_G192_SECURE_JOURNAL');
 return Object.freeze({...record});
}
function nameFor(subject,kind){
 if(!isUuid(subject)||!kinds.has(kind))throw Error('INVALID_G192_SCOPE');
 // Keystore names are fixed and contain only opaque UUIDs.
 return 'movete-cliente-g192-'+kind+'-'+subject.toLowerCase();
}
export function createG192ReceiptKeyJournal({readSecure,writeSecure,
 deleteSecure,now=Date.now}={}){
 if([readSecure,writeSecure,deleteSecure,now].some(x=>typeof x!=='function'))
  throw Error('G192_NATIVE_KEYSTORE_REQUIRED');
 let tail=Promise.resolve();
 const serial=job=>{
  const result=tail.then(job);
  tail=result.then(()=>{},()=>{});
  return result;
 };
 const load=async key=>{
  const raw=await readSecure(key);
  if(raw===null)return null;
  if(typeof raw!=='string'||raw.length>350)throw Error('INVALID_G192_SECURE_JOURNAL');
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw Error('INVALID_G192_SECURE_JOURNAL');}
  return validate(parsed);
 };
 function scoped(row,subject,kind){
  if(row.subject!==subject.toLowerCase()||row.kind!==kind)
   throw Error('G192_JOURNAL_SCOPE_MISMATCH');
  return row;
 }
 return Object.freeze({
  read:(subject,kind)=>serial(async()=>{
   const key=nameFor(subject,kind),row=await load(key);
   return row?scoped(row,subject,kind):null;
  }),
  arm:({subject,kind,deliveryId,requestKey,recipientId=null}={})=>serial(async()=>{
   const key=nameFor(subject,kind);
   const record=validate({version:1,subject:subject?.toLowerCase(),
    kind,deliveryId:deliveryId?.toLowerCase(),
    requestKey:requestKey?.toLowerCase(),
    recipientId:recipientId===null?null:recipientId?.toLowerCase(),
    createdAt:now()});
   const prior=await load(key);
   if(prior)throw Error('G192_UNRESOLVED_ORIGINAL_KEY');
   const value=JSON.stringify(record);
   if(value.length>350)throw Error('INVALID_G192_SECURE_JOURNAL');
   await writeSecure(key,value);
   // Never POST merely because set() returned: prove the key is durable.
   const verified=await load(key);
   if(!verified||JSON.stringify(verified)!==value)
    throw Error('G192_DURABLE_WRITE_NOT_VERIFIED');
   return record;
  }),
  clearVerified:({subject,kind,deliveryId,requestKey,
   verifiedServerReceipt}={})=>serial(async()=>{
   // A POST receipt is NOT sufficient: only a separately verified sender GET
   // (recipientBound), or G190 recipient GET (same original confirmationId)
   // may release this local fence. Fail closed on lost/forged evidence.
   if(!isUuid(deliveryId)||!isUuid(requestKey)||
    !plain(verifiedServerReceipt)||
    verifiedServerReceipt.mode!=='STAGING_DEMO_ONLY'||
    verifiedServerReceipt.deliveryId!==deliveryId.toLowerCase()||
    verifiedServerReceipt.productionEnabled!==false||
    verifiedServerReceipt.qaOnly!==true||
    verifiedServerReceipt.paymentAuthorized!==false||
    !(kind==='bind'?
      verifiedServerReceipt.ownerId===subject?.toLowerCase()&&
       verifiedServerReceipt.recipientBound===true&&
       verifiedServerReceipt.bindingKey===requestKey.toLowerCase():
      kind==='confirm'?
       verifiedServerReceipt.recipientConfirmed===true&&
       verifiedServerReceipt.confirmationId===requestKey.toLowerCase():false))
    throw Error('G192_VERIFIED_SERVER_GET_REQUIRED');
   const key=nameFor(subject,kind),prior=await load(key);
   if(!prior)return false;
   scoped(prior,subject,kind);
   if(prior.deliveryId!==deliveryId.toLowerCase()
    ||prior.requestKey!==requestKey.toLowerCase())
    throw Error('G192_PENDING_KEY_MISMATCH');
   await deleteSecure(key);
   // If Keystore deletion is uncertain, leave caller fail closed.
   if(await load(key)!==null)throw Error('G192_DELETE_NOT_VERIFIED');
   return true;
  })
 });
}
