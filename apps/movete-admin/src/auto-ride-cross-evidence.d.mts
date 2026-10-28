import type {F1AdminTripAudit} from './f1-auto-ride-audit-gateway.mjs';
import type {ServiceTrace} from './service-trace-gateway.mjs';
export type AutoRideCrossEvidence=Readonly<{
 ok:boolean;code:string;financiallyReconciled:boolean;
}>;
export declare function inspectAutoRideCrossEvidence(opts:{
 trace:ServiceTrace|null|undefined;
 f1:F1AdminTripAudit|null|undefined;
 now?:number;
}):AutoRideCrossEvidence;
