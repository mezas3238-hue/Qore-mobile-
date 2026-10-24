/**
 * G60A Driver messenger — QA-only composition over G56B/G57B/G59B.
 * Deliberately NO real HTTP, no account persistence, no LIVE and no push.
 * The app keeps bearer, cursors, requestKey and visibility tickets in closure.
 */
import {createDriverChatInboxController} from './driver-chat-inbox.mjs';

export const DRIVER_MESSAGING_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole','body','createdAt','revision','serverStored'];
const PAGE=['conversationId','serviceId','serviceKind','ownerId','counterpartRole',
 'assignmentVerified','state','revision','generatedAt','expiresAt',
 'messages','nextCursor','canSend','productionEnabled','qaOnly'];
const MESSAGE=['messageId','senderRole','body','createdAt','revision'];
const MARKER=['marker','messageId','expiresAtMs'];
const ENVELOPE=['page','readMarkers','qaOnly','productionEnabled'];
const RECOVERY=['state','ack','latestRevision','historyRefreshRequired',
 'qaOnly','productionEnabled','retrySafe'];
const clean=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&new TextEncoder().encode(x).length<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
const init=()=>({phase:'signed-out',conversations:[],hasMore:false,
 conversation:null,messages:[],hasOlder:false,sendState:'idle',
 latestRevision:0,lastConfirmedId:null,readConfirmedIds:[],
 canCompose:false,qaOnly:true,productionEnabled:false});
