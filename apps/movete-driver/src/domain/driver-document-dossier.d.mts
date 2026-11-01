export type DriverDocumentKind='licencia'|'identidad_frente'|'identidad_dorso'|'cedula_verde'|'habilitacion'|'seguro'|'inspeccion'|'rostro_selfie';
export declare const DOCUMENT_KINDS:readonly DriverDocumentKind[];
export type DriverDocumentDossier=Readonly<{
 session:'unverified'|'invalid'|'connected';
 entries:readonly Readonly<{kind:DriverDocumentKind;state:'unknown'|'missing'|'pending'|'approved'|'rejected';serverVerified:boolean}>[];
 driverEligible:false;vehicleApproved:false;mayDispatch:false;
 identityVerified:false;readyForCommercialUse:false;
}>;
export declare function buildPrivateDriverDocumentDossier(
 args?:{connected?:boolean;documents?:readonly {kind:string;status:string}[]}
):DriverDocumentDossier;
