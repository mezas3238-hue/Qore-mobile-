import type {DriverHttpsStagingAuthSdk,
 DriverHttpsStagingAuthAdapter} from './driver-https-staging-auth.mjs';
import type {DriverChatHttpsStagingAdapters}
 from './driver-chat-https-staging.mjs';
import type {DriverWorkspaceControllerOptions}
 from './driver-workspace.mjs';
import type {DriverOfferActionsAdapters}
 from './driver-offer-actions.mjs';
import type {DriverTripAdapters} from './driver-trip-lifecycle.mjs';
import type {DriverDocumentUploadAdapters}
 from './driver-document-upload.mjs';
import type {DriverCustodyAdapters} from './driver-custody-controller.mjs';
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
 captureEvidence?:((x:{kind:import('./driver-document-upload.mjs').DriverKycUploadKind;source:'camera'|'camera_or_library';maxBytes:number})=>Promise<{bytes:Uint8Array;mimeType:string;source:'camera'|'library'}|null>)|null;
 uploadPrivateObject?:((x:{bucket:string;objectKey:string;mimeType:string;bytes:Uint8Array;upsert:false;accessToken:string})=>Promise<{storedPrivately:boolean}>)|null;
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
 offerActions:DriverOfferActionsAdapters;
 tripActions:DriverTripAdapters;
 custodyActions:DriverCustodyAdapters;
 documentUploads:DriverDocumentUploadAdapters|null;
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
