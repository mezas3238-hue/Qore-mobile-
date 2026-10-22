import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticScenario,ORCHESTRATOR_LIVE_ENABLED} from './staging-e2e-orchestrator.mjs';
const zone={id:'asuncion_test',country:'PY',mode:'SYNTHETIC_STAGING',liveEnabled:false,status:'test_enabled',allowedServices:['AUTO'],polygon:[]};
const point={lat:-25.3,lng:-57.6};
const driver=id=>({id,mode:'SYNTHETIC_STAGING',suspended:false,identityVerified:true,licenseVerified:true,consentGranted:true,licenseExpiresAtMs:3000});
const vehicle=id=>({id:'v_'+id,driverId:id,status:'approved',service:'AUTO',insuranceVerified:true,registrationVerified:true,insuranceExpiresAtMs:3000});
test('two eligible drivers compete, one accepted, passenger sees result',()=>{
 const s=createSyntheticScenario({now:()=>1000,insidePolygon:()=>true});assert.equal(ORCHESTRATOR_LIVE_ENABLED,false);
 assert.equal(s.start({rideId:'r1',passengerId:'p1',zone,point}).ok,true);
 for(const id of ['a','b'])assert.equal(s.propose({rideId:'r1',driverId:id,driver:driver(id),vehicle:vehicle(id),expiresAtMs:2000}).ok,true);
 assert.equal(s.accept({rideId:'r1',driverId:'a'}).ok,true);
 assert.equal(s.accept({rideId:'r1',driverId:'b'}).ok,false);
 assert.equal(s.snapshot({rideId:'r1',actorId:'p1'}).driverId,'a');
 assert.equal(s.transition({rideId:'r1',actorId:'a',event:'arrive'}).status,'arriving');
});
test('zone and driver eligibility prevent offers',()=>{
 const s=createSyntheticScenario({now:()=>1000,insidePolygon:()=>false});assert.equal(s.start({rideId:'r',passengerId:'p',zone,point}).ok,false);
 const t=createSyntheticScenario({now:()=>1000,insidePolygon:()=>true});t.start({rideId:'r',passengerId:'p',zone,point});
 assert.equal(t.propose({rideId:'r',driverId:'a',driver:{...driver('a'),suspended:true},vehicle:vehicle('a'),expiresAtMs:2000}).ok,false);
 assert.equal(t.accept({rideId:'r',driverId:'a'}).ok,false);
});

test('driver offer expires when license or insurance expires before offer deadline',()=>{
 let clock=1000;
 const s=createSyntheticScenario({now:()=>clock,insidePolygon:()=>true});
 assert.equal(s.start({rideId:'exp1',passengerId:'p1',zone,point}).ok,true);
 assert.equal(s.propose({rideId:'exp1',driverId:'a',driver:{...driver('a'),licenseExpiresAtMs:1500},vehicle:vehicle('a'),expiresAtMs:2000}).ok,true);
 clock=1500;
 assert.equal(s.accept({rideId:'exp1',driverId:'a'}).ok,false);
});
