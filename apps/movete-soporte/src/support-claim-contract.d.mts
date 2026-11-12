export type SupportClaimIntent=Readonly<{ticket_id:string;idempotency_key:string}>;
export type SupportClaimReceipt=Readonly<{claim_id:string;ticket_id:string;outcome:'CLAIMED'}>;
export declare function parseSupportClaimIntent(input:unknown):SupportClaimIntent|null;
export declare function parseSupportClaimReceipt(input:unknown,intent:SupportClaimIntent):SupportClaimReceipt|null;
