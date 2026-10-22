/** QORE driver eligibility: synthetic staging only, no authorization for live rides. */
export const DRIVER_ELIGIBILITY_LIVE_ENABLED=false;
const services=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const fail=reason=>({ok:false,reason,liveEnabled:false});
const validDate=x=>Number.isSafeInteger(x)&&x>=0;
export function evaluateStagingDriver({driver,vehicle,service,nowMs}={}){
 if(!driver||!vehicle||!services.has(service)||!validDate(nowMs))return fail('Invalid eligibility input');
 if(driver.mode!=='SYNTHETIC_STAGING'||driver.suspended!==false||driver.identityVerified!==true||driver.licenseVerified!==true||driver.consentGranted!==true)return fail('Driver not verified');
 if(vehicle.driverId!==driver.id||vehicle.status!=='approved'||vehicle.service!==service||vehicle.insuranceVerified!==true||vehicle.registrationVerified!==true)return fail('Vehicle not approved');
 if(!validDate(driver.licenseExpiresAtMs)||driver.licenseExpiresAtMs<=nowMs||!validDate(vehicle.insuranceExpiresAtMs)||vehicle.insuranceExpiresAtMs<=nowMs)return fail('Documents expired');
 if(service==='MOTO'&&driver.motoPassengerPermitVerified!==true)return fail('Motorcycle passenger permit not verified');
 return {ok:true,driverId:driver.id,vehicleId:vehicle.id,liveEnabled:false,dispatchAuthorized:false};
}
