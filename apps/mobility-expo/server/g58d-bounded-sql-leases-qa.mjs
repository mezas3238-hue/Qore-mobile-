/**
 * G58D / A44: QA-only bounded DB leases for the G58 delegated executor.
 * Timeout never returns an in-flight connection to the pool: poisoned leases
 * are force-discarded through node-postgres release(true).
 * This is NOT a production pool or a network-exposed connection factory.
 */
function deadline(promise,ms){
 let timer;
 const limited=new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('G58D_SQL_DEADLINE')),ms);
 });
 return Promise.race([Promise.resolve(promise),limited])
  .finally(()=>clearTimeout(timer));
}
export function createG58DBoundedSqlLeasesQa({
 environment,localQaOnly,liveEnabled,openConnection,
 maxActive=4,acquireTimeoutMs=800,queryTimeoutMs=2500
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||typeof openConnection!=='function'||
  !Number.isInteger(maxActive)||maxActive<1||maxActive>16||
  !Number.isInteger(acquireTimeoutMs)||acquireTimeoutMs<10||
  acquireTimeoutMs>10000||!Number.isInteger(queryTimeoutMs)||
  queryTimeoutMs<10||queryTimeoutMs>10000)
  throw Error('G58D requires bounded QA SQL connection factory');
 let active=0;
 return Object.freeze({
  async openConnection(){
   if(active>=maxActive)throw Error('G58D_CONNECTION_CAPACITY_EXHAUSTED');
   active++;
   let timedOut=false,raw;
   const pending=Promise.resolve().then(()=>openConnection()).then(c=>{
    if(timedOut){
     if(c&&typeof c.release==='function')
      try{void Promise.resolve(c.release(true)).catch(()=>{});}catch{}
    }
    return c;
   });
   try{
    raw=await deadline(pending,acquireTimeoutMs);
    if(!raw||typeof raw!=='object'||
     typeof raw.query!=='function'||typeof raw.release!=='function')
     throw Error('G58D_INVALID_SQL_CONNECTION');
   }catch(error){
    timedOut=true;
    active--;
    // If the connection was returned despite invalid shape, discard it.
    if(raw&&typeof raw.release==='function')
     try{await raw.release(true);}catch{}
    throw error;
   }
   let closed=false,poisoned=false;
   return Object.freeze({
    async query(sql,params){
     if(closed||poisoned)throw Error('G58D_POISONED_SQL_CONNECTION');
     if(typeof sql!=='string'||sql.length>700||
      !(params===undefined||Array.isArray(params))){
      poisoned=true;throw Error('G58D_INVALID_QUERY_SHAPE');
     }
     try{
      return await deadline(Promise.resolve().then(()=>raw.query(sql,params)),
       queryTimeoutMs);
     }catch(e){poisoned=true;throw e;}
    },
    async release(force=false){
     if(closed)return;
     closed=true;
     active--;
     try{await raw.release(poisoned||force===true);}
     catch{/* caller remains fail-closed; no reuse of a poisoned lease */}
    }
   });
  }
 });
}
