import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerChatFlow} from './passenger-chat-flow.mjs';
import {projectPassengerChatPushHint} from './passenger-chat-push-hint.mjs';

/**
 * Ensayo sintético de interoperabilidad pasajero/conductor.
 * No implementa la app Driver, RLS SQL, JWT ni un backend montado.
 * Este oráculo reproduce condiciones que A deberá certificar en STAGING.
 */
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const passenger=id(1),otherPassenger=id(2),driver=id(3),otherDriver=id(4);
const serviceId=id(5),conversationId=id(6);
const cursor=n=>'P'+String(n).padStart(43,'0');
function createSyntheticTwoPartyService(){
 let active=true,assignment=driver,revision=1,sequence=100;
 const messages=[],requests=new Map(),received=new Set();
 const statistics={readCalls:0,sendCalls:0,driverCalls:0,denied:0};
 function authorized(subject){
  const allowed=active&&subject===passenger&&assignment===driver;
  if(!allowed)statistics.denied++;
  return allowed;
 }
 function insert(senderRole,body){
  const message={messageId:id(++sequence),senderRole,body,
   createdAt:now-1000,revision:++revision};
  messages.unshift(message);return message;
 }
 const gateway={
  enabled:true,contractCertified:true,stagingRuntimeVerified:true,
  isConfigured:()=>true,cancelPending:()=>{},
  async readMessages({serviceId:requested,serviceKind,cursor:pageCursor,
    subject,sessionRevision}){
   statistics.readCalls++;
   if(requested!==serviceId||serviceKind!=='DELIVERY'
    ||!authorized(subject)||sessionRevision!==3)
    return {ok:false,code:'FORBIDDEN'};
   const n=pageCursor?Number(pageCursor.slice(1)):0;
   if(!Number.isSafeInteger(n)||n<0||n>messages.length)
    return {ok:false,code:'INVALID_CURSOR'};
   const rows=messages.slice(n,n+100);
   return {ok:true,data:{
    conversationId,serviceId,serviceKind:'DELIVERY',
    ownerId:passenger,counterpartRole:'driver',
    assignmentVerified:true,state:'ACTIVE',revision,
    generatedAt:now-2000,expiresAt:now+60000,
    messages:rows,nextCursor:n+100<messages.length?cursor(n+100):null,
    canSend:true,productionEnabled:false
   }};
  },
  async sendMessage({conversationId:conversation,serviceId:requested,
   serviceKind,subject,sessionRevision,body,requestKey}){
   statistics.sendCalls++;
   if(conversation!==conversationId||requested!==serviceId
    ||serviceKind!=='DELIVERY'||!authorized(subject)
    ||sessionRevision!==3)return {ok:false,code:'FORBIDDEN'};
   let ack=requests.get(requestKey);
   if(ack){
    if(ack.body!==body)return {ok:false,code:'IDEMPOTENCY_COLLISION'};
    return {ok:true,data:ack};
   }
   const accepted=insert('passenger',body);
   ack={conversationId,serviceId,requestKey,
    ...accepted,serverStored:true};
   requests.set(requestKey,ack);
   return {ok:true,data:ack};
  }
 };
 function fromDriver(driverId,body){
  statistics.driverCalls++;
  if(!active||assignment!==driverId){statistics.denied++;return null;}
  return insert('driver',body);
 }
 return {
  gateway,fromDriver,statistics,messages,requests,
  cancel:()=>{active=false;},
  reassign:newDriver=>{assignment=newDriver;},
  seed:n=>{for(let i=0;i<n;i++)insert(i%2?'passenger':'driver','Respuesta '+i);},
  createPassengerFlow:(subject=passenger)=>{
   let account=subject;
   const flow=createPassengerChatFlow({gateway,
    getActor:async()=>({role:'passenger',subject:account,sessionRevision:3}),
    now:()=>now,maxCachedMessages:100});
   return {flow,switchAccount:next=>{account=next;}};
  }
 };
}
test('viaje de entrega: pasajero escribe, repartidor asignado responde, pasajero recibe',async()=>{
 const server=createSyntheticTwoPartyService();
 const {flow}=server.createPassengerFlow();
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 const first=await flow.send({body:'Estoy junto a la puerta',requestKey:id(50)});
 assert.equal(first.ok,true);
 assert.equal(flow.snapshot().messages.length,1);
 assert.ok(server.fromDriver(driver,'Estoy llegando'));
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 assert.equal(flow.snapshot().messages[0].senderRole,'driver');
 assert.equal(flow.snapshot().messages[1].senderRole,'passenger');
 assert.equal(server.statistics.denied,0);
});
test('suplantar conductor o pasajero no abre otro hilo ni permite respuesta',async()=>{
 const server=createSyntheticTwoPartyService();
 assert.equal(server.fromDriver(otherDriver,'Suplantación'),null);
 const impostor=server.createPassengerFlow(otherPassenger).flow;
 assert.equal((await impostor.open({serviceId,serviceKind:'DELIVERY'})).code,'FORBIDDEN');
 assert.equal(impostor.snapshot().messages.length,0);
 const real=server.createPassengerFlow().flow;
 await real.open({serviceId,serviceKind:'DELIVERY'});
 server.reassign(otherDriver);
 assert.equal((await real.send({body:'Llegué al edificio',requestKey:id(51)})).code,
  'FORBIDDEN');
 assert.equal(real.snapshot().messages.length,0);
});
test('respuesta perdida con requestKey igual evita duplicar escritura persistida',async()=>{
 const server=createSyntheticTwoPartyService();
 let dropped=false;
 const wrapped={...server.gateway,
  sendMessage:async args=>{
   const result=await server.gateway.sendMessage(args);
   if(!dropped){dropped=true;throw Error('synthetic packet loss after commit');}
   return result;
  }
 };
 const flow=createPassengerChatFlow({gateway:wrapped,now:()=>now,
  getActor:async()=>({role:'passenger',subject:passenger,sessionRevision:3})});
 await flow.open({serviceId,serviceKind:'DELIVERY'});
 assert.equal((await flow.send({body:'Pedido recibido',requestKey:id(52)})).code,
  'CHAT_NETWORK_OR_TIMEOUT');
 assert.equal(server.messages.length,1);
 assert.equal((await flow.retryPending()).ok,true);
 assert.equal(server.messages.length,1);
 assert.equal(server.requests.size,1);
 assert.equal(flow.snapshot().messages.length,1);
});
test('revocación después de chat abierto elimina el historial de cliente',async()=>{
 const server=createSyntheticTwoPartyService();
 const flow=server.createPassengerFlow().flow;
 server.fromDriver(driver,'Estoy en la puerta');
 await flow.open({serviceId,serviceKind:'DELIVERY'});
 assert.equal(flow.snapshot().messages.length,1);
 server.cancel();
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).code,'FORBIDDEN');
 assert.equal(flow.snapshot().messages.length,0);
 assert.equal((await flow.send({body:'Hola',requestKey:id(53)})).code,
  'CHAT_NOT_AUTHORIZED');
});
test('historial sintético supera 500 entradas sin límite global del servicio',async()=>{
 const server=createSyntheticTwoPartyService();
 server.seed(640);
 const flow=server.createPassengerFlow().flow;
 assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY'})).ok,true);
 for(let i=0;i<6;i++)
  assert.equal((await flow.open({serviceId,serviceKind:'DELIVERY',older:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,7);
 assert.equal(flow.snapshot().messages.length,100);
 assert.equal(flow.snapshot().window.rowsRead,640);
 assert.equal(flow.snapshot().window.evictedCount,540);
 assert.equal(server.messages.length,640);
 assert.equal(flow.snapshot().hasOlder,false);
});
test('avisos del repartidor ocultan nombre, texto y teléfono, no prueban asignación',()=>{
 const server=createSyntheticTwoPartyService();
 server.fromDriver(driver,'Tengo el pedido listo');
 const hint=projectPassengerChatPushHint({
  eventId:id(79),ownerId:passenger,serviceId,
  serviceKind:'DELIVERY',kind:'CHAT_ACTIVITY',
  revision:10,issuedAt:now-1000,expiresAt:now+60000,
  unreadCount:1,contentIncluded:false
 },{subject:passenger,now});
 assert.equal(hint.body,'Tenés mensajes nuevos de tu servicio.');
 assert.equal(hint.requiresServerAuthorization,true);
 assert.equal(Object.hasOwn(hint,'senderName'),false);
 assert.equal(projectPassengerChatPushHint({
  eventId:id(80),ownerId:passenger,serviceId,
  serviceKind:'DELIVERY',kind:'CHAT_ACTIVITY',
  revision:11,issuedAt:now-1000,expiresAt:now+60000,
  unreadCount:1,contentIncluded:false,body:'Tengo el pedido listo'
 },{subject:passenger,now}),null);
});
