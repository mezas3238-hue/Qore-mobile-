import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerChatFlow} from './passenger-chat-flow.mjs';
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const serviceId=id(1), owner=id(2),conversationId=id(3),messageId=id(4),key=id(5);
const actor=()=>({subject:owner,role:'passenger',sessionRevision:3});
const row=n=>({messageId:id(20+n),senderRole:n%2?'passenger':'driver',
 body:n%2?'Estoy en la entrada':'Estoy llegando',createdAt:now-1000,
 revision:7});
const page=(kind='RIDE',cursor=null)=>({
 conversationId,serviceId,serviceKind:kind,ownerId:owner,
 counterpartRole:'driver',assignmentVerified:true,state:'ACTIVE',revision:7,
 generatedAt:now-2000,expiresAt:now+60000,canSend:true,
 productionEnabled:false,messages:[row(1)],nextCursor:cursor
});
const ack=()=>({conversationId,serviceId,requestKey:key,messageId,body:'Estoy aquí',
 senderRole:'passenger',createdAt:now-100,revision:8,serverStored:true});
const flags=(gateway={})=>({
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 isConfigured:()=>true,readMessages:async()=>({ok:true,data:page()}),
 sendMessage:async()=>({ok:true,data:ack()}),...gateway
});
const make=(gw=flags(),getActor=async()=>actor())=>
 createPassengerChatFlow({gateway:gw,getActor,now:()=>now});
