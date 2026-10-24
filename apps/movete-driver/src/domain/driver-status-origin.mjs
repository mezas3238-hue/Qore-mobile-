/**
 * G62A: shared Driver HTTPS STAGING read policy.
 * No URL is auto-discovered; localhost legacy QA is permitted only in its
 * original mode. The HTTPS form requires independent explicit owner opt-in.
 */
import {assertDriverApprovedStagingOrigin}
 from './driver-chat-https-staging.mjs';
export function resolveDriverStatusOrigin({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false
}={}){
 if(approvedStagingHost!==null){
  if(allowedByOwner!==true)throw Error('Driver HTTPS status disabled');
  return assertDriverApprovedStagingOrigin({apiOrigin,approvedStagingHost});
 }
 if(allowedByOwner!==false)
  throw Error('Driver local QA cannot masquerade as authorized remote service');
 let url;
 try{url=new URL(apiOrigin);}catch{throw Error('Driver QA origin invalid');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||
  !url.port||url.pathname!=='/'||url.search||url.hash||
  url.username||url.password)
  throw Error('Driver status requires isolated localhost QA');
 return url.origin;
}
