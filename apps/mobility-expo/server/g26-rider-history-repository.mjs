/**
 * G26.1 — unlimited TOTAL own history, bounded page size, server-scoped keyset.
 * Every request reads at most PAGE_SIZE+1 rows per source and merges them.
 * Continuation uses (created_at,id,kind) descending, never SQL offset.
 * All three sources are required; errors are fail closed, not empty history.
 * No public deployment or credentials in this module.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HISTORY_PAGE_SIZE=50;
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
const OWN_TIME=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(?:Z|\+00:00)$/;
function normalizedUtc(t){
 if(typeof t!=='string')throw Error('Malformed history time');
 const m=OWN_TIME.exec(t);
 if(!m)throw Error('History timestamps must be UTC');
 const value=m[1]+'.'+(m[2]||'').padEnd(6,'0')+'Z';
 if(!Number.isFinite(Date.parse(value)))throw Error('History time unavailable');
 return value;
}
function validPosition(position){
 return position===null||(position&&typeof position==='object'&&
  typeof position.time==='string'&&
  normalizedUtc(position.time)===position.time&&
  typeof position.id==='string'&&UUID.test(position.id)&&
  config.some(t=>t.kind===position.kind));
}
export function createQoreOwnHistoryRepository(client){
 if(!client||typeof client.from!=='function')
  throw Error('Server-only private history DB required');
 return async({ownerId,anchorMs,after=null})=>{
  if(typeof ownerId!=='string'||!UUID.test(ownerId)||
    !Number.isSafeInteger(anchorMs)||anchorMs<0||!validPosition(after))
   throw Error('Invalid owner history page');
  const anchor=new Date(anchorMs).toISOString();
  const pages=await Promise.all(config.map(async({table,actor,kind,statuses})=>{
   // Mandatory SQL owner filter on EVERY source; no caller-controlled owner.
   let q=client.from(table).select(`id,${actor},status,revision,created_at`)
    .eq(actor,ownerId).lte('created_at',anchor);
   if(after!==null){
    // Descending (time,id,kind) lexicographic keyset.
    // With equal timestamp + id, only lexicographically LOWER kinds follow.
    const op=kind<after.kind?'lte':'lt';
    q=q.or(`created_at.lt.${after.time},and(created_at.eq.${after.time},id.${op}.${after.id})`);
   }
   const {data,error}=await q.order('created_at',{ascending:false})
    .order('id',{ascending:false}).limit(HISTORY_PAGE_SIZE+1);
   if(error||!Array.isArray(data)||data.length>HISTORY_PAGE_SIZE+1)
    throw Error('Own history query unavailable');
   return data.map(row=>{
    if(!row||row[actor]!==ownerId||
      typeof row.id!=='string'||!UUID.test(row.id)||
      !Object.hasOwn(statuses,row.status)||
      !Number.isSafeInteger(row.revision)||row.revision<1)
     throw Error('Own history row invalid');
    const time=normalizedUtc(row.created_at);
    const createdAt=Date.parse(time);
    if(createdAt>anchorMs||after!==null&&
      (time>after.time||(time===after.time&&
       (row.id>after.id||(row.id===after.id&&kind>=after.kind)))))
     throw Error('Own history keyset mismatch');
    return {serviceId:row.id,kind,status:statuses[row.status],
     createdAt,revision:row.revision,time};
   });
  }));
  const rows=pages.flat().sort((a,b)=>
   b.time.localeCompare(a.time)||b.serviceId.localeCompare(a.serviceId)||
   b.kind.localeCompare(a.kind));
  // Client keyed by serviceId; never feed ambiguous IDs within one page.
  const top=rows.slice(0,HISTORY_PAGE_SIZE);
  if(new Set(top.map(x=>x.serviceId)).size!==top.length)
   throw Error('History identifier collision');
  const last=top.at(-1);
  return {
   items:top.map(({serviceId,kind,status,createdAt,revision})=>({
    serviceId,kind,status,createdAt,revision
   })),
   nextPosition:rows.length>HISTORY_PAGE_SIZE?
    {time:last.time,id:last.serviceId,kind:last.kind}:null
  };
 };
}
