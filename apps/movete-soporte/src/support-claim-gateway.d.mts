export declare function claimSupportCase(supabase:any,raw:unknown,options?:{
 approved?:boolean;now?:()=>number
}):Promise<
 Readonly<{ok:true;claim_id:string;ticket_id:string;outcome:'CLAIMED'}>
 |Readonly<{ok:false;code:string}>
>;