test('chat OFF sin contrato no llama a red ni muestra conversación inventada',async()=>{
 let calls=0;const flow=make(flags({
  stagingRuntimeVerified:false,
  readMessages:async()=>{calls++;return {ok:true,data:page()};}
 }));
 assert.equal(flow.snapshot().contractReady,false);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,'CHAT_CONTRACT_NOT_CERTIFIED');
 assert.equal(calls,0);
 assert.equal(flow.snapshot().messages.length,0);
});
test('RIDE, DELIVERY y MERCHANT_ORDER solo con asignación certificada',async()=>{
 for(const kind of ['RIDE','DELIVERY','MERCHANT_ORDER']){
  const flow=make(flags({readMessages:async()=>({ok:true,data:page(kind)})}));
  assert.equal((await flow.open({serviceId,serviceKind:kind})).ok,true);
  assert.equal(flow.snapshot().serviceKind,kind);
  assert.equal(flow.snapshot().messages.length,1);
  assert.equal(flow.snapshot().phoneNumbersRequired,false);
 }
});
test('chat rechaza driver no asignado, permiso revocado, cuenta ajena y estado cerrado',async()=>{
 const invalid=[
  {...page(),ownerId:id(77)},
  {...page(),assignmentVerified:false},
  {...page(),counterpartRole:'admin'},
  {...page(),state:'CLOSED'},
  {...page(),expiresAt:now-1},
  {...page(),canSend:false},
  {...page(),productionEnabled:true},
  {...page(),driverPhone:'0981111111'},
  {...page(),messages:[{...row(1),customerEmail:'private'}]}
 ];
 for(const dto of invalid){
  const flow=make(flags({readMessages:async()=>({ok:true,data:dto})}));
  assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,'INVALID_CHAT_PAGE');
  assert.equal(flow.snapshot().messages.length,0);
 }
});
test('mensajes únicamente se acreditan tras ACK persistido por servidor',async()=>{
 const flow=make();
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).ok,true);
 assert.equal(flow.snapshot().messages[0].messageId,messageId);
 assert.equal(flow.snapshot().pendingSend,false);
 assert.equal(flow.snapshot().deliveredWithoutAck,false);
});
test('fallo ambiguo conserva requestKey y no duplica mensajes en reintento',async()=>{
 const keys=[];let n=0;
 const flow=make(flags({sendMessage:async args=>{
  keys.push(args.requestKey);
  return ++n===1?{ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'}:{ok:true,data:ack()};
 }}));
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,'CHAT_NETWORK_OR_TIMEOUT');
 assert.equal(flow.snapshot().pendingSend,true);
 assert.equal(flow.snapshot().messages.length,1);
 assert.equal((await flow.send({body:'Otra cosa',requestKey:id(88)})).code,
  'PENDING_MESSAGE_RECONCILIATION');
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key,retry:true})).ok,true);
 assert.deepEqual(keys,[key,key]);
 assert.equal(flow.snapshot().messages.length,2);
});
test('sin asignación o con mensaje inválido jamás llama al transporte',async()=>{
 let n=0;
 const flow=make(flags({sendMessage:async()=>{
  n++;return {ok:true,data:ack()};
 }}));
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,'CHAT_NOT_AUTHORIZED');
 await flow.open({serviceId,serviceKind:'RIDE'});
 for(const body of ['','<script>','https://example.com','Hola\nconsulta',' '.repeat(4),'a'.repeat(501)]){
  assert.equal((await flow.send({body,requestKey:key})).code,'INVALID_MESSAGE');
 }
 assert.equal(n,0);
});
test('rotación de sesión durante lectura jamás publica mensajes anteriores',async()=>{
 let identity=actor(),resolve;const deferred=new Promise(r=>resolve=r);
 const flow=make(flags({readMessages:async()=>deferred}),async()=>identity);
 const task=flow.open({serviceId,serviceKind:'RIDE'});
 await Promise.resolve();await Promise.resolve();
 identity={...actor(),sessionRevision:4};
 resolve({ok:true,data:page()});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(flow.snapshot().messages.length,0);
});
test('logout con fetch suspendido limpia chat y evita revivir otra sesión',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 let hit=0;
 const flow=make(flags({readMessages:async()=>{
  return ++hit===1?pending:{ok:true,data:page()};
 }}));
 const old=flow.open({serviceId,serviceKind:'RIDE'});
 await Promise.resolve();await Promise.resolve();
 flow.clear();
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 resolve({ok:true,data:page()});
 assert.equal((await old).code,'STALE_RESPONSE_IGNORED');
 assert.equal(flow.snapshot().messages.length,1);
});
test('más de 150 páginas de mensajes sin cuota global y con cursor opaco',async()=>{
 const cursor=n=>'C'+String(n).padStart(43,'0');
 let calls=0;
 const flow=make(flags({readMessages:async ({cursor:current})=>{
  const n=current?Number(current.slice(1))+1:1;
  calls++;
  return {ok:true,data:{...page('DELIVERY',n<160?cursor(n):null),
   messages:[row(n)]}};
 }}));
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 for(let n=1;n<160;n++)
  assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY',older:true})).ok,true);
 assert.equal(calls,160);
 assert.equal(flow.snapshot().messages.length,160);
 assert.equal(flow.snapshot().hasOlder,false);
});
test('cursor circular o mensajes de la misma página no exponen historial no confiable',async()=>{
 const cursor='c'.repeat(44);
 let n=0;
 const flow=make(flags({readMessages:async()=>({
  ok:true,data:page('RIDE',++n===1?cursor:cursor)
 })}));
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',older:true})).code,
  'DUPLICATE_CHAT_MESSAGE');
 assert.equal(flow.snapshot().messages.length,0);
});
test('ACK cruzado de conversación, clave, remitente o estado nunca se acepta',async()=>{
 const mutations=[
  {...ack(),conversationId:id(99)}, {...ack(),requestKey:id(99)},
  {...ack(),senderRole:'driver'}, {...ack(),serverStored:false},
  {...ack(),phoneNumber:'0981000000'}
 ];
 for(const data of mutations){
  const flow=make(flags({sendMessage:async()=>({ok:true,data})}));
  await flow.open({serviceId,serviceKind:'RIDE'});
  assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,'INVALID_CHAT_ACK');
  assert.equal(flow.snapshot().messages.length,0);
 }
});

