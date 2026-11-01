export type DriverOfflineQaKey=
 'permission_prompt'|'ocr_consistent'|'ocr_conflict'|
 'autocapture_or_manual'|'background_discards'|'local_photos_absent';
export declare const DRIVER_OFFLINE_QA_CHECKS:readonly DriverOfflineQaKey[];
export type DriverOfflineQaChecklist=Readonly<{
 valid:boolean;count:number;total:number;
 entries:readonly Readonly<{kind:DriverOfflineQaKey;observed:boolean}>[];
 certified:false;driverEligible:false;mayDispatch:false;
}>;
export declare function buildDriverOfflineQaChecklist(
 raw?:Partial<Record<DriverOfflineQaKey,boolean>>
):DriverOfflineQaChecklist;
