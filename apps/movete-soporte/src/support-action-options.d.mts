import type {SupportActionKind} from './support-action-contract.mjs';
export declare function allowedSupportActions(
 caseItem:{status:string;assigned_support_id:string|null}|null,
 agentId:string,
 enabled?:boolean
):ReadonlyArray<Readonly<{action:SupportActionKind;label:string}>>;
