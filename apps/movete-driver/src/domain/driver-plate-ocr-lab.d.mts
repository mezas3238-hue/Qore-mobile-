export type DriverPlateOcrSource='registration'|'vehicle'|'permit';
export declare const DRIVER_OCR_LAB_SOURCES:readonly DriverPlateOcrSource[];
export type DriverOcrSamples=Partial<Record<DriverPlateOcrSource,string[]>>;
export declare function extractDriverPlateCandidates(result:unknown):readonly string[];
export declare function compareDriverUnverifiedOcrSamples(samples:DriverOcrSamples):Readonly<{
 status:'unverified'|'text_conflict_pending_review'|'text_equal_pending_review';
 reason:string;driverEligible:false;vehicleApproved:false;
 evidenceVerified:false;confidenceVerified:false;requiresHumanReview:true;
 mayDispatch:false;
}>;
export declare function addDriverPlateOcrSample(
 samples:DriverOcrSamples,source:DriverPlateOcrSource,candidates:readonly string[]
):Readonly<{accepted:boolean;reason:string;samples:DriverOcrSamples}>;
