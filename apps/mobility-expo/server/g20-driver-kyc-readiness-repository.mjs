/** G20: server-role-only current-license gate, no LIVE eligibility claim. */
export const G20_LICENSE_READINESS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createDriverKycReadinessRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted G20 RPC required');
 return Object.freeze({
  async currentLicenseApproved({driverId}={}){
   if(typeof driverId!=='string'||!UUID.test(driverId))
    throw Error('Invalid verified Driver ID');
   const response=await rpc('mobility_stage_driver_current_license_approved',
    {_driver_id:driverId});
   if(!response||response.error||typeof response.data!=='boolean')
    throw Error('G20 document readiness not available');
   return response.data;
  }
 });
}
