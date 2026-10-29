/**
 * G189 MOTO restart recovery: IdP session, PostgreSQL active-only GET,
 * independent original G169 GET, rechecked IdP; no stored booking/offer.
 * Never auto-accept and never continue a foreign/stale/terminal journey.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const ACTIVE=new Set(['accepted','arriving','in_progress']);
const identity=s=>s?.role==='driver'&&ID.test(s.userId??'')
 &&TOKEN.test(s.accessToken??'');
const same=(a,b)=>identity(a)&&identity(b)
 &&a.userId===b.userId&&a.accessToken===b.accessToken;
export async function recoverOriginalDriverMoto({
 getSession,readCurrent,openOriginal
}={}){
 if([getSession,readCurrent,openOriginal].some(x=>typeof x!=='function'))
  return Object.freeze({ok:false,reason:'MOTO_NOT_CONFIGURED'});
 let first;
 try{first=await getSession();}catch{}
 if(!identity(first))return Object.freeze({ok:false,reason:'MOTO_UNVERIFIED'});
 let found;
 try{found=await readCurrent({accessToken:first.accessToken});}
 catch{return Object.freeze({ok:false,reason:'MOTO_UNVERIFIED'});}
 let second;
 try{second=await getSession();}catch{}
 if(!same(first,second))return Object.freeze({ok:false,reason:'MOTO_UNVERIFIED'});
 if(found===null)return Object.freeze({ok:false,reason:'MOTO_NONE'});
 if(!found||!ID.test(found.bookingKey??'')||!ID.test(found.tripId??'')||
  !ACTIVE.has(found.status)||!Number.isSafeInteger(found.revision)||
  found.revision<2||found.qaOnly!==true||
  found.productionEnabled!==false)
  return Object.freeze({ok:false,reason:'MOTO_UNVERIFIED'});
 let opened;
 try{opened=await openOriginal(found.bookingKey);}catch{}
 let third;
 try{third=await getSession();}catch{}
 if(!same(first,third)||!opened||opened.bookingKey!==found.bookingKey||
  opened.tripId!==found.tripId||opened.phase!=='active'||
  !ACTIVE.has(opened.status)||!Number.isSafeInteger(opened.revision)||
  opened.revision<found.revision||opened.qaOnly!==true||
  opened.productionEnabled!==false)
  return Object.freeze({ok:false,reason:'MOTO_UNVERIFIED'});
 return Object.freeze({ok:true,bookingKey:found.bookingKey,
  tripId:found.tripId,qaOnly:true,productionEnabled:false});
}
