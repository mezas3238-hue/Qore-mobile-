import type {DriverChatInboxPage} from './driver-chat-inbox.mjs';
export declare const DRIVER_MESSAGING_LIVE_ENABLED:false;
export type DriverConversation=Readonly<{
 conversationId:string;serviceId:string;
 serviceKind:'RIDE'|'DELIVERY'|'MERCHANT_ORDER';
}>;
export type DriverMessagingRow=Readonly<{
 messageId:string;senderRole:'passenger'|'driver';
 body:string;createdAt:number;revision:number;canConfirmRead:boolean;
}>;
export type DriverMessagingInboxRow=Readonly<{
 conversationId:string;serviceId:string;
 serviceKind:'RIDE'|'DELIVERY'|'MERCHANT_ORDER';
 counterpartRole:'passenger';state:'ACTIVE';assignmentVerified:true;
 canSend:true;revision:number;unreadCount:number;updatedAt:number;
}>;
export type DriverMessagingPhase='signed-out'|'authorization-required'|'ready'|
 'loading'|'inbox'|'connected'|'sending'|'uncertain'|'offline';
export type DriverSendState='idle'|'blocked'|'sending'|'uncertain'|'confirmed';
export type DriverMessagingSnapshot=Readonly<{
 phase:DriverMessagingPhase;
 conversations:ReadonlyArray<DriverMessagingInboxRow>;
 hasMore:boolean;
 conversation:DriverConversation|null;
 messages:ReadonlyArray<DriverMessagingRow>;
 hasOlder:boolean;
 sendState:DriverSendState;
 latestRevision:number;
 lastConfirmedId:string|null;
 readConfirmedIds:ReadonlyArray<string>;
 canCompose:boolean;
 qaOnly:true;productionEnabled:false;
}>;
export type DriverMessagingSession=Readonly<{
 userId:string;role:'driver';accessToken:string;
}>;
export type QaReply={status:number;body:unknown};
export type DriverMessagingAdapters=Readonly<{
 readInbox:(request:{bearer:string;cursor:string|null;limit:number})=>Promise<{
  status:number;body:DriverChatInboxPage|Readonly<{code:string}>;
 }>;
 readHistory:(request:{bearer:string;serviceKind:string;serviceId:string;
  conversationId:string;cursor:string|null;limit:number})=>Promise<QaReply>;
 send:(request:{bearer:string;serviceKind:string;serviceId:string;
  conversationId:string;requestKey:string;body:string})=>Promise<QaReply>;
 reconcile:(request:{bearer:string;serviceKind:string;serviceId:string;
  conversationId:string;requestKey:string;body:string})=>Promise<QaReply>;
 markVisible:(request:{bearer:string;conversationId:string;messageId:string;
  marker:string})=>Promise<QaReply>;
 makeRequestKey:()=>Promise<string>|string;
 /** Independently verified vehicle-stopped fact, not a Driver UI toggle. */
 verifyStopped:()=>Promise<{vehicleStopped:true;source:'trusted_navigation';
  observedAtMs:number}|{vehicleStopped:false;source:string;observedAtMs:number}>;
 now?:()=>number;
 liveEnabled?:false;
}>;
export type DriverMessagingController=Readonly<{
 current:()=>DriverMessagingSnapshot;
 subscribe:(listener:(s:DriverMessagingSnapshot)=>void)=>()=>void;
 setSession:(session:DriverMessagingSession|null)=>DriverMessagingSnapshot;
 clear:()=>DriverMessagingSnapshot;
 invalidate:()=>DriverMessagingSnapshot;
 refreshInbox:()=>Promise<DriverMessagingSnapshot>;
 loadMoreInbox:()=>Promise<DriverMessagingSnapshot>;
 open:(conversationId:string)=>Promise<DriverMessagingSnapshot>;
 loadOlder:()=>Promise<DriverMessagingSnapshot>;
 backToInbox:()=>DriverMessagingSnapshot;
 sendMessage:(body:string)=>Promise<DriverMessagingSnapshot>;
 reconcilePending:()=>Promise<DriverMessagingSnapshot>;
 confirmVisible:(messageId:string)=>Promise<DriverMessagingSnapshot>;
}>;
export declare function createDriverMessagingController(
 options:DriverMessagingAdapters
):DriverMessagingController;
