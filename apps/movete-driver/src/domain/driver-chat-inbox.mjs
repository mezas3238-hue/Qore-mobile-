/** G56C Driver chat inbox mobile controller (unmounted until trusted gateway).
 * No demo data, no bearer in UI snapshots, no storage, no sends.
 * Fail-closed on account changes, stale/ambiguous response and network loss.
 */
export const DRIVER_CHAT_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const ROW=['conversationId','serviceId','serviceKind','counterpartRole','state','assignmentVerified','canSend','revision','unreadCount','updatedAt'];
const PAGE=['ownerId','revision','generatedAt','expiresAt','items','nextCursor','productionEnabled','qaOnly'];
const older=(a,b)=>a.updatedAt<b.updatedAt||(a.updatedAt===b.updatedAt&&a.conversationId<b.conversationId);
const initial=()=>Object.freeze({phase:'signed-out',conversations:Object.freeze([]),
 hasMore:false,expiresAt:0,productionEnabled:false,qaOnly:true});
function project(data,actor,now,limit){
 if(!exact(data,PAGE)||data.ownerId!==actor||
  !safe(data.revision)||data.revision<1||
  !safe(data.generatedAt)||data.generatedAt>now||
  !safe(data.expiresAt)||data.expiresAt<=now||data.expiresAt>now+60000||
  data.productionEnabled!==false||data.qaOnly!==true||
  !Array.isArray(data.items)||data.items.length>limit||
  !(data.nextCursor===null||(typeof data.nextCursor==='string'&&data.nextCursor.length<=2048)))
  throw Error('Untrusted private chat inbox');
 const seen=new Set(),service=new Set(),rows=[];
 for(const raw of data.items){
  if(!exact(raw,ROW)||!uuid(raw.conversationId)||!uuid(raw.serviceId)||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(raw.serviceKind)||
   raw.counterpartRole!=='passenger'||raw.state!=='ACTIVE'||
   raw.assignmentVerified!==true||raw.canSend!==true||
   !safe(raw.revision)||raw.revision<1||
   !safe(raw.unreadCount)||!safe(raw.updatedAt)||raw.updatedAt>now||
   seen.has(raw.conversationId)||service.has(raw.serviceKind+':'+raw.serviceId)||
   (rows.length>0&&!older(raw,rows.at(-1))))
   throw Error('Invalid Driver chat row');
  seen.add(raw.conversationId);service.add(raw.serviceKind+':'+raw.serviceId);
  rows.push(Object.freeze({...raw}));
 }
 if(data.nextCursor!==null&&rows.length===0)throw Error('Invalid empty page cursor');
 return {rows,revision:data.revision,expiresAt:data.expiresAt,
  nextCursor:data.nextCursor};
}
export function createDriverChatInboxController({
 readPage,now=Date.now,liveEnabled=false,pageSize=50
}={}){
 if(typeof readPage!=='function'||typeof now!=='function'||
  liveEnabled!==false||!Number.isSafeInteger(pageSize)||
  pageSize<1||pageSize>100)
  throw Error('Driver chat requires disabled LIVE and authorized page adapter');
 let identity=null,epoch=0,cursor=null,revision=null;
 let state=initial();
 const listeners=new Set();
 function publish(next){
  state=Object.freeze({...next,conversations:Object.freeze([...next.conversations]),
   productionEnabled:false,qaOnly:true});
  for(const subscriber of [...listeners])try{subscriber(state);}catch{/* isolation */}
  return state;
 }
 function purge(phase='signed-out'){
  epoch++;identity=null;cursor=null;revision=null;
  return publish({phase,conversations:[],hasMore:false,expiresAt:0});
 }
 function failClosed(phase='offline'){
  epoch++;cursor=null;revision=null;
  return publish({phase,conversations:[],hasMore:false,expiresAt:0});
 }
 async function fetchPage(reset){
  if(identity===null)return state;
  if(!reset&&(state.phase!=='connected'||cursor===null))return state;
  if(!reset&&state.expiresAt<=now())return failClosed('offline');
  const currentEpoch=++epoch;
  const linked=identity;
  const seek=reset?null:cursor;
  const previous=state.conversations;
  const previousRevision=revision;
  publish({phase:reset?'loading':'loading-more',
   conversations:reset?[]:previous,
   hasMore:!reset&&cursor!==null,expiresAt:reset?0:state.expiresAt});
  try{
   const response=await readPage({bearer:linked.accessToken,cursor:seek,limit:pageSize});
   if(currentEpoch!==epoch)return state;
   if(!plain(response)||response.status!==200)
    throw Error('Unavailable or unauthorised Driver inbox');
   const loaded=project(response.body,linked.userId,now(),pageSize);
   if(!reset&&loaded.revision!==previousRevision)throw Error('Stale revision');
   if(!reset&&previous.length>0&&loaded.rows.length>0&&
    !older(loaded.rows[0],previous.at(-1)))
    throw Error('Reordered Driver inbox');
   const combined=reset?loaded.rows:[...previous,...loaded.rows];
   const seen=new Set(),services=new Set();
   for(const item of combined){
    const srv=item.serviceKind+':'+item.serviceId;
    if(seen.has(item.conversationId)||services.has(srv))
     throw Error('Rotated/duplicated Driver thread in mixed pages');
    seen.add(item.conversationId);services.add(srv);
   }
   cursor=loaded.nextCursor;revision=loaded.revision;
   return publish({phase:'connected',conversations:combined,
    hasMore:cursor!==null,expiresAt:loaded.expiresAt});
  }catch{
   if(currentEpoch!==epoch)return state;
   return failClosed('offline');
  }
 }
 return Object.freeze({
  current:()=>state,
  subscribe(listener){
   if(typeof listener!=='function')throw Error('Driver chat subscriber required');
   listeners.add(listener);return ()=>{listeners.delete(listener);};
  },
  setSession(session){
   purge('signed-out');
   if(session===null||session===undefined)return state;
   if(!plain(session)||session.role!=='driver'||!uuid(session.userId)||
    typeof session.accessToken!=='string'||!TOKEN.test(session.accessToken))
    return publish({phase:'authorization-required',conversations:[],hasMore:false,expiresAt:0});
   identity={userId:session.userId,accessToken:session.accessToken};
   return publish({phase:'ready',conversations:[],hasMore:false,expiresAt:0});
  },
  clear:()=>purge(),
  invalidate:()=>failClosed('offline'),
  refresh:()=>fetchPage(true),
  loadMore:()=>fetchPage(false),
  tick(){
   if(['connected','loading-more'].includes(state.phase)&&state.expiresAt<=now())
    return failClosed('offline');
   return state;
  }
 });
}
