/**
 * G58B / A42 — local integration assembly, never deployed.
 * All authorities must be independently provided. The ticket issuer is a
 * disposable QA fixture, NOT a mobile-accessible RPC or production mint.
 */
import {createG42PinnedJwtVerifier,createG42ProviderSessionAdapters}
 from './g42-provider-pinned-jwt-auth-qa.mjs';
import {createG58DelegatedChatSqlQa}
 from './g58-delegated-chat-sql-qa.mjs';
import {createG58ChatLoopbackTransportQa}
 from './g58-chat-loopback-transport-qa.mjs';
import {createG56BDriverPrivateInboxQa}
 from './g56b-driver-private-inbox-qa.mjs';
import {createG57BDriverHistoryWithOrderedMarkersQa,
 createG57BDriverMarkVisibleOrderedQa}
 from './g57b-driver-ordered-visible-qa.mjs';
import {createG57OrderedHistoryQa,createG57MarkVisibleOrderedQa}
 from './g57-ordered-visible-qa.mjs';
const QA=Object.freeze({environment:'isolated_staging',localQaOnly:true,liveEnabled:false});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
export function createG58BLocalAuthChainQa({
 environment,localQaOnly,liveEnabled,
 issuer,audience,publicKeys,
 readProviderUser,readProviderSession,readPrivateSessionGrant,
 readExclusiveRole,issueSyntheticTicket,openConnection,allowRequest,
 cursorSecret,now=Date.now
}={}){
 if(environment!==QA.environment||localQaOnly!==true||liveEnabled!==false||
  !Buffer.isBuffer(cursorSecret)||cursorSecret.length<32||
  [readProviderUser,readProviderSession,readPrivateSessionGrant,
   readExclusiveRole,issueSyntheticTicket,openConnection,allowRequest,now]
   .some(x=>typeof x!=='function'))
  throw Error('G58B only composes trusted and isolated local fixture sources');
 const jwtVerifier=createG42PinnedJwtVerifier({
  issuer,audience,publicKeys,now
 });
 const auth=createG42ProviderSessionAdapters({
  ...QA,verifyJwt:jwtVerifier,readProviderUser,
  readProviderSession,readPrivateSessionGrant,now
 });
 async function resolveExclusiveRole(actorId){
  if(!uuid(actorId))throw Error('G58B invalid role lookup');
  const role=await readExclusiveRole(actorId);
  if(role!=='driver'&&role!=='passenger')
   throw Error('G58B missing or overlapping roles');
  return role;
 }
 const sql=createG58DelegatedChatSqlQa({...QA,openConnection});
 const common={...QA,...auth,resolveExclusiveRole,
  allowRequest,mintOwnerTicket:issueSyntheticTicket,
  executeScopedTicket:sql.executeScopedTicket,cursorSecret,now};
 const inbox=createG56BDriverPrivateInboxQa(common);
 const driverHistory=createG57BDriverHistoryWithOrderedMarkersQa(common);
 const driverVisible=createG57BDriverMarkVisibleOrderedQa(common);
 const passengerHistory=createG57OrderedHistoryQa(common);
 const passengerVisible=createG57MarkVisibleOrderedQa(common);
 const transport=createG58ChatLoopbackTransportQa({
  ...QA,
  driverInboxHandler:req=>inbox.handle(req),
  driverHistoryHandler:req=>driverHistory.handle(req),
  driverVisibleHandler:req=>driverVisible.handle(req),
  passengerHistoryHandler:req=>passengerHistory.handle(req),
  passengerVisibleHandler:req=>passengerVisible.handle(req)
 });
 return Object.freeze({
  transport,
  // No exposure of ticket issuer, raw SQL, verified claims or any secret.
  async listen(){return transport.listen();},
  async close(){return transport.close();}
 });
}
