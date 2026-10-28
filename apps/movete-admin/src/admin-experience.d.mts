export type AdminKycRecord={
 vehicleId:string;vehicleKind:'AUTO'|'MOTO_DELIVERY';applicationStatus:string;
 licenseStatus:string;insuranceStatus:string;inspectionStatus:string;reviewRevision:number;
};
export type PageState={pageNumber:number;hasNext:boolean;hasPrevious:boolean;nextCursor:string|null};
import type {MerchantCasePageSuccess} from './merchant-case-page.mjs';
import type {F1AdminTripAudit} from './f1-auto-ride-audit-gateway.mjs';
import type {TraceServiceKind,ServiceTrace} from './service-trace-gateway.mjs';
export type AdminSnapshot={
 authenticated:boolean;
 merchantCases:MerchantCasePageSuccess|null;
 f1RideAudit:{contractReady:boolean;loading:boolean;item:F1AdminTripAudit|null;
  error:string|null;qaOnly:true;productionEnabled:false};
 serviceTrace:{contractReady:boolean;loading:boolean;item:ServiceTrace|null;
  error:string|null;qaOnly:true;productionEnabled:false};
 merchantCaseContractReady:false;
 account:{subject:string;role:'admin'|'owner';mfaVerified:true}|null;
 kyc:{revision:number;generatedAt:number;expiresAt:number;items:readonly Readonly<AdminKycRecord>[]} |null;
 finance:{period:{from:string;to:string;timezone:'America/Asuncion'};currency:'PYG';
  revision:number;ledgerRevision:number;reconciliationStatus:'RECONCILED';generatedAt:number;expiresAt:number;
  totals:{completedRides:number;completedDeliveries:number;completedMerchantOrders:number;
   grossCollectedGs:number;driverPayoutGs:number;platformCommissionGs:number;refundsGs:number;
   processingFeesGs:number;netPlatformGs:number}}|null;
 zones:{revision:number;expiresAt:number;items:readonly {
   zoneId:string;municipality:string;serviceKind:'AUTO_RIDE'|'MOTO_RIDE'|'DELIVERY_AUTO'|'DELIVERY_MOTO'|'COMMERCE';
   legalGate?:'CLEARED'|'G38_BLOCKED'|'G71_BLOCKED'|'UNVERIFIED';
   merchantEligibilityVerified?:boolean;
   coverageStatus:string;eligibleByPolicy:boolean;onDutyVehicles:number|null;
   availabilityFresh:boolean;availabilityConfirmed:false;
 }[]}|null;
 incidents:{revision:number;expiresAt:number;items:readonly {
  incidentId:string;category:string;severity:string;status:string;
  createdAt:number;revision:number;
 }[]}|null;
 globalTriage:{contractReady:boolean;loading:boolean;pageNumber:number;hasNext:boolean;hasPrevious:boolean;
  severityFilter:string|null;statusFilter:string|null;error:string|null;
  globalTotalKnown:false;emergencyDispatchEnabled:false;
  page:{scope:'SERVER_FILTERED_PAGE_ONLY';expiresAt:number;nextCursor:string|null;
   severityFilter:string|null;statusFilter:string|null;
   items:readonly {incidentId:string;category:string;severity:string;
    status:string;createdAt:number;revision:number}[];
   hasGlobalTotal:false;snapshotConsistent:false;
   emergencyDispatchEnabled:false}|null;}|null;
 audit:{revision:number;expiresAt:number;items:readonly {
  eventId:string;actorRole:string;operation:string;targetKind:string;
  outcome:string;occurredAt:number;revision:number;
 }[]}|null;
 pagination:{
  kyc:PageState;zones:PageState;incidents:PageState;audit:PageState;
 };
 actionsEnabled:false;
};
export type AdminExperience={
 subscribe:(callback:()=>void)=>()=>void;
 refreshSession:()=>Promise<{ok:boolean;code?:string}>;
 logout:()=>Promise<{ok:boolean;code?:string}>;
 clear:()=>void;
 readKyc:(data:unknown)=>boolean;
 readFinance:(data:unknown)=>boolean;
 readZones:(data:unknown)=>boolean;
 readIncidents:(data:unknown)=>boolean;
 readAudit:(data:unknown)=>boolean;
 isReadConfigured:(operation:string)=>boolean;
 syncFromServer:(operation:string,direction?:'refresh'|'reset'|'next'|'previous')=>Promise<{ok:boolean;code?:string}>;
 loadGlobalIncidentTriage:(args?:{severityFilter?:string|null;statusFilter?:string|null;next?:boolean;previous?:boolean})=>
  Promise<{ok:boolean;code?:string;pageNumber?:number;hasNext?:boolean;hasPrevious?:boolean}>;
 loadF1RideAudit:(tripId:string)=>Promise<{ok:boolean;code?:string;qaOnly?:true;productionEnabled?:false}>;
 clearF1RideAudit:()=>void;
 loadServiceTrace:(kind:TraceServiceKind,id:string)=>Promise<{ok:boolean;code?:string}>;
 clearServiceTrace:()=>void;
 reviewVehicle:(dto:unknown)=>Promise<{ok:boolean;code?:string;refreshRequired?:boolean}>;
 snapshot:()=>AdminSnapshot;
};
export declare function createAdminExperience(options?:{
 authProvider?:{readSession:()=>unknown|Promise<unknown>;signOut?:()=>unknown|Promise<unknown>}|null;
 gateway?:{isConfigured:()=>boolean;reviewVehicle:(body:unknown)=>unknown|Promise<unknown>}|null;
 serviceTraceOptions?:{
  enabled?:boolean;contractCertified?:boolean;
  origin?:string;pinnedOrigin?:string;
  fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
  timeoutMs?:number;maxBytes?:number;
 }|null;
 f1RideAuditOptions?:{
  enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
  origin?:string;pinnedOrigin?:string;
  fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
  timeoutMs?:number;maxBytes?:number;
 }|null;
 triageGatewayOptions?:{
  enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
  origin?:string;pinnedOrigin?:string;
  fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
  timeoutMs?:number;maxBytes?:number;
 }|null;
 readGatewayOptions?:{
  enabled?:boolean;certifiedContracts?:string[];origin?:string;pinnedOrigin?:string;
  fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
  timeoutMs?:number;maxBytes?:number;
 }|null;
 now?:()=>number;
}):AdminExperience;
