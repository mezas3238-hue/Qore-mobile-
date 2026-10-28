/** Offline hint for resuming a previously verified courier delivery.
 * A hint is NOT authorization: each recovery uses a new owner-scoped G66 GET.
 * Never persist bearer, address, phone, proof, price or customer identity.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const KEY='movete-driver-active-delivery-hint-v1';
const MAX_AGE=7*24*60*60*1000;
const ACTIVE=new Set(['accepted','picked_up','disputed']);
const TERMINAL=new Set(['delivered','returned','cancelled']);
const fail=code=>Object.freeze({ok:false,code});
const sessionOK=s=>s?.role==='driver'&&UUID.test(s.userId??'')
 &&typeof s.accessToken==='string'&&TOKEN.test(s.accessToken);
const same=(a,b)=>sessionOK(b)&&a.userId===b.userId
 &&a.accessToken===b.accessToken;
const proofOK=(p,id)=>p?.ok===true&&p.deliveryId===id
 &&Number.isSafeInteger(p.revision)&&p.revision>=2
 &&p.qaOnly===true&&p.productionEnabled===false
 &&(ACTIVE.has(p.status)||TERMINAL.has(p.status));
const storageOK=s=>s&&typeof s.get==='function'
 &&typeof s.put==='function'&&typeof s.del==='function';
export const DRIVER_DELIVERY_RESUME_LIVE_ENABLED=false;
export function createDriverDeliveryResume({getSession,readAssignment,
 storage=null,now=Date.now}={}){
 if(typeof getSession!=='function'||typeof readAssignment!=='function'
  ||typeof now!=='function'||(storage!==null&&!storageOK(storage)))
  throw Error('Driver recovery requires private G66 and verified Auth');
 let busy=false;
 const erase=async()=>{try{await storage?.del(KEY);}catch{/* fail closed */}};
 async function auth(){try{const s=await getSession();return sessionOK(s)?s:null;}
 catch{return null;}}
 async function verify(id,actor){
  try{const p=await readAssignment(id,actor);return proofOK(p,id)?p:null;}
  catch{return null;}
 }
 async function locked(operation){
  if(busy)return fail('RECOVERY_IN_FLIGHT');
  busy=true;try{return await operation();}finally{busy=false;}
 }
 async function remember(id){
  return locked(async()=>{
   if(!UUID.test(id??''))return fail('INVALID_DELIVERY_ID');
   const before=await auth();
   if(!before)return fail('DRIVER_AUTH_REQUIRED');
   const proof=await verify(id,before);
   const after=await auth();
   if(!same(before,after))return fail('DRIVER_SESSION_CHANGED');
   if(!proof)return fail('CUSTODY_NOT_VERIFIED');
   if(!ACTIVE.has(proof.status)){
    await erase();return fail('DELIVERY_NOT_ACTIVE');
   }
   if(!storageOK(storage))return Object.freeze({ok:true,deliveryId:id,saved:false});
   let saved=false;
   try{
    await storage.put(KEY,JSON.stringify({version:1,actorId:before.userId,
     deliveryId:id,savedAt:now()}));
    saved=true;
   }catch{/* An unavailable OS keychain must not invent successful recovery. */}
   const latest=await auth();
   if(!same(before,latest)){
    await erase();return fail('DRIVER_SESSION_CHANGED');
   }
   return Object.freeze({ok:true,deliveryId:id,saved});
  });
 }
 async function resume(){
  return locked(async()=>{
   if(!storageOK(storage))return fail('RECOVERY_STORAGE_NOT_AVAILABLE');
   const before=await auth();
   if(!before)return fail('DRIVER_AUTH_REQUIRED');
   let raw;
   try{raw=await storage.get(KEY);}catch{return fail('RECOVERY_STORAGE_NOT_AVAILABLE');}
   if(raw===null||raw===undefined)return fail('NO_REMEMBERED_DELIVERY');
   let saved;
   try{saved=JSON.parse(raw);}catch{await erase();return fail('INVALID_DELIVERY_HINT');}
   const at=now();
   if(!saved||Object.keys(saved).length!==4||saved.version!==1
    ||!UUID.test(saved.actorId??'')||!UUID.test(saved.deliveryId??'')
    ||!Number.isSafeInteger(saved.savedAt)
    ||saved.savedAt>at||at-saved.savedAt>MAX_AGE){
    await erase();return fail('INVALID_DELIVERY_HINT');
   }
   if(saved.actorId!==before.userId){
    await erase();return fail('OTHER_DRIVER_DELIVERY');
   }
   const proof=await verify(saved.deliveryId,before);
   const after=await auth();
   if(!same(before,after))return fail('DRIVER_SESSION_CHANGED');
   if(!proof)return fail('CUSTODY_NOT_VERIFIED');
   if(TERMINAL.has(proof.status)){
    await erase();return fail('DELIVERY_NOT_ACTIVE');
   }
   return Object.freeze({ok:true,deliveryId:saved.deliveryId,
    status:proof.status,revision:proof.revision});
  });
 }
 return Object.freeze({remember,resume,clear:erase});
}
