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
 return Object.freeze({
  apiOrigin:origin,approvedStagingHost,
  allowedByOwner:true,authAdapter,chatAdapters,
  // Never return request credentials or an SDK instance to React UI.
  productionEnabled:false,qaOnly:true
 });
}
