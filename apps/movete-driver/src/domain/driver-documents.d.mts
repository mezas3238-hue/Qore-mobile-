export declare const DRIVER_DOCUMENTS_LIVE_ENABLED:false;
export type DriverEvidenceKind=
 'licencia'|'identidad_frente'|'identidad_dorso'|'cedula_verde'|
 'seguro'|'inspeccion'|'habilitacion';
export type DriverDocumentStatus=Readonly<{
 kind:DriverEvidenceKind;
 status:'pending'|'approved'|'rejected';
 submittedAtMs:number;
 reviewedAtMs:number|null;
}>;
export type DriverDocumentReadOptions={
 apiOrigin:string;
 accessToken:string;
 request?:(url:string,options:RequestInit)=>Promise<{
  status:number;json():Promise<unknown>;
 }>;
};
export declare function readDriverDocumentStatuses(
 options:DriverDocumentReadOptions
):Promise<ReadonlyArray<DriverDocumentStatus>>;
