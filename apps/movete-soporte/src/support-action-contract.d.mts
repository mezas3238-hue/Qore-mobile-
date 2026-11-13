export type SupportActionKind =
 'ACKNOWLEDGE'|'REQUEST_INFORMATION'|'ESCALATE_SAFETY'|
 'ESCALATE_FINANCE'|'RESOLVE_INFORMATIONAL';
export type SupportActionStatus='OPEN'|'IN_PROGRESS'|'WAITING_CUSTOMER'|'ESCALATED';
export type SupportActionIntent=Readonly<{
 ticket_id:string;
 expected_status:SupportActionStatus;
 action:SupportActionKind;
 idempotency_key:string;
}>;
export type SupportActionReceipt=Readonly<{
 request_id:string;
 ticket_id:string;
 action:SupportActionKind;
 outcome:'QUEUED';
}>;
export declare const SUPPORT_ACTION_KINDS:readonly SupportActionKind[];
export declare const SUPPORT_ACTION_EXPECTED_STATUSES:readonly SupportActionStatus[];
export declare function parseSupportActionIntent(input:unknown):SupportActionIntent|null;
export declare function parseSupportActionReceipt(input:unknown,intent:SupportActionIntent):SupportActionReceipt|null;