test('una respuesta ambigua impide cambiar de hilo sin conciliar requestKey',async()=>{
 const f=make(flags({sendMessage:async()=>({ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'})}));
 await f.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await f.send({body:'Estoy aquí',requestKey:key})).code,'CHAT_NETWORK_OR_TIMEOUT');
 assert.equal((await f.open({serviceId,serviceKind:'DELIVERY'})).code,
  'PENDING_MESSAGE_RECONCILIATION');
 assert.equal(f.snapshot().serviceKind,'RIDE');
 assert.equal(f.snapshot().pendingSend,true);
});

test('chat protege teléfonos, correos, enlaces y Unicode bidi sin bloquear español',async()=>{
 const flow=make();
 await flow.open({serviceId,serviceKind:'RIDE'});
 for(const body of [
  '0981123456','+595 981 123 456','soporte@example.com',
  'usuario.nombre+1@dominio.com','www.tienda.test',
  'http://ejemplo.test','Te aviso\u202Eahora',
  'Casa # <script>', 'Llámame al 981123456',
 ]){
  assert.equal((await flow.send({body,requestKey:key})).code,'INVALID_MESSAGE',body);
 }
 assert.equal((await flow.send({body:'La casa está en el número 120',requestKey:key})).code,
  'INVALID_CHAT_ACK');
});
test('chat descarta filas de revisión futura sin mezclar versiones',async()=>{
 const dto={...page(),messages:[{...row(1),revision:8}]};
 const flow=make(flags({readMessages:async()=>({ok:true,data:dto})}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,'INVALID_CHAT_PAGE');
 assert.equal(flow.snapshot().messages.length,0);
});
test('un ACK viejo nunca se confunde con un nuevo envío confirmado',async()=>{
 const flow=make(flags({sendMessage:async()=>({ok:true,data:{...ack(),revision:6}})}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,'INVALID_CHAT_ACK');
 assert.equal(flow.snapshot().messages.length,0);
});

test('el móvil mantiene ventana acotada sin imponer cuota al historial del servidor',async()=>{
 const cursor=n=>'P'+String(n).padStart(43,'0');
 const flow=createPassengerChatFlow({now:()=>now,maxCachedMessages:100,
  getActor:async()=>actor(),
  gateway:flags({readMessages:async ({cursor:current})=>{
   const n=current?Number(current.slice(1))+1:1;
   return {ok:true,data:{...page('DELIVERY',n<620?cursor(n):null),
    messages:[row(n)]}};
  }})
 });
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 for(let n=1;n<620;n++)
  assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY',older:true})).ok,true);
 const v=flow.snapshot();
 assert.equal(v.pageNumber,620);
 assert.equal(v.messages.length,100);
 assert.equal(v.window.maxMessages,100);
 assert.equal(v.window.rowsRead,620);
 assert.equal(v.window.evictedCount,520);
 assert.equal(v.window.hasEvictedNewer,true);
 assert.equal(v.hasOlder,false);
 flow.clear();
 assert.equal(flow.snapshot().window.rowsRead,0);
});
test('una cancelación defectuosa del gateway no impide limpiar chat del móvil',async()=>{
 const flow=make(flags({cancelPending:()=>{throw Error('fallo de transporte');}}));
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal(flow.snapshot().messages.length,1);
 assert.doesNotThrow(()=>flow.clear());
 assert.equal(flow.snapshot().messages.length,0);
});

test('reintento tras TTL vencido revalida asignación antes de usar la MISMA clave',async()=>{
 let clock=now,reads=0,sends=0;
 const sent=[];
 const flow=createPassengerChatFlow({now:()=>clock,getActor:async()=>actor(),
  gateway:flags({
   readMessages:async()=>{
    reads++;
    return {ok:true,data:{...page(),generatedAt:clock-1000,
     expiresAt:clock+60000,messages:[]}};
   },
   sendMessage:async args=>{
    sends++;sent.push(args.requestKey);
    return sends===1?{ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'}:
     {ok:true,data:{...ack(),createdAt:clock-100}};
   }
  })
 });
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,'CHAT_NETWORK_OR_TIMEOUT');
 clock+=60001;
 assert.equal(flow.snapshot().pendingSend,true);
 assert.equal(flow.snapshot().active,true);
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal((await flow.retryPending()).ok,true);
 assert.deepEqual(sent,[key,key]);
 assert.equal(reads,2);
 assert.equal(flow.snapshot().pendingSend,false);
});
test('si el chat caduca y la red falla, no se reenvía sin validar asignación',async()=>{
 let clock=now,n=0,sends=0;
 const flow=createPassengerChatFlow({now:()=>clock,getActor:async()=>actor(),
  gateway:flags({
   readMessages:async()=>++n===1?{ok:true,data:page()}:
     {ok:false,code:'SERVICE_UNAVAILABLE'},
   sendMessage:async()=>{sends++;return {ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'};}
  })
 });
 await flow.open({serviceId,serviceKind:'RIDE'});
 await flow.send({body:'Estoy aquí',requestKey:key});
 clock+=60001;
 assert.equal((await flow.retryPending()).code,'SERVICE_UNAVAILABLE');
 assert.equal(sends,1);
 assert.equal(flow.snapshot().pendingSend,true);
});
test('hilo diferente tras expiración revoca la autorización del mensaje anterior',async()=>{
 let clock=now,n=0,sends=0;
 const flow=createPassengerChatFlow({now:()=>clock,getActor:async()=>actor(),
  gateway:flags({
   readMessages:async()=>++n===1?{ok:true,data:page()}:
    {ok:true,data:{...page(),conversationId:id(99),
     generatedAt:clock-1000,expiresAt:clock+60000}},
   sendMessage:async()=>{sends++;return {ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'};}
  })
 });
 await flow.open({serviceId,serviceKind:'RIDE'});
 await flow.send({body:'Estoy aquí',requestKey:key});
 clock+=60001;
 assert.equal((await flow.retryPending()).code,'INVALID_CHAT_PAGE');
 assert.equal(sends,1);
 assert.equal(flow.snapshot().pendingSend,false);
});

test('revocar contrato después de abrir purga mensajes; reactivarlo no recupera caché vieja',async()=>{
 let active=true;
 const gateway=flags({isConfigured:()=>active});
 const flow=make(gateway);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal(flow.snapshot().messages.length,1);
 active=false;
 assert.equal(flow.snapshot().contractReady,false);
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().serviceId,null);
 active=true;
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().active,false);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
});
test('revocación con GET en vuelo descarta respuesta y cancela transporte',async()=>{
 let active=true,finish,cancels=0;
 const waiting=new Promise(resolve=>{finish=resolve;});
 const flow=make(flags({isConfigured:()=>active,
  cancelPending:()=>cancels++,readMessages:async()=>waiting}));
 const pending=flow.open({serviceId,serviceKind:'DELIVERY'});
 await Promise.resolve();await Promise.resolve();
 active=false;
 finish({ok:true,data:page('DELIVERY')});
 assert.equal((await pending).code,'CHAT_CONTRACT_NOT_CERTIFIED');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(cancels,1);
});
test('revocación antes de ACK no comunica falso enviado ni revive datos',async()=>{
 let active=true,finish,cancels=0;
 const waiting=new Promise(resolve=>{finish=resolve;});
 const flow=make(flags({isConfigured:()=>active,
  cancelPending:()=>cancels++,sendMessage:async()=>waiting}));
 await flow.open({serviceId,serviceKind:'RIDE'});
 const pending=flow.send({body:'Estoy aquí',requestKey:key});
 await Promise.resolve();await Promise.resolve();
 active=false;
 finish({ok:true,data:ack()});
 assert.equal((await pending).code,'CHAT_CONTRACT_NOT_CERTIFIED');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,false);
 assert.equal(cancels,1);
});
test('excepción en certificación no revela datos ni rompe controles',async()=>{
 let throwing=false;
 const flow=make(flags({isConfigured:()=>{
  if(throwing)throw Error('config revocada');
  return true;
 }}));
 await flow.open({serviceId,serviceKind:'RIDE'});
 throwing=true;
 assert.equal(flow.snapshot().contractReady,false);
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,
  'CHAT_CONTRACT_NOT_CERTIFIED');
});

test('colisión de ACK reutiliza messageId pero cambia cuerpo: falla cerrado',async()=>{
 const existing={...row(1),messageId};
 const flow=make(flags({
  readMessages:async()=>({ok:true,data:{...page(),messages:[existing]}}),
  sendMessage:async()=>({ok:true,data:{...ack(),createdAt:existing.createdAt,
   revision:existing.revision}})
 }));
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_MESSAGE_ID_COLLISION');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,false);
});
test('ACK idempotente idéntico a un mensaje existente se acepta una sola vez',async()=>{
 const stored={messageId,body:'Estoy aquí',senderRole:'passenger',
  createdAt:now-100,revision:8};
 const flow=make(flags({
  readMessages:async()=>({ok:true,data:{...page(),revision:8,messages:[stored]}}),
  sendMessage:async()=>({ok:true,data:ack()})
 }));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).ok,true);
 assert.equal(flow.snapshot().messages.length,1);
 assert.equal(flow.snapshot().window.rowsRead,1);
});
test('colisión del mismo messageId con revisión/timestamp diferente no es ACK',async()=>{
 for(const patch of [
  {revision:9},
  {createdAt:now-50},
  {senderRole:'driver'}
 ]){
  const stored={messageId,body:'Estoy aquí',senderRole:'passenger',
   createdAt:now-100,revision:8};
  const flow=make(flags({
   readMessages:async()=>({ok:true,data:{...page(),revision:8,messages:[stored]}}),
   sendMessage:async()=>({ok:true,data:{...ack(),...patch}})
  }));
  await flow.open({serviceId,serviceKind:'RIDE'});
  const r=await flow.send({body:'Estoy aquí',requestKey:key});
  assert.equal(r.ok,false);
  assert.equal(flow.snapshot().messages.length,0);
 }
});

test('ACK tardío al vencer permiso conserva requestKey y exige reconciliación',async()=>{
 let clock=now,attempts=0,reads=0;
 const keys=[];
 const flow=createPassengerChatFlow({now:()=>clock,getActor:async()=>actor(),
  gateway:flags({
   readMessages:async()=>{
    reads++;
    return {ok:true,data:{...page(),generatedAt:clock-1000,
     expiresAt:clock+60000,messages:[]}};
   },
   sendMessage:async args=>{
    attempts++;keys.push(args.requestKey);
    if(attempts===1)clock+=60001;
    return {ok:true,data:{...ack(),createdAt:clock-100}};
   }
  })
 });
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_AUTHORIZATION_EXPIRED');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,true);
 assert.equal((await flow.retryPending()).ok,true);
 assert.deepEqual(keys,[key,key]);
 assert.equal(reads,2);
 assert.equal(flow.snapshot().messages.length,1);
 assert.equal(flow.snapshot().pendingSend,false);
});
test('ACK tardío con datos cruzados no conserva permiso ni mensaje privado',async()=>{
 let clock=now;
 const flow=createPassengerChatFlow({now:()=>clock,getActor:async()=>actor(),
  gateway:flags({sendMessage:async()=>{
   clock+=60001;
   return {ok:true,data:{...ack(),conversationId:id(99),
    createdAt:clock-100}};
  }})
 });
 await flow.open({serviceId,serviceKind:'RIDE'});
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'INVALID_CHAT_ACK');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,false);
});

test('selección desde inbox vincula conversationId y rechaza hilo distinto para mismo envío',async()=>{
 let sends=0;
 const flow=make(flags({
  readMessages:async()=>({ok:true,data:{...page('DELIVERY'),conversationId:id(90)}}),
  sendMessage:async()=>{sends++;return {ok:true,data:ack()};}
 }));
 const result=await flow.open({serviceId,serviceKind:'DELIVERY',
  expectedConversationId:conversationId});
 assert.equal(result.code,'INVALID_CHAT_PAGE');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().conversationId,null);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_NOT_AUTHORIZED');
 assert.equal(sends,0);
});
test('hilo exacto desde inbox abre y pagina, y un hilo diferente no puede reutilizar cursor',async()=>{
 const cursor='a'.repeat(44);
 let calls=0;
 const flow=make(flags({
  readMessages:async()=>({ok:true,data:page('DELIVERY',++calls===1?cursor:null)})
 }));
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY',
  expectedConversationId:conversationId})).ok,true);
 assert.equal(flow.snapshot().conversationId,conversationId);
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY',older:true,
  expectedConversationId:id(90)})).code,'NO_OLDER_CHAT_PAGE');
 assert.equal(calls,1);
});
test('referencia de conversación manipulada se rechaza antes de consultar backend',async()=>{
 let hits=0;
 const flow=make(flags({readMessages:async()=>{
  hits++;return {ok:true,data:page()};
 }}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:'../../'})).code,'INVALID_CONVERSATION');
 assert.equal(hits,0);
});
test('navegación histórica sin conversationId sigue validando asignación por servidor',async()=>{
 const flow=make();
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal(flow.snapshot().conversationId,conversationId);
});

