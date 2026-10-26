import type {DriverOffer} from './driver-inbox.mjs';
import type {DriverDocumentStatus} from './driver-documents.mjs';
import type {DriverLicenseReviewSnapshot} from './driver-license-readiness.mjs';
export declare const DRIVER_WORKSPACE_LIVE_ENABLED:false;
export type DriverWorkspacePhase='not-configured'|'signed-out'|'loading'|
 'connected'|'offline'|'authorization-required';
export type DriverWorkspaceSnapshot=Readonly<{
 phase:DriverWorkspacePhase;
 offers:ReadonlyArray<DriverOffer>;
 documents:ReadonlyArray<DriverDocumentStatus>;
 currentLicenseApproved:boolean;
 driverEligible:false;
 liveEnabled:false;
}>;
export type DriverWorkspaceSession={
 readonly role:'driver';
 readonly userId:string;
 readonly accessToken:string;
};
export type DriverAuthSessionAdapter={
 getSession():Promise<DriverWorkspaceSession|null>;
 /** Must announce logout, refresh, role or account changes before next read. */
 subscribe?(notify:()=>void):()=>void;
};
export type DriverWorkspaceController=Readonly<{
 current():DriverWorkspaceSnapshot;
 subscribe(listener:(value:DriverWorkspaceSnapshot)=>void):()=>void;
 invalidate():DriverWorkspaceSnapshot;
 refresh():Promise<DriverWorkspaceSnapshot>;
 /** Foreground-only, coalesced QA refresh without loading flicker. */
 poll():Promise<DriverWorkspaceSnapshot>;
}>;
export type DriverWorkspaceControllerOptions={
 authAdapter?:DriverAuthSessionAdapter|null;
 apiOrigin?:string|null;
 approvedStagingHost?:string|null;
 allowedByOwner?:boolean;
 request?:typeof fetch;
 now?:()=>number;
 readInbox?:(input:Record<string,unknown>)=>Promise<ReadonlyArray<DriverOffer>>;
 readDocuments?:(input:Record<string,unknown>)=>Promise<ReadonlyArray<DriverDocumentStatus>>;
 readLicense?:(input:Record<string,unknown>)=>Promise<DriverLicenseReviewSnapshot>;
};
export declare function createDriverWorkspaceController(
 options?:DriverWorkspaceControllerOptions
):DriverWorkspaceController;
