import type {DriverHttpsStagingAuthSdk,
 DriverHttpsStagingAuthAdapter} from './driver-https-staging-auth.mjs';
import type {DriverChatHttpsStagingAdapters}
 from './driver-chat-https-staging.mjs';
import type {DriverWorkspaceControllerOptions}
 from './driver-workspace.mjs';
export declare const DRIVER_STAGING_RUNTIME_LIVE_ENABLED:false;
export type DriverStagingRuntimeOptions=Readonly<{
 apiOrigin:string;
 approvedStagingHost:string;
 auth:DriverHttpsStagingAuthSdk;
 verifyExclusiveDriverRole:(proof:Readonly<{
  apiOrigin:string;userId:string;accessToken:string;
 }>)=>Promise<boolean>;
 request:typeof fetch;
 makeRequestKey:()=>string|Promise<string>;
 verifyStopped:()=>Promise<{
  vehicleStopped:boolean;source:string;observedAtMs:number;
 }>;
 allowedByOwner:true;
 liveEnabled?:false;
 now?:()=>number;
}>;
export type DriverStagingRuntime=Readonly<{
 apiOrigin:string;
 approvedStagingHost:string;
 allowedByOwner:true;
 authAdapter:DriverHttpsStagingAuthAdapter;
 chatAdapters:DriverChatHttpsStagingAdapters;
 workspaceReaders:Readonly<{
  readInbox:NonNullable<DriverWorkspaceControllerOptions['readInbox']>;
  readDocuments:NonNullable<DriverWorkspaceControllerOptions['readDocuments']>;
  readLicense:NonNullable<DriverWorkspaceControllerOptions['readLicense']>;
 }>;
 productionEnabled:false;
 qaOnly:true;
}>;
export declare function createDriverStagingRuntime(
 opts:DriverStagingRuntimeOptions
):DriverStagingRuntime;
