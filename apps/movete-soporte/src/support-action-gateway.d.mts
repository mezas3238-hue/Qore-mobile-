export declare function enqueueSupportAction(
 supabase:any,
 raw:unknown,
 options?:{approved?:boolean;now?:()=>number}
):Promise<
 | Readonly<{ok:true;request_id:string;outcome:'QUEUED';ticket_id:string}>
 | Readonly<{ok:false;code:string}>
>;
