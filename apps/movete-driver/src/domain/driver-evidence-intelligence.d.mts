export type DriverPlateReading=Readonly<{text:string;confidence:number}>;
export type DriverPlateComparison=Readonly<{
 state:'uncertain'|'mismatch'|'match_pending_review';
 reasons:readonly string[];reviewRequired:true;driverEligible:false;vehicleApproved:false;
}>;
export declare function normalizeDriverPlate(text:unknown):string|null;
export declare function compareDriverPlateEvidence(readings:unknown):DriverPlateComparison;
export type DriverCaptureFrame=Readonly<{
 width:number;height:number;luma:Uint8Array;motionRms:number|null;
 captureSource?:'mlkit-document-scanner';
 subjectBox?:Readonly<{x:number;y:number;width:number;height:number;confidence:number}>|null;
}>;
export type DriverCaptureQuality=Readonly<{
 ready:boolean;reasons:readonly string[];
 metrics:Readonly<{brightness:number;contrast:number;sharpness:number;interiorSharpness:number;interiorEdgeRatio:number;glareRatio:number}>|null;
 mayApprove:false;hardwareFocusCertified?:false;motionMeasured?:boolean;
}>;
export declare function assessDriverCaptureFrame(frame:DriverCaptureFrame):DriverCaptureQuality;
export declare function nextDriverAutoCaptureGate(input:{
 previousCount?:number;quality:Pick<DriverCaptureQuality,'ready'>;
 elapsedMs:number;minimumGapMs?:number;
}):Readonly<{takePhoto:boolean;nextCount:number}>;
