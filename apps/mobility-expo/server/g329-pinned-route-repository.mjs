/** G329: private server-only PostgreSQL 17 adapter, STAGING/QA OFF by default.
 * No browser, GPS, payment or driver authority. The injected client MUST be a
 * protected backend service-role client. SQL grants only service_role EXECUTE.
 */
import {validG328Point} from './g328-pinned-auto-evidence.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const positive=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,fields)=>obj(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const fields=['mode','commercialEnabled','ownerId','routeId','requestKey',
 'service','routingVerified','expiresAt','pinEvidenceId','pinBound'];
const secureRpc=async(client,name,params)=>{
 let result;
 try{result=await client.rpc(name,params);}
 catch{throw Error('G329 private database unavailable');}
 if(result?.error)throw Error('G329 private database unavailable');
 return result?.data;
};
export function createG329PinnedAutoRepository({
 client,enabled=false,now=Date.now
}={}){
 if(!client||typeof client.rpc!=='function'||typeof now!=='function')
  throw Error('G329 requires server-only SQL adapter');
 const active=enabled===true;
 return Object.freeze({
  enabled:active,
  async assertPinnedSchemaReady(){
   if(!active)throw Error('G329 pinned route SQL not enabled');
   // A NO-WRITE owner-scoped RPC probe proves the G329 SQL migration and
   // service_role EXECUTE grants exist before the runtime accepts requests.
   // A fixture returning anything except null is not the required private RPC.
   const nil='00000000-0000-0000-0000-000000000000';
   const probe=await secureRpc(client,'mobility_stage_g329_route_pinned_receipt',{
    _passenger_id:nil,_route_id:nil
   });
   if(probe!==null)throw Error('G329 pinned route database readiness unverified');
   return true;
  },
  async registerPinnedRoute(p){
   if(!active)throw Error('G329 pinned route SQL not enabled');
   const at=now();
   if(!obj(p)||!UUID.test(p.actorId??'')||!UUID.test(p.requestKey??'')||
    !UUID.test(p.pinEvidenceId??'')||!SERVICES.has(p.service)||
    !tag(p.originTag)||!tag(p.destinationTag)||!tag(p.zoneTag)||
    p.originTag===p.destinationTag||
    !positive(p.distanceMeters,1,500000)||
    !positive(p.durationSeconds,1,86400)||!positive(p.tollsPyg,0,1000000)||
    !validG328Point(p.pickupPoint)||!validG328Point(p.dropoffPoint)||
    (p.pickupPoint.latitude===p.dropoffPoint.latitude&&
     p.pickupPoint.longitude===p.dropoffPoint.longitude)||
    !positive(p.verifiedAtMs,1,9000000000000)||
    !positive(at,1,9000000000000)||
    at-p.verifiedAtMs<0||at-p.verifiedAtMs>60000)
    throw Error('G329 missing independently verified pinned route');
   const routeId=await secureRpc(client,'mobility_stage_g329_route_pinned',{
    _passenger_id:p.actorId,_request_key:p.requestKey,_service:p.service,
    _origin_tag:p.originTag,_destination_tag:p.destinationTag,
    _zone_tag:p.zoneTag,_distance_meters:p.distanceMeters,
    _duration_seconds:p.durationSeconds,_tolls_pyg:p.tollsPyg,
    _pin_evidence_id:p.pinEvidenceId,
    _pickup_latitude:p.pickupPoint.latitude,
    _pickup_longitude:p.pickupPoint.longitude,
    _dropoff_latitude:p.dropoffPoint.latitude,
    _dropoff_longitude:p.dropoffPoint.longitude,
    _verified_at_ms:p.verifiedAtMs
   });
   if(typeof routeId!=='string'||!UUID.test(routeId))
    throw Error('G329 route not persisted');
   return routeId;
  },
  async loadPinnedRoute({actorId,routeId,pinEvidenceId=null}={}){
   if(!active)throw Error('G329 pinned route SQL not enabled');
   if(!UUID.test(actorId??'')||!UUID.test(routeId??'')||
     (pinEvidenceId!==null&&!UUID.test(pinEvidenceId)))
    throw Error('G329 invalid private route scope');
   const receipt=await secureRpc(client,
    'mobility_stage_g329_route_pinned_receipt',{
     _passenger_id:actorId,_route_id:routeId
    });
   if(receipt===null)return null;
   const at=now();
   if(!exact(receipt,fields)||
    receipt.mode!=='STAGING_DEMO_ONLY'||receipt.commercialEnabled!==false||
    receipt.ownerId!==actorId||receipt.routeId!==routeId||
    !UUID.test(receipt.requestKey??'')||
    !SERVICES.has(receipt.service)||receipt.routingVerified!==true||
    receipt.pinBound!==true||!UUID.test(receipt.pinEvidenceId??'')||
    (pinEvidenceId!==null&&receipt.pinEvidenceId!==pinEvidenceId)||
    !Number.isSafeInteger(receipt.expiresAt)||receipt.expiresAt<=at||
    receipt.expiresAt>at+3600000)
    throw Error('G329 owner-scoped pin readback unverified');
   return Object.freeze({...receipt});
  }
 });
}
