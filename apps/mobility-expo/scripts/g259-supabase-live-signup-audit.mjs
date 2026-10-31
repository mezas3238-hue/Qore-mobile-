/**
 * G259: GitHub read-only certificate of actual Supabase STAGING signup policy.
 * Uses ONLY the public publishable client key. It cannot create users,
 * log in, access privileged Auth endpoints, write data, dispatch or pay.
 * A missing, stale or unreadable provider response blocks certification.
 */
import {fileURLToPath} from 'node:url';
import {inspectStageSignup,assertPublishableKey,safeStageRef}
 from './staging-auth-policy-gate.mjs';
export const G259_REF='mrjzxftsdxzepzbcuids';
const deny=code=>Object.freeze({certified:false,code,providerReadOnly:true,
 stage:'staging',commercialReady:false,externalJourneysCertified:0});
export async function auditG259Signup({
 projectRef=G259_REF,publishableKey,request=fetch,
 signupReader=inspectStageSignup
}={}){
 if(projectRef!==G259_REF)return deny('WRONG_PROJECT');
 try{
  safeStageRef(projectRef);
  assertPublishableKey(publishableKey,projectRef);
 }catch{return deny('INVALID_PUBLIC_KEY');}
 if(typeof request!=='function'||typeof signupReader!=='function')
  return deny('INVALID_AUDIT_ADAPTER');
 let actual;
 try{actual=await signupReader({
  ref:G259_REF,key:publishableKey,request
 });}catch{return deny('PROVIDER_SETTINGS_UNAVAILABLE');}
 if(actual?.certified!==true){
  // Distinguish an actual provider response of disable_signup=false from
  // an absent/unrecognized setting. Neither permits Railway deployment.
  return deny(actual?.reason==='Auth admite registro público (disable_signup=false)'
   ?'PUBLIC_SIGNUP_CONFIRMED_OPEN'
   :'PUBLIC_SIGNUP_NOT_CERTIFIED_CLOSED');
 }
 return Object.freeze({certified:true,code:'REAL_PROVIDER_SIGNUP_DISABLED',
  providerReadOnly:true,stage:'staging',
  commercialReady:false,externalJourneysCertified:0});
}
const isCli=process.argv[1]&&
 fileURLToPath(import.meta.url)===process.argv[1];
if(isCli){
 const result=await auditG259Signup({
  projectRef:process.env.QORE_STAGING_PROJECT_REF,
  publishableKey:process.env.QORE_STAGING_PUBLISHABLE_KEY
 });
 console.log('G259 Supabase STAGING Auth: '+result.code);
 if(!result.certified)process.exitCode=1;
}
