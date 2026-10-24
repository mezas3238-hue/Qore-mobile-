/**
 * G58 A41 — restricted SQL executor for isolated PostgreSQL16 QA.
 * This is NOT a user JWT authority or ticket mint. Ticket minting stays a
 * completely separate trusted fixture. No deployed DB login or HTTP wiring.
 * SQL role/function names are constants; user never controls identifiers.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const DRIVER='mobility_g56_driver_gateway_ci';
const PASSENGER='mobility_g49_chat_gateway_ci';
const rules=Object.freeze({
 CHAT_OPEN:{role:PASSENGER,
  sql:'SELECT public.mobility_stage_g49_open_qa($1) AS data',
  keys:['operation','ticket']},
 DRIVER_INBOX:{role:DRIVER,
  sql:'SELECT public.mobility_stage_g56_driver_inbox_qa($1,$2,$3,$4,$5) AS data',
  keys:['operation','ticket','expectedRevision','beforeMs','beforeId','limit']},
 DRIVER_HISTORY_ORDERED_MARKERS:{role:DRIVER,
  sql:'SELECT public.mobility_stage_g57b_driver_history_markers_qa($1,$2,$3,$4) AS data',
  keys:['operation','ticket','expectedRevision','beforeSeq','limit']},
 DRIVER_MARK_VISIBLE_ORDERED:{role:DRIVER,
  sql:'SELECT public.mobility_stage_g57b_driver_mark_visible_qa($1,$2) AS data',
  keys:['operation','ticket','marker']},
 CHAT_HISTORY_ORDERED_MARKERS:{role:PASSENGER,
  sql:'SELECT public.mobility_stage_g57_history_markers_qa($1,$2,$3,$4) AS data',
  keys:['operation','ticket','expectedRevision','beforeSeq','limit']},
 CHAT_MARK_VISIBLE_ORDERED:{role:PASSENGER,
  sql:'SELECT public.mobility_stage_g57_mark_visible_ordered_qa($1,$2) AS data',
  keys:['operation','ticket','marker']}
});
function parse(c){
 if(!plain(c)||typeof c.operation!=='string'||!Object.hasOwn(rules,c.operation))
  return null;
 const r=rules[c.operation];
 if(!exact(c,r.keys)||!uuid(c.ticket))return null;
 if(c.operation==='CHAT_OPEN')return {rule:r,args:[c.ticket]};
 if(c.operation.endsWith('MARK_VISIBLE_ORDERED')){
  if(!uuid(c.marker))return null;
  return {rule:r,args:[c.ticket,c.marker]};
 }
 if(c.operation==='DRIVER_INBOX'){
  if(!(c.expectedRevision===null||integer(c.expectedRevision)&&c.expectedRevision>0)||
   !(c.beforeMs===null||integer(c.beforeMs))||
   !(c.beforeId===null||uuid(c.beforeId))||
   (c.beforeId===null)!==(c.beforeMs===null)||
   (c.beforeMs!==null&&c.expectedRevision===null)||
   !integer(c.limit)||c.limit<1||c.limit>100)return null;
  return {rule:r,args:[c.ticket,c.expectedRevision,c.beforeMs,c.beforeId,c.limit]};
 }
 if(!(c.expectedRevision===null||integer(c.expectedRevision)&&c.expectedRevision>0)||
  !(c.beforeSeq===null||integer(c.beforeSeq)&&c.beforeSeq>0)||
  (c.beforeSeq===null)!==(c.expectedRevision===null)||
  !integer(c.limit)||c.limit<1||c.limit>100)return null;
 return {rule:r,args:[c.ticket,c.expectedRevision,c.beforeSeq,c.limit]};
}
const allowedErrors=new Set([
 'G5001','G5003','G5004','G5209','G5401','G5402','G5403','G5404',
 'G5405','G5601','G5602','G5603','G5604','G5605','G5609',
 'G5611','G5612','G5613','G5615','G5619',
 'G5702','G5703','G5705','G5708','G5709',
 'G5711','G5712','G5713','G5714','G5715','G5718','G5719'
]);
export function createG58DelegatedChatSqlQa({
 environment,localQaOnly,liveEnabled,openConnection
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||typeof openConnection!=='function')
  throw Error('G58 delegated executor requires disposable QA connection factory');
 return Object.freeze({async executeScopedTicket(command){
  const chosen=parse(command);
  if(!chosen)return {error:{code:'G5802'}};
  let db,started=false,committed=false;
  try{
   db=await openConnection();
   if(db===null||typeof db!=='object'||typeof db.query!=='function'||typeof db.release!=='function')
    throw Error('G58 SQL connection factory invalid');
   await db.query('BEGIN');
   started=true;
   // Server-side immutable ceilings protect against a SQL call outliving
   // the Node deadline; these settings reset at COMMIT/ROLLBACK.
   await db.query("SET LOCAL statement_timeout = '2500ms'");
   await db.query("SET LOCAL lock_timeout = '500ms'");
   await db.query("SET LOCAL idle_in_transaction_session_timeout = '3500ms'");
   // Exact constant role only; SET LOCAL resets on every transaction end.
   await db.query('SET LOCAL ROLE '+chosen.rule.role);
   const who=await db.query(
    "SELECT current_user AS effective_role, current_database() AS database, current_setting('application_name') AS application_name"
   );
   const row=who?.rows?.[0];
   if(!plain(row)||row.effective_role!==chosen.rule.role||
    row.database!=='qore_disposable_chain'||
    row.application_name!=='qore_ci_disposable_chain')
    throw Error('G58 SQL role or local DB binding mismatch');
   const result=await db.query(chosen.rule.sql,chosen.args);
   if(!Array.isArray(result?.rows)||result.rows.length!==1||
    !plain(result.rows[0])||!Object.hasOwn(result.rows[0],'data')||
    !plain(result.rows[0].data))
    throw Error('G58 untrusted SQL result');
   await db.query('COMMIT');
   committed=true;
   return {data:result.rows[0].data};
  }catch(e){
   if(started&&!committed&&db?.query){
    try{await db.query('ROLLBACK');}catch{/* fail closed */}
   }
   // Do not reveal internal exception text or database details.
   return {error:{code:allowedErrors.has(e?.code)?e.code:'G5803'}};
  }finally{
   if(db?.release)try{await db.release();}catch{/* closed */}
  }
 }});
}
