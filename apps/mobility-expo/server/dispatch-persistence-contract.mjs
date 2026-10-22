/** QORE STAGING persistence boundary. Never falls back to in-memory dispatch. */
export const PERSISTENT_DISPATCH_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Repository methods must use authenticated, server-only SQL transactions.
 * Adapter is NOT a database implementation; it enforces safe invocation shape.
 */
export function createStagingDispatchPersistence(repository){
 const methods=['request','offer','accept','transition','snapshot'];
 if(!repository||methods.some(m=>typeof repository[m]!=='function'))throw Error('Incomplete dispatch repository');
 async function call(method,params){
  if(!params||params.mode!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||!validId(params.actorId)||!validId(params.tripId))return fail('Unauthenticated or non-staging request');
  if(method==='accept'&&(!validId(params.offerId)||!validId(params.decisionKey)))return fail('Invalid idempotency key or offer');
  try{
   const result=await repository[method](Object.freeze({...params}));
   if(!result||result.ok!==true||result.liveEnabled!==false)return fail('Unverified persistence response');
   return result;
  }catch{return fail('Persistence unavailable');}
 }
 return Object.freeze(Object.fromEntries(methods.map(m=>[m,params=>call(m,params)])));
}
