/**
 * G328 — Opt-in, backend-only location pin evidence for G73 AUTO QA.
 * Mobile GPS and the Google Maps share sheet are USER INPUT, not coverage.
 * Requires an injected, independent, trusted server authority. No DB writes,
 * money operations, private map API keys, LIVE trips or fallback is possible.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const human=x=>typeof x==='string'&&x===x.trim()&&x.length>=3&&
 x.length<=120&&!/[\u0000-\u001f\u007f\u202a-\u202e]/u.test(x);
// Coarse bbox is an input sanity check, NOT a claim of coverage in Paraguay.
export function validG328Point(x){
 return exact(x,['latitude','longitude'])&&
 Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&
 x.latitude>=-27.8&&x.latitude<=-19.2&&
 x.longitude>=-62.9&&x.longitude<=-54.1;
}
export function validG328PinnedRouteBody(x){
 return exact(x,['quoteRequestKey','origin','destination','service',
  'pickupPoint','dropoffPoint'])&&
 UUID.test(x.quoteRequestKey??'')&&human(x.origin)&&
 human(x.destination)&&x.origin.toLocaleLowerCase('es-PY')!==
 x.destination.toLocaleLowerCase('es-PY')&&
 SERVICES.has(x.service)&&
 validG328Point(x.pickupPoint)&&validG328Point(x.dropoffPoint)&&
 (x.pickupPoint.latitude!==x.dropoffPoint.latitude||
  x.pickupPoint.longitude!==x.dropoffPoint.longitude);
}
const samePoint=(a,b)=>validG328Point(a)&&validG328Point(b)&&
 Object.is(a.latitude,b.latitude)&&Object.is(a.longitude,b.longitude);
const proofFields=['source','serverVerified','coverageVerified','actorId',
 'quoteRequestKey','origin','destination','service','pickupPoint',
 'dropoffPoint','evidenceId','revision','verifiedAtMs'];
function validProof(proof,input,actorId,time){
 return exact(proof,proofFields)&&
 proof.source==='INDEPENDENT_PIN_AUTHORITY'&&
 proof.serverVerified===true&&proof.coverageVerified===true&&
 proof.actorId===actorId&&proof.quoteRequestKey===input.quoteRequestKey&&
 proof.origin===input.origin&&proof.destination===input.destination&&
 proof.service===input.service&&
 samePoint(proof.pickupPoint,input.pickupPoint)&&
 samePoint(proof.dropoffPoint,input.dropoffPoint)&&
 UUID.test(proof.evidenceId??'')&&
 Number.isSafeInteger(proof.revision)&&proof.revision>=1&&
 Number.isSafeInteger(proof.verifiedAtMs)&&proof.verifiedAtMs>0&&
 proof.verifiedAtMs<=time&&time-proof.verifiedAtMs<=60000;
}
export async function admitG328PinnedAutoRoute({
 input,actorId,verifyIndependentPins,now=Date.now
}={}){
 if(!validG328PinnedRouteBody(input)||
  typeof actorId!=='string'||!UUID.test(actorId)||
  typeof verifyIndependentPins!=='function'||typeof now!=='function')
  return Object.freeze({ok:false,code:'PIN_INPUT_INVALID'});
 const at=now();
 if(!Number.isSafeInteger(at)||at<=0)
  return Object.freeze({ok:false,code:'PIN_AUTHORITY_UNAVAILABLE'});
 let proof;
 try{
  const trustedScope=Object.freeze({
   actorId,quoteRequestKey:input.quoteRequestKey,
   origin:input.origin,destination:input.destination,
   service:input.service,
   pickupPoint:Object.freeze({...input.pickupPoint}),
   dropoffPoint:Object.freeze({...input.dropoffPoint})
  });
  proof=await verifyIndependentPins(trustedScope);
 }catch{return Object.freeze({ok:false,code:'PIN_AUTHORITY_UNAVAILABLE'});}
 const after=now();
 if(!Number.isSafeInteger(after)||after<at||after-at>30000||
  !validProof(proof,input,actorId,after))
  return Object.freeze({ok:false,code:'PIN_EVIDENCE_UNVERIFIED'});
 // Keep only the independently attested server evidence in the resolver
 // scope. Client-supplied metadata, driver IDs and price are never forwarded.
 return Object.freeze({ok:true,evidence:Object.freeze({
  evidenceId:proof.evidenceId,revision:proof.revision,
  verifiedAtMs:proof.verifiedAtMs,actorId,quoteRequestKey:input.quoteRequestKey,
  origin:input.origin,destination:input.destination,service:input.service,
  pickupPoint:Object.freeze({...proof.pickupPoint}),
  dropoffPoint:Object.freeze({...proof.dropoffPoint}),
  source:'INDEPENDENT_PIN_AUTHORITY'
 })});
}