export function createDriverMessagingController({
 readInbox,readHistory,send,reconcile,markVisible,makeRequestKey,
 verifyStopped,now=Date.now,liveEnabled=false
}={}){
 if(liveEnabled!==false||[readInbox,readHistory,send,reconcile,markVisible,
   makeRequestKey,verifyStopped,now].some(fn=>typeof fn!=='function'))
  throw Error('G60 Driver messaging requires seven trusted QA functions and no LIVE');
 const inbox=createDriverChatInboxController({readPage:readInbox,now,liveEnabled:false});
 let identity=null,generation=0,room=null,cursor=null,pending=null;
 let marks=new Map(),seenKeys=new Set(),inflight=false;
 let snapshot=Object.freeze(init());
 const listeners=new Set();
 function publish(data){
  snapshot=Object.freeze({...data,conversations:Object.freeze([...data.conversations]),
   messages:Object.freeze(data.messages.map(m=>Object.freeze({...m}))),
   readConfirmedIds:Object.freeze([...data.readConfirmedIds]),
   qaOnly:true,productionEnabled:false});
  for(const listener of [...listeners])try{listener(snapshot);}catch{/*no credentials*/ }
  return snapshot;
 }
 function reset(phase='signed-out'){
  generation++;identity=null;room=null;cursor=null;pending=null;inflight=false;
  marks.clear();seenKeys.clear();inbox.clear();
  return publish({...init(),phase});
 }
 function failure(phase='offline'){
  generation++;room=null;cursor=null;pending=null;inflight=false;
  marks.clear();inbox.invalidate();
  return publish({...init(),phase});
 }
 function rowCheck(m,at){
  return exact(m,MESSAGE)&&id(m.messageId)&&
   ['passenger','driver'].includes(m.senderRole)&&clean(m.body)&&
   safe(m.createdAt)&&m.createdAt<=at&&safe(m.revision)&&m.revision>=2;
 }
 function checkPage(response,selected,at,oldCursor){
  const body=response?.body;
  if(response?.status!==200||!exact(body,ENVELOPE)||
    body.qaOnly!==true||body.productionEnabled!==false||
    !exact(body.page,PAGE)||!Array.isArray(body.readMarkers))throw Error('Untrusted G57B envelope');
  const p=body.page;
  if(p.conversationId!==selected.conversationId||
    p.serviceId!==selected.serviceId||p.serviceKind!==selected.serviceKind||
    p.ownerId!==identity.userId||p.counterpartRole!=='passenger'||
    p.assignmentVerified!==true||p.state!=='ACTIVE'||p.canSend!==true||
    p.qaOnly!==true||p.productionEnabled!==false||
    !safe(p.revision)||p.revision<1||!safe(p.generatedAt)||p.generatedAt>at||
    !safe(p.expiresAt)||p.expiresAt<=at||p.expiresAt>at+60000||
    !Array.isArray(p.messages)||p.messages.length>50||
    !(p.nextCursor===null||(typeof p.nextCursor==='string'&&p.nextCursor.length<=2048))||
    (oldCursor!==null&&p.revision!==snapshot.latestRevision))
    throw Error('Foreign or stale Driver history');
  let previous=Infinity;
  const incoming=new Set(),ids=new Set();
  for(const m of p.messages){
   if(!rowCheck(m,at)||ids.has(m.messageId)||m.revision>=previous)
    throw Error('Forged or unordered chat messages');
   ids.add(m.messageId);previous=m.revision;
   if(m.senderRole==='passenger')incoming.add(m.messageId);
  }
  if(body.readMarkers.length!==incoming.size)throw Error('Missing Driver visibility markers');
  const issued=new Map();
  for(const m of body.readMarkers){
   if(!exact(m,MARKER)||!id(m.marker)||!id(m.messageId)||
    !incoming.has(m.messageId)||issued.has(m.messageId)||
    !safe(m.expiresAtMs)||m.expiresAtMs<=at||m.expiresAtMs>at+60000)
    throw Error('Untrusted G57B marker');
   issued.set(m.messageId,{marker:m.marker,expiresAtMs:m.expiresAtMs});
  }
  return {page:p,issued};
 }
 function safeAck(ack,key,body,at){
  return exact(ack,ACK)&&room!==null&&
   ack.conversationId===room.conversationId&&
   ack.serviceId===room.serviceId&&ack.requestKey===key&&
   ack.senderRole==='driver'&&ack.body===body&&id(ack.messageId)&&
   safe(ack.createdAt)&&ack.createdAt<=at&&safe(ack.revision)&&
   ack.revision>=2&&ack.serverStored===true;
 }
 async function loadPage(older=false){
  if(!identity||!room||inflight||pending)return snapshot;
  if(older&&(cursor===null||snapshot.phase!=='connected'))return snapshot;
  const nonce=++generation,selected=room,requested=older?cursor:null;
  const previous=snapshot;
  inflight=true;
  publish({...snapshot,phase:'loading',canCompose:false});
  try{
   const response=await readHistory({bearer:identity.accessToken,
    serviceKind:selected.serviceKind,serviceId:selected.serviceId,
    conversationId:selected.conversationId,cursor:requested,limit:50});
   if(nonce!==generation)return snapshot;
   const at=now();
   const {page,issued}=checkPage(response,selected,at,requested);
   const rows=page.messages;
   if(older&&previous.messages.length>0&&rows.length>0&&
    rows[0].revision>=previous.messages.at(-1).revision)
    throw Error('Mixed out-of-order history pages');
   const combined=older?[...previous.messages,...rows]:rows;
   if(new Set(combined.map(m=>m.messageId)).size!==combined.length)
    throw Error('Repeated Driver history');
   cursor=page.nextCursor;
   marks=older?new Map([...marks,...issued]):issued;
   const projected=combined.map(m=>({...m,canConfirmRead:m.senderRole==='passenger'&&
    marks.has(m.messageId)&&marks.get(m.messageId).expiresAtMs>at}));
   return publish({...snapshot,phase:'connected',messages:projected,
    latestRevision:page.revision,hasOlder:cursor!==null,
    canCompose:true,sendState:'idle'});
  }catch{
   if(nonce!==generation)return snapshot;
   return failure();
  }finally{
   if(nonce===generation)inflight=false;
  }
 }
 const session=(data)=>{
  reset();
  if(data===null||data===undefined)return snapshot;
  if(!plain(data)||data.role!=='driver'||!id(data.userId)||
   typeof data.accessToken!=='string'||!TOKEN.test(data.accessToken))
   return publish({...init(),phase:'authorization-required'});
  identity={userId:data.userId,accessToken:data.accessToken};
  inbox.setSession(data);
  return publish({...init(),phase:'ready'});
 };
 return Object.freeze({
  current:()=>snapshot,
  subscribe(fn){if(typeof fn!=='function')throw Error('Listener required');
   listeners.add(fn);return ()=>listeners.delete(fn);},
  setSession:session,
  clear:()=>reset(),
  invalidate:()=>failure(),
  async refreshInbox(){
   if(!identity)return snapshot;
   const nonce=++generation;
   room=null;cursor=null;pending=null;marks.clear();
   publish({...init(),phase:'loading'});
   await inbox.refresh();
   if(nonce!==generation)return snapshot;
   const state=inbox.current();
   if(state.phase!=='connected')return failure(state.phase==='authorization-required'?
    'authorization-required':'offline');
   return publish({...init(),phase:'inbox',conversations:state.conversations,
    hasMore:state.hasMore});
  },
  async loadMoreInbox(){
   if(!identity||snapshot.phase!=='inbox'||!snapshot.hasMore)return snapshot;
   const nonce=generation;
   await inbox.loadMore();
   if(nonce!==generation)return snapshot;
   if(inbox.current().phase!=='connected')return failure();
   return publish({...snapshot,conversations:inbox.current().conversations,
    hasMore:inbox.current().hasMore});
  },
  async open(conversationId){
   if(!identity||!id(conversationId)||inflight||pending)return snapshot;
   const match=inbox.current().conversations.find(r=>r.conversationId===conversationId);
   if(!match||match.state!=='ACTIVE'||match.assignmentVerified!==true)return snapshot;
   generation++;room={conversationId,serviceId:match.serviceId,
    serviceKind:match.serviceKind};
   cursor=null;marks.clear();pending=null;
   publish({...init(),phase:'loading',conversations:inbox.current().conversations,
    conversation:{...room}});
   return loadPage();
  },
  loadOlder:()=>loadPage(true),
  backToInbox(){
   generation++;room=null;cursor=null;marks.clear();pending=null;
   const state=inbox.current();
   return publish({...init(),phase:state.phase==='connected'?'inbox':'offline',
    conversations:state.phase==='connected'?state.conversations:[],
    hasMore:state.phase==='connected'&&state.hasMore});
  },
  async sendMessage(body){
   if(!identity||!room||snapshot.phase!=='connected'||
    !snapshot.canCompose||inflight||pending||!clean(body))return snapshot;
   const nonce=++generation,selected=room;
   inflight=true;
   publish({...snapshot,phase:'sending',sendState:'sending',canCompose:false});
   let key;
   try{
    const safety=await verifyStopped();
    if(nonce!==generation)return snapshot;
    if(!exact(safety,['vehicleStopped','source','observedAtMs'])||
      safety.vehicleStopped!==true||safety.source!=='trusted_navigation'||
      !safe(safety.observedAtMs)||safety.observedAtMs>now()||
      now()-safety.observedAtMs>5000)
      throw Error('Driving state not certified');
    key=await makeRequestKey();
    if(!id(key)||seenKeys.has(key))throw Error('Request key not unique');
    seenKeys.add(key);
    // Freeze the original requestKey and body until reconciled.
    pending={key,body,conversation:selected};
    const result=await send({bearer:identity.accessToken,...selected,
     requestKey:key,body});
    if(nonce!==generation)return snapshot;
    if(result?.status===200&&safeAck(result.body,key,body,now())){
     pending=null;
     return publish({...snapshot,phase:'connected',sendState:'confirmed',
      canCompose:true,lastConfirmedId:result.body.messageId});
    }
    // Even a rejected, timed-out or malformed response might follow COMMIT.
    // Never automatically resend; caller must explicitly reconcile.
    return publish({...snapshot,phase:'uncertain',sendState:'uncertain',canCompose:false});
   }catch{
    if(nonce!==generation)return snapshot;
    if(pending)return publish({...snapshot,phase:'uncertain',sendState:'uncertain',canCompose:false});
    return publish({...snapshot,phase:'connected',sendState:'blocked',canCompose:true});
   }finally{if(nonce===generation)inflight=false;}
  },
  async reconcilePending(){
   if(!identity||!pending||!room||snapshot.phase!=='uncertain'||inflight)
    return snapshot;
   const nonce=++generation,original=pending;
   inflight=true;
   try{
    const result=await reconcile({bearer:identity.accessToken,
     ...original.conversation,requestKey:original.key,body:original.body});
    if(nonce!==generation)return snapshot;
    const at=now(),data=result?.body;
    if(result?.status===200&&exact(data,RECOVERY)&&
      data.state==='COMMITTED'&&data.qaOnly===true&&
      data.productionEnabled===false&&data.retrySafe===false&&
      safeAck(data.ack,original.key,original.body,at)&&
      safe(data.latestRevision)&&data.latestRevision>=data.ack.revision&&
      data.historyRefreshRequired===(data.latestRevision>data.ack.revision)){
     pending=null;
     return publish({...snapshot,phase:'connected',sendState:'confirmed',
      canCompose:true,lastConfirmedId:data.ack.messageId,
      latestRevision:data.latestRevision});
    }
    // 503, 401, 409, or forged 200: keep original request and block resend.
    return snapshot;
   }catch{return snapshot;}
   finally{if(nonce===generation)inflight=false;}
  },
  async confirmVisible(messageId){
   if(!identity||!room||snapshot.phase!=='connected'||inflight||
    !id(messageId))return snapshot;
   const row=snapshot.messages.find(m=>m.messageId===messageId);
   const mark=marks.get(messageId);
   if(!row||row.senderRole!=='passenger'||!mark||
    mark.expiresAtMs<=now())return snapshot;
   const nonce=++generation,selected=room;
   inflight=true;
   try{
    // Called ONLY from explicit on-screen user interaction. No auto-ACK on
    // fetch, background, push or accidental render.
    const result=await markVisible({bearer:identity.accessToken,
     conversationId:selected.conversationId,messageId,marker:mark.marker});
    if(nonce!==generation)return snapshot;
    if(result?.status!==200||
      !exact(result.body,['conversationId','messageId','readConfirmed','qaOnly'])||
      result.body.conversationId!==selected.conversationId||
      result.body.messageId!==messageId||result.body.readConfirmed!==true||
      result.body.qaOnly!==true)return snapshot;
    marks.delete(messageId);
    return publish({...snapshot,readConfirmedIds:[
     ...new Set([...snapshot.readConfirmedIds,messageId])],
     messages:snapshot.messages.map(m=>m.messageId===messageId?
      {...m,canConfirmRead:false}:m)});
   }catch{return snapshot;}
   finally{if(nonce===generation)inflight=false;}
  }
 });
}
