/** G18 service-role-only exclusive Driver role transition. STAGING QA.
 * No signup, payment, license approval, vehicle enablement or online status.
 */
export const G18_ENROLLMENT_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
export function createDriverEnrollmentRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted G18 PostgreSQL client required');
 return Object.freeze({
  async enroll({driverId,requestKey,consent}={}){
   if(!id(driverId)||!id(requestKey)||consent!==true)
    throw Error('Invalid G18 Driver enrollment');
   const result=await rpc('mobility_stage_enroll_exclusive_driver',{
    _driver_id:driverId,_request_key:requestKey,_consent:true
   });
   if(!result||result.error||!id(result.data))
    throw Error('G18 Driver role enrollment failed closed');
   return result.data;
  }
 });
}