// R14: defensas contra páginas malformadas, cursor sin avance y TTL privado.
test('página vacía con cursor activo falla cerrado sin paginación infinita',async()=>{
 const cursor='P'.repeat(44);
 const flow=make(flags({readMessages:async()=>({ok:true,
  data:{...page('DELIVERY',cursor),messages:[]}})}));
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).code,
  'INVALID_CHAT_PAGE');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().hasOlder,false);
});
test('la última página puede estar vacía si el servidor cerró el cursor',async()=>{
 const flow=make(flags({readMessages:async()=>({ok:true,
  data:{...page('DELIVERY'),messages:[]}})}));
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().hasOlder,false);
});
test('marcas temporales inconsistentes y páginas viejas rechazan permiso obsoleto',async()=>{
 for(const patch of [
  {generatedAt:now-300001,expiresAt:now+60000},
  {generatedAt:now+1},
  {generatedAt:now-2000,expiresAt:now-2000},
  {generatedAt:now-1000,expiresAt:now+300001},
  {expiresAt:NaN},{generatedAt:Infinity}
 ]){
  const flow=make(flags({readMessages:async()=>({ok:true,data:{...page(),...patch}})}));
  assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,
   'INVALID_CHAT_PAGE',JSON.stringify(patch));
  assert.equal(flow.snapshot().messages.length,0);
 }
});
test('el TTL vencido purga físicamente chat sin mensaje incierto',async()=>{
 let clock=now;
 const flow=createPassengerChatFlow({gateway:flags(),getActor:async()=>actor(),
  now:()=>clock});
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal(flow.snapshot().messages.length,1);
 clock+=60001;
 const stale=flow.snapshot();
 assert.equal(stale.messages.length,0);
 assert.equal(stale.conversationId,null);
 assert.equal(stale.active,false);
 assert.equal(stale.pendingSend,false);
 assert.equal(stale.window.rowsRead,0);
});

