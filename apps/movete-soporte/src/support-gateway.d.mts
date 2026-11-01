export type SupportCase=Readonly<{
 ticket_id:string;case_code:string;category:'VIAJE_AUTO'|'VIAJE_MOTO'|'ENVIO_AUTO'|'ENVIO_MOTO'|'COMERCIO'|'CUENTA'|'OTRO';
 summary:string;status:'OPEN'|'IN_PROGRESS'|'WAITING_CUSTOMER'|'ESCALATED'|'RESOLVED';
 priority:'NORMAL'|'HIGH'|'CRITICAL';assigned_support_id:string|null;updated_at:string
}>;
export declare function readSupportCases(supabase:any,now?:()=>number):Promise<
 {ok:true;cases:readonly SupportCase[];live:false;readOnly:true}|
 {ok:false;code:string}
>;
