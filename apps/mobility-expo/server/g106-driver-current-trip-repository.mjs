/** Server-only PostgreSQL projection; the G3 unique active-Driver index
 * rejects competing assignments. Never select Passenger or location data. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE=['accepted','arriving','in_progress'];
export function createG106DriverCurrentTripRepository({db}={}){
 if(!db||typeof db.from!=='function')
  throw Error('G106 private server PostgreSQL client required');
 return Object.freeze({
  async loadCurrentAssignedTrip({actorId}={}){
   if(typeof actorId!=='string'||!UUID.test(actorId))
    throw Error('Verified Driver scope required');
   const result=await db.from('mobility_stage_auto_demo_trips')
    .select('id,driver_id,status,revision')
    .eq('driver_id',actorId).in('status',ACTIVE).limit(2);
   if(result?.error||!Array.isArray(result?.data)||result.data.length>1)
    throw Error('G106 ambiguous/unavailable SQL');
   if(result.data.length===0)return null;
   const row=result.data[0];
   if(!row||Object.keys(row).length!==4||
    row.driver_id!==actorId||!UUID.test(row.id)||
    !ACTIVE.includes(row.status)||!Number.isSafeInteger(row.revision)||
    row.revision<2)throw Error('G106 untrusted SQL projection');
   return Object.freeze({tripId:row.id,driverId:actorId,
    status:row.status,revision:row.revision});
  }
 });
}