// R15: cambio de conversación del mismo servicio y JWT durante ACK.
test('mismo envío reasignado espera conciliación antes de abrir nuevo hilo',async()=>{
 const replacement=id(91);
 let phase=0,attempts=0;
 const keys=[];
 const flow=make(flags({
  readMessages:async()=>({ok:true,data:{...page(),
   conversationId:phase===0?conversationId:replacement,
   messages:[phase===0?row(1):row(2)]}}),
  sendMessage:async args=>{
   keys.push(args.requestKey);
   return ++attempts===1?{ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'}:
    {ok:true,data:ack()};
  }
 }));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:conversationId})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_NETWORK_OR_TIMEOUT');
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:replacement})).code,'PENDING_MESSAGE_RECONCILIATION');
 assert.equal(flow.snapshot().conversationId,conversationId);
 assert.equal((await flow.retryPending()).ok,true);
 assert.deepEqual(keys,[key,key]);
 phase=1;
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:replacement})).ok,true);
 assert.equal(flow.snapshot().conversationId,replacement);
 assert.deepEqual(flow.snapshot().messages.map(x=>x.messageId),[row(2).messageId]);
});
test('ACK demorado bajo JWT rotado no publica texto ni confirma envío',async()=>{
 let identity=actor(),release;
 const deferred=new Promise(resolve=>{release=resolve;});
 const flow=make(flags({sendMessage:async()=>deferred}),async()=>identity);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 const sending=flow.send({body:'Estoy aquí',requestKey:key});
 await Promise.resolve();await Promise.resolve();
 identity={...actor(),sessionRevision:4};
 release({ok:true,data:ack()});
 assert.equal((await sending).code,'STALE_SESSION_RESPONSE');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,false);
 assert.equal(flow.snapshot().conversationId,null);
});


