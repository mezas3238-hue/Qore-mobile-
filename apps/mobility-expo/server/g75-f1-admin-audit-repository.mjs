/** One private SQL witness; browser, Client and Driver cannot use RPC. */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function createG75AdminF1Repository(admin){
 if(!admin||typeof admin.rpc!=='function')throw Error('Server SQL client required');
 return Object.freeze({async read({actorId,tripId}={}){
  if(typeof actorId!=='string'||!ID.test(actorId)||
   typeof tripId!=='string'||!ID.test(tripId))
   throw Error('Invalid verified Admin SQL scope');
  const {data,error}=await admin.rpc('mobility_stage_g75_admin_f1_receipt',{
   _admin_id:actorId,_trip_id:tripId
  });
  if(error)throw Error('Private G75 SQL unavailable');
  return data;
 }});
}
