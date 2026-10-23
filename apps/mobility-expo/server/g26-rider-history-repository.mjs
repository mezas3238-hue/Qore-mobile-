/**
 * G26 isolated STAGING Client history. Private read-only PostgreSQL/Supabase
 * gateway, no public grants or mobile SQL client. Initial QA page <=50 only:
 * refuse larger histories until cursor pagination is independently certified.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const config=[
 {table:'mobility_stage_auto_demo_trips',actor:'passenger_id',kind:'RIDE',
  statuses:{searching:'searching',accepted:'assigned',arriving:'assigned',
   in_progress:'in_progress',completed:'completed',cancelled:'cancelled'}},
 {table:'mobility_stage_deliveries',actor:'sender_id',kind:'DELIVERY',
  statuses:{requested:'searching',accepted:'assigned',picked_up:'in_progress',
   delivered:'completed',disputed:'failed',returned:'failed',cancelled:'cancelled'}},
 {table:'mobility_stage_merchant_orders',actor:'buyer_id',kind:'MERCHANT_ORDER',
  statuses:{requested:'searching',confirmed:'in_progress',preparing:'in_progress',
   ready:'in_progress',handed_to_courier:'in_progress',delivered:'completed',
   cancelled:'cancelled'}}
];
export function createQoreOwnHistoryRepository(client){
 if(!client||typeof client.from!=='function')throw Error('Server-side history DB client required');
 return async({ownerId,limit=51})=>{
  if(!UUID.test(ownerId??'')||limit!==51)
   throw Error('Invalid private history query');
  const pages=await Promise.all(config.map(async ({table,actor,kind,statuses})=>{
   // All scopes are enforced by the server, never client-provided ownerId.
   const {data,error}=await client.from(table)
    .select(`id,${actor},status,revision,created_at`)
    .eq(actor,ownerId).order('created_at',{ascending:false})
    .order('id',{ascending:false}).limit(51);
   if(error||!Array.isArray(data)||data.length>51)
    throw Error('History source unavailable');
   return data.map(row=>{
    if(!row||row[actor]!==ownerId||!UUID.test(row.id??'')||
      !Object.hasOwn(statuses,row.status)||
      !Number.isSafeInteger(row.revision)||row.revision<1||
      typeof row.created_at!=='string')
     throw Error('Private history mismatch');
    const createdAt=Date.parse(row.created_at);
    if(!Number.isSafeInteger(createdAt)||createdAt<0)
     throw Error('History clock corrupt');
    return {serviceId:row.id,kind,status:statuses[row.status],
     createdAt,revision:row.revision};
   });
  }));
  const rows=pages.flat().sort((a,b)=>b.createdAt-a.createdAt||
   b.serviceId.localeCompare(a.serviceId)||a.kind.localeCompare(b.kind));
  // Duplicate resource id across kinds is ambiguous for Client's stable ID map.
  if(new Set(rows.map(x=>x.serviceId)).size!==rows.length)
   throw Error('History ID collision');
  // Never silently hide older rows while claiming nextCursor:null.
  if(rows.length>50)throw Error('History requires certified pagination');
  return rows;
 };
}
