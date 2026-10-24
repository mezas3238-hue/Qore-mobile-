export type G40IncidentState='open'|'triaged'|'investigating'|'resolved'|'dismissed';
export interface G40Receipt {
 readonly incidentId:string;readonly receiptId:string;
 readonly state:G40IncidentState;readonly revision:number;
 readonly createdAt:string;readonly observedAt:string;
 readonly receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY';
}
export interface G40StatusInput {
 readonly phase:string;readonly statusFresh:boolean;
 readonly contractReady:boolean;readonly qaDatabaseOnly:true;
 readonly sosDispatched:false;readonly operatorNotified:false;
 readonly receipt:G40Receipt|null;
}
export type G40StatusView=Readonly<{
 verified:boolean;code:string;label:string;description:string;
 receiptId:string|null;incidentId:string|null;revision:number|null;
 observedAt:string|null;qaOnly:true;operatorNotified:false;
 sosDispatched:false;merchantContacted:false;humanSupportConfirmed:false;
}>;
export declare function projectQaIncidentStatusView(
 report:G40StatusInput,
 options?:{authenticated?:boolean;now?:number}
):G40StatusView;
