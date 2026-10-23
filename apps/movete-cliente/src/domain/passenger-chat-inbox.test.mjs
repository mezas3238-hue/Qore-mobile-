import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerChatInbox} from './passenger-chat-inbox.mjs';
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2);
const actor=()=>({role:'passenger',subject:owner,sessionRevision:3});
const row=n=>({conversationId:id(n+100),serviceId:id(n+500),
 serviceKind:n%3===0?'RIDE':n%3===1?'DELIVERY':'MERCHANT_ORDER',
 state:'ACTIVE',assignmentVerified:true,counterpartRole:'driver',
 revision:9,unreadCount:n%20,updatedAt:now-1000-n,canSend:true});
const page=(items=[row(1)],nextCursor=null)=>({ownerId:owner,
 generatedAt:now-2000,expiresAt:now+60000,revision:9,items,nextCursor,
 productionEnabled:false});
const flags=overrides=>({enabled:true,contractCertified:true,
 stagingRuntimeVerified:true,isConfigured:()=>true,
 readInbox:async()=>({ok:true,data:page()}),...overrides});
const make=(gateway=flags(),getActor=async()=>actor(),nowFn=()=>now)=>
 createPassengerChatInbox({gateway,getActor,now:nowFn});
test('no hay red sin certificación real de bandeja',async()=>{
 let hits=0;
 const inbox=make(flags({stagingRuntimeVerified:false,
  readInbox:async()=>{hits++;return {ok:true,data:page()};}}));
 assert.equal(inbox.snapshot().readReady,false);
 assert.equal((await inbox.load()).code,'CHAT_INBOX_CONTRACT_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('solo conversaciones activas del pasajero, sin cuerpo ni número de Driver',async()=>{
 const inbox=make();
 assert.equal((await inbox.load()).ok,true);
 const v=inbox.snapshot();
 assert.equal(v.items.length,1);
 assert.equal(v.items[0].serviceKind,'DELIVERY');
 assert.equal(v.phoneNumbersExposed,false);
 assert.equal(v.messageBodiesExposed,false);
 assert.equal(v.globalTotalKnown,false);
});
test('DTO falso, con PII, cierre de servicio o ownership distinto falla cerrado',async()=>{
 for(const bad of [
  {...page(),ownerId:other},
  {...page(),driverPhone:'0981123456'},
  {...page(),productionEnabled:true},
  {...page(),items:[{...row(1),lastMessageBody:'privado'}]},
  {...page(),items:[{...row(1),state:'CANCELLED'}]},
  {...page(),items:[{...row(1),assignmentVerified:false}]},
  {...page(),items:[{...row(1),counterpartRole:'passenger'}]},
  {...page(),items:[{...row(1),canSend:false}]},
  {...page(),items:[{...row(1),unreadCount:-1}]},
  {...page(),items:[{...row(1),unreadCount:Number.MAX_SAFE_INTEGER+1}]},
  {...page(),expiresAt:now-1},
  {...page(),nextCursor:'../../driver'},
 ]){
  const inbox=make(flags({readInbox:async()=>({ok:true,data:bad})}));
  assert.equal((await inbox.load()).code,'INVALID_CHAT_INBOX_DTO');
  assert.equal(inbox.snapshot().items.length,0);
 }
});
test('dos cuentas y rotación de sesión nunca comparten bandeja',async()=>{
 let identity=actor(),release;
 const wait=new Promise(r=>release=r);
 const inbox=make(flags({readInbox:async()=>wait}),async()=>identity);
 const pending=inbox.load();await Promise.resolve();await Promise.resolve();
 identity={...actor(),sessionRevision:4};
 release({ok:true,data:page()});
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(inbox.snapshot().items.length,0);
});
test('logout durante GET descarta respuesta tardía, sin reanimar servicios',async()=>{
 let resolve,cancels=0;
 const waiting=new Promise(r=>resolve=r);
 const inbox=make(flags({readInbox:async()=>waiting,
  cancelInbox:()=>cancels++}));
 const pending=inbox.load();await Promise.resolve();await Promise.resolve();
 inbox.clear();resolve({ok:true,data:page()});
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(inbox.snapshot().items.length,0);
 assert.equal(cancels,1);
});
test('paginación de 125 páginas sin límite global y memoria local acotada',async()=>{
 const cursor=n=>'C'+String(n).padStart(43,'0');
 let calls=0;
 const gateway=flags({readInbox:async({cursor:seen})=>{
  calls++;
  const n=seen?Number(seen.slice(1))+1:1;
  return {ok:true,data:page([row(n)],n<125?cursor(n):null)};
 }});
 const inbox=createPassengerChatInbox({gateway,getActor:async()=>actor(),
  now:()=>now,maxCachedConversations:100});
 assert.equal((await inbox.load()).ok,true);
 for(let i=1;i<125;i++)assert.equal((await inbox.load({next:true})).ok,true);
 const v=inbox.snapshot();
 assert.equal(calls,125);
 assert.equal(v.pageNumber,125);
 assert.equal(v.items.length,100);
 assert.equal(v.window.rowsRead,125);
 assert.equal(v.window.evictedCount,25);
 assert.equal(v.hasNext,false);
});
test('cursor repetido o revisión de servidor cambiada corta la cadena privada',async()=>{
 const cursor='a'.repeat(44);
 let count=0;
 const inbox=make(flags({readInbox:async()=>({ok:true,
  data:count++===0?page([row(1)],cursor)
   :{...page([row(2)],null),revision:10}})}));
 await inbox.load();
 assert.equal((await inbox.load({next:true})).code,'INVALID_CHAT_INBOX_DTO');
 assert.equal(inbox.snapshot().items.length,0);
});
test('registro duplicado en siguiente página se rechaza',async()=>{
 const cursor='b'.repeat(44);let count=0;
 const inbox=make(flags({readInbox:async()=>({
  ok:true,data:page([row(1)],count++===0?cursor:null)
 })}));
 await inbox.load();
 assert.equal((await inbox.load({next:true})).code,'DUPLICATE_CONVERSATION');
 assert.equal(inbox.snapshot().items.length,0);
});
test('revocación de gate en pleno fetch borra lista',async()=>{
 let enabled=true,release;const waiting=new Promise(r=>release=r);
 const inbox=make(flags({isConfigured:()=>enabled,readInbox:async()=>waiting}));
 const old=inbox.load();await Promise.resolve();await Promise.resolve();
 enabled=false;release({ok:true,data:page()});
 assert.equal((await old).code,'CHAT_INBOX_CONTRACT_NOT_CERTIFIED');
 assert.equal(inbox.snapshot().items.length,0);
});
test('loading no muestra identificadores privados y no inicia dos solicitudes',async()=>{
 let release;const waiting=new Promise(r=>release=r);
 const inbox=make(flags({readInbox:async()=>waiting}));
 const job=inbox.load();await Promise.resolve();await Promise.resolve();
 assert.equal(inbox.snapshot().items.length,0);
 assert.equal((await inbox.load()).code,'CHAT_INBOX_READ_IN_FLIGHT');
 release({ok:true,data:page()});
 assert.equal((await job).ok,true);
});

test('inbox soporta cantidades sin leer superiores a 99 sin truncar el DTO',async()=>{
 for(const unreadCount of [99,100,101,12500,Number.MAX_SAFE_INTEGER]){
  const inbox=make(flags({readInbox:async()=>({ok:true,
   data:page([{...row(1),unreadCount}])})}));
  assert.equal((await inbox.load()).ok,true);
  assert.equal(inbox.snapshot().items[0].unreadCount,unreadCount);
 }
});

test('página vacía con cursor no permite loops ilimitados',async()=>{
 const gateway=flags({readInbox:async()=>({
  ok:true,data:page([], 'c'.repeat(44))
 })});
 const inbox=make(gateway);
 assert.equal((await inbox.load()).code,'INVALID_CHAT_INBOX_DTO');
 assert.equal(inbox.snapshot().items.length,0);
});
test('dos conversaciones distintas para el mismo servicio activo dentro de una página',async()=>{
 const duplicate={...row(1),conversationId:id(999)};
 const inbox=make(flags({readInbox:async()=>({
  ok:true,data:page([row(1),duplicate])
 })}));
 assert.equal((await inbox.load()).code,'INVALID_CHAT_INBOX_DTO');
 assert.equal(inbox.snapshot().items.length,0);
});
test('otra página no puede presentar un segundo hilo para un mismo servicio activo',async()=>{
 const cursor='b'.repeat(44);
 const first=row(1),second={...row(1),conversationId:id(999)};
 let n=0;
 const inbox=make(flags({readInbox:async()=>({
  ok:true,data:page(n++===0?[first]:[second],n===1?cursor:null)
 })}));
 assert.equal((await inbox.load()).ok,true);
 assert.equal((await inbox.load({next:true})).code,'DUPLICATE_ACTIVE_SERVICE');
 assert.equal(inbox.snapshot().items.length,0);
});

test('páginas desordenadas en el mismo snapshot se rechazan',async()=>{
 const inbox=make(flags({readInbox:async()=>({
  ok:true,data:page([row(2),row(1)])
 })}));
 assert.equal((await inbox.load()).code,'INVALID_CHAT_INBOX_DTO');
 assert.equal(inbox.snapshot().items.length,0);
});
test('no reingresa una conversación descartada de memoria después de 110 páginas',async()=>{
 const cursor=n=>'C'+String(n).padStart(43,'0');
 let n=0;
 const inbox=createPassengerChatInbox({gateway:flags({
  readInbox:async()=>{
   n++;
   const item=n===111?row(1):row(n);
   return {ok:true,data:page([item],n<111?cursor(n):null)};
  }
 }),getActor:async()=>actor(),now:()=>now,maxCachedConversations:100});
 assert.equal((await inbox.load()).ok,true);
 for(let i=2;i<=110;i++)
  assert.equal((await inbox.load({next:true})).ok,true);
 assert.equal(inbox.snapshot().items.length,100);
 assert.equal(inbox.snapshot().window.evictedCount,10);
 assert.equal((await inbox.load({next:true})).code,'CHAT_INBOX_ORDER_VIOLATION');
 assert.equal(inbox.snapshot().items.length,0);
});
test('mismo updatedAt acepta desempate estable por conversationId descendente',async()=>{
 const sameTime=now-9000;
 const first={...row(1),conversationId:id(900),updatedAt:sameTime};
 const second={...row(2),conversationId:id(800),updatedAt:sameTime};
 const cursor='q'.repeat(44);let n=0;
 const inbox=make(flags({readInbox:async()=>({
  ok:true,data:page([n++===0?first:second],n===1?cursor:null)
 })}));
 assert.equal((await inbox.load()).ok,true);
 assert.equal((await inbox.load({next:true})).ok,true);
 assert.equal(inbox.snapshot().items.length,2);
});

test('timeout de refresco conserva únicamente lista previamente validada y bloquea cursor',async()=>{
 let failNext=false;
 const inbox=make(flags({readInbox:async()=>failNext
  ?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true,data:page()}}));
 assert.equal((await inbox.load()).ok,true);
 failNext=true;
 assert.equal((await inbox.load()).code,'NETWORK_OR_TIMEOUT');
 const v=inbox.snapshot();
 assert.equal(v.items.length,1);
 assert.equal(v.stale,true);
 assert.equal(v.hasNext,false);
 assert.equal(v.error,'NETWORK_OR_TIMEOUT');
});
test('recuperación de red sustituye la página vieja y restablece permisos UI',async()=>{
 let phase=0;
 const inbox=make(flags({readInbox:async()=>++phase===2
  ?{ok:false,code:'SERVICE_UNAVAILABLE'}
  :{ok:true,data:phase===1?page([row(1)]):page([row(2)])}}));
 await inbox.load();
 assert.equal((await inbox.load()).code,'SERVICE_UNAVAILABLE');
 assert.equal(inbox.snapshot().stale,true);
 assert.equal((await inbox.load()).ok,true);
 assert.deepEqual(inbox.snapshot().items.map(x=>x.conversationId),[id(102)]);
 assert.equal(inbox.snapshot().stale,false);
 assert.equal(inbox.snapshot().error,null);
});
test('403, 401, invalid DTO no mantienen conversación previamente autorizada',async()=>{
 for(const code of ['FORBIDDEN','AUTH_REQUIRED','INVALID_CURSOR']){
  let n=0;
  const inbox=make(flags({readInbox:async()=>++n===1
   ?{ok:true,data:page()}:{ok:false,code}}));
  await inbox.load();
  assert.equal((await inbox.load()).code,code);
  assert.equal(inbox.snapshot().items.length,0);
  assert.equal(inbox.snapshot().stale,false);
 }
});
test('JWT rotado mismo pasajero revoca datos incluso si el transporte devuelve timeout',async()=>{
 let identity=actor(),calls=0;
 const inbox=make(flags({readInbox:async()=>++calls===1
  ?{ok:true,data:page()}:{ok:false,code:'NETWORK_OR_TIMEOUT'}}),
  async()=>identity);
 await inbox.load();
 identity={...actor(),sessionRevision:4};
 assert.equal((await inbox.load()).code,'STALE_SESSION_RESPONSE');
 assert.equal(inbox.snapshot().items.length,0);
});
test('página validada caducada jamás permanece visible durante desconexión',async()=>{
 let clock=now,calls=0;
 const inbox=make(flags({readInbox:async()=>++calls===1
  ?{ok:true,data:page()}:{ok:false,code:'NETWORK_OR_TIMEOUT'}}),
  async()=>actor(),()=>clock);
 await inbox.load();
 clock+=60001;
 assert.equal(inbox.snapshot().items.length,0);
 assert.equal((await inbox.load()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(inbox.snapshot().items.length,0);
});

test('refresco con revisión menor no reautoriza conversación de caché antiguo',async()=>{
 let n=0;
 const inbox=make(flags({readInbox:async()=>({ok:true,data:
  ++n===1?page([row(1)]):{...page([{...row(2),revision:8}]),revision:8}})}));
 assert.equal((await inbox.load()).ok,true);
 assert.equal((await inbox.load()).code,'CHAT_INBOX_REVISION_ROLLBACK');
 assert.equal(inbox.snapshot().items.length,0);
 assert.equal(inbox.snapshot().stale,false);
});
test('refresco con revisión mayor sustituye listado sin mezclar anteriores',async()=>{
 let n=0;
 const inbox=make(flags({readInbox:async()=>({ok:true,
  data:++n===1?page([row(1)]):{...page([row(2)]),revision:10}})}));
 assert.equal((await inbox.load()).ok,true);
 assert.equal((await inbox.load()).ok,true);
 assert.deepEqual(inbox.snapshot().items.map(x=>x.conversationId),[id(102)]);
});
test('timeout al paginar mantiene vista verificada pero no permite seguir paginando',async()=>{
 let n=0;const cursor='z'.repeat(44);
 const inbox=make(flags({readInbox:async()=>++n===1
  ?{ok:true,data:page([row(1)],cursor)}
  :{ok:false,code:'RATE_LIMITED'}}));
 assert.equal((await inbox.load()).ok,true);
 assert.equal((await inbox.load({next:true})).code,'RATE_LIMITED');
 assert.equal(inbox.snapshot().items.length,1);
 assert.equal(inbox.snapshot().stale,true);
 assert.equal(inbox.snapshot().hasNext,false);
 assert.equal((await inbox.load({next:true})).code,'CHAT_INBOX_NEXT_UNAVAILABLE');
});
