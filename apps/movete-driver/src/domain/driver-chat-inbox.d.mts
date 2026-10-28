export declare const DRIVER_CHAT_LIVE_ENABLED:false;
export type DriverChatInboxPhase='signed-out'|'authorization-required'|'ready'|'loading'|'loading-more'|'connected'|'offline';
export type DriverChatInboxRow=Readonly<{
 conversationId:string;serviceId:string;serviceKind:'RIDE'|'DELIVERY'|'MERCHANT_ORDER';
 counterpartRole:'passenger';state:'ACTIVE';assignmentVerified:true;canSend:true;
 revision:number;unreadCount:number;updatedAt:number;
}>;
export type DriverChatInboxSnapshot=Readonly<{
 phase:DriverChatInboxPhase;conversations:ReadonlyArray<DriverChatInboxRow>;
 hasMore:boolean;expiresAt:number;productionEnabled:false;qaOnly:true;
}>;
export type DriverChatProviderSession=Readonly<{
 userId:string;role:'driver';accessToken:string;
}>;
export type DriverChatInboxPage=Readonly<{
 ownerId:string;revision:number;generatedAt:number;expiresAt:number;
 items:ReadonlyArray<DriverChatInboxRow>;nextCursor:string|null;
 productionEnabled:false;qaOnly:true;
}>;
export declare function createDriverChatInboxController(options:{
 readPage:(request:{bearer:string;cursor:string|null;limit:number})=>Promise<{
  status:number;body:unknown;
 }>;
 now?:()=>number;liveEnabled?:false;pageSize?:number;
}):Readonly<{
 current:()=>DriverChatInboxSnapshot;
 subscribe:(listener:(snapshot:DriverChatInboxSnapshot)=>void)=>()=>void;
 setSession:(session:DriverChatProviderSession|null)=>DriverChatInboxSnapshot;
 clear:()=>DriverChatInboxSnapshot;
 invalidate:()=>DriverChatInboxSnapshot;
 refresh:()=>Promise<DriverChatInboxSnapshot>;
 loadMore:()=>Promise<DriverChatInboxSnapshot>;
 tick:()=>DriverChatInboxSnapshot;
}>;
