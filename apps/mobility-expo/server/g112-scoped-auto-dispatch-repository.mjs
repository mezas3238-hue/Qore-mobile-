/**
 * G112 backend-only PostgreSQL RPC. NO global queue iteration.
 * The authenticated G73 gateway supplies Passenger identity from the token.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const G112_LIVE_ENABLED=false;
export function createG112ScopedAutoDispatchRepository(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('G112 server PostgreSQL RPC required');
 return Object.freeze({
  async runForBooking({passengerId,bookingKey,tripId}={}){
   if(![passengerId,bookingKey,tripId].every(x=>typeof x==='string'&&UUID.test(x)))
    throw Error('G112 verified booking scope required');
   const {data,error}=await client.rpc(
    'mobility_stage_g112_run_booked_auto_dispatch_qa',{
     _passenger_id:passengerId,_booking_key:bookingKey,_trip_id:tripId
    });
   if(error||!plain(data)||data.mode!=='STAGING_DEMO_ONLY'||
    data.commercialEnabled!==false)throw Error('G112 SQL worker unavailable');
   return data;
  }
 });
}
