/**
 * B19: one unresolved G5 delivery key per account, never a second POST after
 * crash. The secure store owns only UUIDs/time, server G121 owns the facts.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=code=>Object.freeze({ok:false,code});
const safeRecord=(r,owner,now)=>object(r)
 &&Object.keys(r).length===4
 &&['version','ownerId','requestKey','createdAt'].every(x=>Object.hasOwn(r,x))
 &&r.version===1&&r.ownerId===owner&&UUID.test(r.ownerId)
 &&UUID.test(r.requestKey)&&Number.isSafeInteger(r.createdAt)
 &&r.createdAt>0&&r.createdAt<=now+60000;
export function createG5DurableDeliveryRecovery({store=null,now=Date.now}={}){
 const hasStore=store!==null&&['read','write','clear'].every(
  key=>typeof store[key]==='function');
 let state={phase:hasStore?'unread':'unsupported',owner:null,requestKey:null};
 let epoch=0;
 function clearMemory(){
  epoch++;state={phase:hasStore?'unread':'unsupported',owner:null,requestKey:null};
 }
 function snapshot(owner){
  const relevant=state.owner===owner;
  return Object.freeze({
   storeReady:hasStore,
   phase:relevant?state.phase:hasStore?'unread':'unsupported',
   unresolved:relevant&&state.phase==='unresolved',
   blocked:!hasStore||state.phase==='unread'||state.phase==='reading'
    ||state.phase==='storage_failed'||state.phase==='writing'
    ||state.phase==='unresolved',
   requestKey:relevant&&state.phase==='unresolved'?state.requestKey:null,
   productionEnabled:false
  });
 }
 async function restore(owner){
  if(!hasStore)return fail('G5_SECURE_STORE_REQUIRED');
  if(!UUID.test(owner??''))return fail('INVALID_OWNER_SCOPE');
  if(['reading','writing'].includes(state.phase))return fail('RECOVERY_BUSY');
  const seq=++epoch;state={phase:'reading',owner,requestKey:null};
  let row;
  try{row=await store.read(owner);}
  catch{
   if(seq===epoch)state={phase:'storage_failed',owner,requestKey:null};
   return fail('G5_SECURE_RECOVERY_UNAVAILABLE');
  }
  if(seq!==epoch)return fail('STALE_RECOVERY');
  if(row===null){
   state={phase:'clear',owner,requestKey:null};
   return Object.freeze({ok:true,restored:false});
  }
  if(!safeRecord(row,owner,now())){
   state={phase:'storage_failed',owner,requestKey:null};
   return fail('G5_INVALID_SAVED_KEY');
  }
  state={phase:'unresolved',owner,requestKey:row.requestKey};
  return Object.freeze({ok:true,restored:true,requestKey:row.requestKey});
 }
 async function persist(owner,requestKey){
  if(!hasStore)return fail('G5_SECURE_STORE_REQUIRED');
  if(!UUID.test(owner??'')||!UUID.test(requestKey??''))
   return fail('INVALID_DELIVERY_KEY');
  if(state.owner!==owner||state.phase!=='clear')
   return fail('G5_UNRESOLVED_DELIVERY_PRESENT');
  const seq=++epoch;
  state={phase:'writing',owner,requestKey:null};
  const record=Object.freeze({version:1,ownerId:owner,requestKey,createdAt:now()});
  try{await store.write(record);}catch{
   if(seq===epoch)state={phase:'storage_failed',owner,requestKey:null};
   return fail('G5_SECURE_SAVE_FAILED_NO_POST');
  }
  if(seq!==epoch)return fail('STALE_RECOVERY');
  state={phase:'unresolved',owner,requestKey};
  return Object.freeze({ok:true,requestKey,protectedBeforePost:true});
 }
 return Object.freeze({isConfigured:()=>hasStore,restore,persist,snapshot,clearMemory});
}
