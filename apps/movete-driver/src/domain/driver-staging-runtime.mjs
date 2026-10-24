/**
 * G62B — single opt-in composition of authenticated Driver workspace + chat.
 *
 * This is an integration factory, NOT an application-wide default.
 * No embedded host, JWT, credentials, API key, user, production route, or
 * mock fallback. Only a privileged STAGING application composition can call it.
 */
import {createDriverHttpsStagingAuthAdapter}
 from './driver-https-staging-auth.mjs';
import {createDriverChatHttpsStagingAdapters}
 from './driver-chat-https-staging.mjs';
import {readDriverPrivateInbox} from './driver-inbox.mjs';
import {readDriverDocumentStatuses} from './driver-documents.mjs';
import {readDriverLicenseReadiness} from './driver-license-readiness.mjs';
import {decidePrivateDriverOffer,reconcilePrivateDriverOffer}
 from './driver-offer-decision.mjs';
import {resolveDriverStatusOrigin}
 from './driver-status-origin.mjs';

export const DRIVER_STAGING_RUNTIME_LIVE_ENABLED=false;
export function createDriverStagingRuntime({
 apiOrigin,approvedStagingHost,auth,
 verifyExclusiveDriverRole,request,
 makeRequestKey,verifyStopped,
 allowedByOwner=false,liveEnabled=false,now=Date.now
}={}){
 if(allowedByOwner!==true||liveEnabled!==false||
   typeof request!=='function'||typeof now!=='function')
  throw Error('G62 requires a separately approved STAGING composition');
 const origin=resolveDriverStatusOrigin({
  apiOrigin,approvedStagingHost,allowedByOwner});
 const authAdapter=createDriverHttpsStagingAuthAdapter({
  auth,apiOrigin:origin,approvedStagingHost,verifyExclusiveDriverRole,
  allowedByOwner:true,liveEnabled:false,now});
 const chatAdapters=createDriverChatHttpsStagingAdapters({
  apiOrigin:origin,approvedStagingHost,request,
  makeRequestKey,verifyStopped,
  allowedByOwner:true,liveEnabled:false,now});
 // Restrict the workspace transport to precisely its three private reads.
 // User-derived URLs or routes never reach the injected fetch provider.
 const readOnlyPaths=new Set([
  '/v1/staging/driver/inbox',
  '/v1/staging/driver/documents',
  '/v1/staging/driver/license-readiness'
 ]);
 const workspaceRequest=(url,options={})=>{
  let parsed;
  try{parsed=new URL(url);}catch{
   throw Error('G62 invalid Driver workspace read URL');
  }
  if(parsed.origin!==origin||!readOnlyPaths.has(parsed.pathname)||
   parsed.search!==''||parsed.hash!==''||options.method!=='GET'||
   options.credentials!=='omit'||options.cache!=='no-store')
   throw Error('G62 workspace request not authorized');
  return request(url,options);
 };
 const scope={approvedStagingHost,allowedByOwner:true,
  request:workspaceRequest};
 const workspaceReaders=Object.freeze({
  readInbox:params=>readDriverPrivateInbox({...params,...scope}),
  readDocuments:params=>readDriverDocumentStatuses({...params,...scope}),
  readLicense:params=>readDriverLicenseReadiness({...params,...scope})
 });
 const offerActions=Object.freeze({
  makeRequestKey:chatAdapters.makeRequestKey,
  now,
  liveEnabled:false,
  reconcile:({accessToken,kind,offerId,requestKey,action})=>
   reconcilePrivateDriverOffer({
    apiOrigin:origin,approvedStagingHost,allowedByOwner:true,
    accessToken,kind,offerId,requestKey,action,request
   }),
  decide:({accessToken,kind,offerId,requestKey,action})=>
   decidePrivateDriverOffer({
    apiOrigin:origin,approvedStagingHost,allowedByOwner:true,
    accessToken,kind,offerId,requestKey,action,request
   })
 });
 return Object.freeze({
  apiOrigin:origin,approvedStagingHost,
  allowedByOwner:true,authAdapter,chatAdapters,workspaceReaders,
  offerActions,
  productionEnabled:false,qaOnly:true
 });
}
