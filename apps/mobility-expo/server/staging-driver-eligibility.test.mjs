import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStagingDriver,DRIVER_ELIGIBILITY_LIVE_ENABLED} from './staging-driver-eligibility.mjs';
const driver={id:'d',mode:'SYNTHETIC_STAGING',suspended:false,identityVerified:true,licenseVerified:true,consentGranted:true,licenseExpiresAtMs:3000,motoPassengerPermitVerified:false};
const vehicle={id:'v',driverId:'d',status:'approved',service:'AUTO',insuranceVerified:true,registrationVerified:true,insuranceExpiresAtMs:3000};
const input={driver,vehicle,service:'AUTO',nowMs:1000};
test('eligible driver still cannot dispatch commercially',()=>{const r=evaluateStagingDriver(input);assert.equal(DRIVER_ELIGIBILITY_LIVE_ENABLED,false);assert.equal(r.ok,true);assert.equal(r.dispatchAuthorized,false);});
test('reject revoked identity, suspension, consent, mismatched vehicle',()=>{for(const patch of [{suspended:true},{identityVerified:false},{licenseVerified:false},{consentGranted:false},{licenseExpiresAtMs:1000}])assert.equal(evaluateStagingDriver({...input,driver:{...driver,...patch}}).ok,false);for(const patch of [{driverId:'other'},{status:'pending'},{insuranceVerified:false},{registrationVerified:false},{insuranceExpiresAtMs:1000}])assert.equal(evaluateStagingDriver({...input,vehicle:{...vehicle,...patch}}).ok,false);});
test('motorcycle passenger eligibility is separately gated',()=>{assert.equal(evaluateStagingDriver({...input,service:'MOTO',vehicle:{...vehicle,service:'MOTO'}}).ok,false);assert.equal(evaluateStagingDriver({...input,service:'MOTO',driver:{...driver,motoPassengerPermitVerified:true},vehicle:{...vehicle,service:'MOTO'}}).ok,true);});
