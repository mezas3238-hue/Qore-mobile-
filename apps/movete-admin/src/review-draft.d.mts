export declare const TRAINING_CASES: readonly {
 readonly id:string;
 readonly label:string;
 readonly vehicleKind:string;
 readonly documentLabel:string;
}[];
export declare function createReviewDraft(input:{
 vehicleId:string;
 requestKey:string;
 approve:boolean;
 reason:string;
}):{ok:false;reason:string}|{ok:true;localOnly:true;submitted:false;summary:{
 caseLabel:string;approve:boolean;reason:string
}};
