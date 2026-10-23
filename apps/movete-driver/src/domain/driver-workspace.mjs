/**
 * Driver-only mobile workspace orchestration, STAGING QA.
 *
 * This module does NOT implement signup, store JWTs, or invent real accounts.
 * An independently authorized Auth adapter must provide getSession(); the
 * backend re-verifies JWT, role, KYC and offer recipient on every request.
 *
 * A snapshot NEVER contains bearer tokens, account IDs, storage paths, PII,
 * mutable transport objects or approval/eligibility claims for LIVE use.
 */
import {readDriverDocumentStatuses} from './driver-documents.mjs';
import {readDriverPrivateInbox} from './driver-inbox.mjs';
import {readDriverLicenseReadiness} from './driver-license-readiness.mjs';

export const DRIVER_WORKSPACE_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const phases=new Set(['not-configured','signed-out','loading','connected',
 'offline','authorization-required']);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const EMPTY=Object.freeze([]);
function make(phase,offers=EMPTY,documents=EMPTY,license=false){
 if(!phases.has(phase))throw Error('Invalid workspace phase');
 return Object.freeze({
  phase,offers:Object.freeze([...offers]),
  documents:Object.freeze([...documents]),
  currentLicenseApproved:license===true,
  driverEligible:false,liveEnabled:false
 });
}
const cleanSession=session=>isObject(session)&&session.role==='driver'&&
 typeof session.userId==='string'&&UUID.test(session.userId)&&
 typeof session.accessToken==='string'&&TOKEN.test(session.accessToken);
const config=({authAdapter,apiOrigin,request,now})=>
 authAdapter&&typeof authAdapter.getSession==='function'&&
 typeof apiOrigin==='string'&&typeof request==='function'&&typeof now==='function';
export function createDriverWorkspaceController({
 authAdapter=null,apiOrigin=null,request=fetch,now=Date.now,
 readInbox=readDriverPrivateInbox,
 readDocuments=readDriverDocumentStatuses,
 readLicense=readDriverLicenseReadiness
}={}){
 if(![request,now,readInbox,readDocuments,readLicense].every(fn=>typeof fn==='function'))
  throw Error('Trusted Driver QA workspace functions required');
 const enabled=config({authAdapter,apiOrigin,request,now});
 let epoch=0;
 let current=make(enabled?'signed-out':'not-configured');
 const listeners=new Set();
 function emit(next){
  current=next;
  for(const listener of [...listeners]){
   try{listener(current);}catch{/* listeners never block privacy reset */}
  }
  return current;
 }
 function reset(phase=enabled?'signed-out':'not-configured'){
  epoch++;
  return emit(make(phase));
 }
 return Object.freeze({
  current:()=>current,
  subscribe(listener){
   if(typeof listener!=='function')throw Error('Driver subscriber required');
   listeners.add(listener);
   return ()=>{listeners.delete(listener);};
  },
  invalidate(){
   return reset();
  },
  async refresh(){
   if(!enabled)return reset('not-configured');
   const nonce=++epoch;
   emit(make('loading'));
   let session;
   try{
    session=await authAdapter.getSession();
    if(nonce!==epoch)return current;
    if(session===null||session===undefined)return emit(make('signed-out'));
    if(!cleanSession(session))return emit(make('authorization-required'));
    // Keep token only in this async frame, never in controller persistent state.
    const connection={apiOrigin,accessToken:session.accessToken,request};
    const [offers,documents,license]=await Promise.all([
     readInbox({...connection,now}),
     readDocuments(connection),
     readLicense(connection)
    ]);
    if(nonce!==epoch)return current;
    if(!Array.isArray(offers)||offers.length>10||
       !Array.isArray(documents)||documents.length>7||
       !isObject(license)||typeof license.currentLicenseApproved!=='boolean'||
       license.driverEligible!==false||license.liveEnabled!==false)
     throw Error('Invalid private Driver state');
    // Never trust unknown fields from injected adapters. Exact allowlist.
    const safeOffers=offers.map(offer=>{
     if(!isObject(offer)||!['AUTO_RIDE','DELIVERY'].includes(offer.kind)||
       typeof offer.offerId!=='string'||!UUID.test(offer.offerId)||
       typeof offer.serviceId!=='string'||!UUID.test(offer.serviceId)||
       !Number.isSafeInteger(offer.expiresAtMs)||
       offer.expiresAtMs<=now()+3000)
      throw Error('Invalid offer in Driver workspace');
     return Object.freeze({kind:offer.kind,offerId:offer.offerId,
      serviceId:offer.serviceId,expiresAtMs:offer.expiresAtMs});
    });
    const safeDocs=documents.map(doc=>{
     if(!isObject(doc)||typeof doc.kind!=='string'||
       !['licencia','identidad_frente','identidad_dorso','cedula_verde',
        'seguro','inspeccion','habilitacion'].includes(doc.kind)||
       !['pending','approved','rejected'].includes(doc.status)||
       !Number.isSafeInteger(doc.submittedAtMs)||
       !(doc.reviewedAtMs===null||Number.isSafeInteger(doc.reviewedAtMs)))
      throw Error('Invalid Driver document state');
     return Object.freeze({kind:doc.kind,status:doc.status,
      submittedAtMs:doc.submittedAtMs,reviewedAtMs:doc.reviewedAtMs});
    });
    return emit(make('connected',safeOffers,safeDocs,
     license.currentLicenseApproved));
   }catch(error){
    if(nonce!==epoch)return current;
    const reason=error instanceof Error?error.message:'';
    if(/session expired|role not authorized|authorization required/i.test(reason)){
     return reset('authorization-required');
    }
    return emit(make('offline'));
   }
  }
 });
}