// R16 — monotonicidad de permisos por hilo y pin de sesión (QA sintético).
test('refresco del mismo hilo con revisión anterior no reabre autorización obsoleta',async()=>{
 let n=0;
 const flow=make(flags({readMessages:async()=>({
  ok:true,data:++n===1?page():{...page(),revision:6,
   messages:[{...row(1),revision:6}]}
 })}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).code,'INVALID_CHAT_PAGE');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().conversationId,null);
});
test('mismo hilo acepta revisión nueva y purga versión anterior',async()=>{
 let n=0;
 const flow=make(flags({readMessages:async()=>({ok:true,data:++n===1
  ?page():{...page(),revision:8,messages:[{...row(2),revision:8}]}})}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.deepEqual(flow.snapshot().messages.map(m=>m.messageId),[row(2).messageId]);
});
test('reasignación a un hilo nuevo permite su versión inicial sin reutilizar mensajes',async()=>{
 let changed=false;
 const newConversation=id(92);
 const flow=make(flags({readMessages:async()=>({ok:true,data:changed
  ?{...page(),conversationId:newConversation,revision:1,messages:[]}
  :page()})}));
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:conversationId})).ok,true);
 changed=true;
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',
  expectedConversationId:newConversation})).ok,true);
 assert.equal(flow.snapshot().conversationId,newConversation);
 assert.equal(flow.snapshot().messages.length,0);
});
test('paginación antigua se invalida tras rotación JWT antes de cualquier GET',async()=>{
 let identity=actor(),reads=0;
 const flow=make(flags({readMessages:async()=>{
  reads++;return {ok:true,data:page('RIDE','c'.repeat(44))};
 }}),async()=>identity);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 identity={...actor(),sessionRevision:4};
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE',older:true})).code,
  'STALE_SESSION_RESPONSE');
 assert.equal(reads,1);
 assert.equal(flow.snapshot().messages.length,0);
});
test('sesión JWT rotada después de GET exige autorización nueva antes de POST',async()=>{
 let identity=actor(),writes=0;
 const flow=make(flags({sendMessage:async()=>{
  writes++;return {ok:true,data:ack()};
 }}),async()=>identity);
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 identity={...actor(),sessionRevision:4};
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'STALE_SESSION_RESPONSE');
 assert.equal(writes,0);
 assert.equal(flow.snapshot().pendingSend,false);
 assert.equal(flow.snapshot().messages.length,0);
});
test('reintento de mensaje incierto caducado no usa JWT de otra revisión',async()=>{
 let identity=actor(),clock=now,reads=0,writes=0;
 const flow=createPassengerChatFlow({now:()=>clock,
  getActor:async()=>identity,gateway:flags({
   readMessages:async()=>{reads++;return {ok:true,data:page()};},
   sendMessage:async()=>{writes++;return {ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'};}
  })});
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_NETWORK_OR_TIMEOUT');
 clock+=60001;
 identity={...actor(),sessionRevision:4};
 assert.equal((await flow.retryPending()).code,'STALE_SESSION_RESPONSE');
 assert.equal(reads,1);assert.equal(writes,1);
 assert.equal(flow.snapshot().pendingSend,false);
});
test('revalidar mensaje incierto no acepta rollback del mismo hilo al vencer TTL',async()=>{
 let clock=now,reads=0,writes=0;
 const flow=createPassengerChatFlow({now:()=>clock,
  getActor:async()=>actor(),gateway:flags({
   readMessages:async()=>{
    reads++;
    return {ok:true,data:reads===1?page():{
     ...page(),revision:6,messages:[{...row(1),revision:6}],
     generatedAt:clock-1000,expiresAt:clock+60000
    }};
   },
   sendMessage:async()=>{writes++;return {ok:false,code:'CHAT_NETWORK_OR_TIMEOUT'};}
  })});
 assert.equal((await flow.open({serviceId,serviceKind:'RIDE'})).ok,true);
 assert.equal((await flow.send({body:'Estoy aquí',requestKey:key})).code,
  'CHAT_NETWORK_OR_TIMEOUT');
 clock+=60001;
 assert.equal((await flow.retryPending()).code,'INVALID_CHAT_PAGE');
 assert.equal(reads,2);assert.equal(writes,1);
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal(flow.snapshot().pendingSend,false);
});
