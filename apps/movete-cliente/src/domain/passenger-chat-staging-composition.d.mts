import type {ClientExperience} from './client-experience.mjs';
export declare const PASSENGER_CHAT_PRODUCTION_ENABLED:false;
export declare function assertApprovedPassengerStagingOrigin(options?:{
 apiOrigin?:string;approvedStagingHost?:string;
}):string;
export type PassengerChatStagingComposition=Readonly<{
 ready:false;code:'PASSENGER_STAGING_NOT_AUTHORIZED';
 productionEnabled:false;experience:ClientExperience;
}>|Readonly<{
 ready:true;mode:'STAGING_QA_ONLY';productionEnabled:false;
 experience:ClientExperience;
}>;
export declare function createPassengerChatStagingComposition(options?:{
 ownerApprovedStaging?:boolean;identityContractCertified?:boolean;
 chatContractsCertified?:boolean;httpsStagingRuntimeVerified?:boolean;
 liveEnabled?:boolean;apiOrigin?:string;approvedStagingHost?:string;
 authProvider?:{readSession:()=>unknown|Promise<unknown>;
  signOut:()=>unknown|Promise<unknown>};
 verifyExclusivePassengerRole?:(input:Readonly<{subject:string;token:string;expiresAt:number}>)=>
  boolean|Promise<boolean>;
 fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
 now?:()=>number;timeoutMs?:number;
}):PassengerChatStagingComposition;
