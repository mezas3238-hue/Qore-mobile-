/**
 * R55 — one explicitly approved composition root for Passenger G51/G52/G53.
 * This DOES NOT provision an IdP or HTTPS endpoint, and never runs by default.
 * The independent role verifier and certified HTTPS host must be supplied by
 * an authorized deployment operator after A's contracts are actually wired.
 */
import {createClientExperience} from './client-experience.mjs';
export const PASSENGER_CHAT_PRODUCTION_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~+/-]{20,8192}={0,2}$/;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const valid=x=>Number.isSafeInteger(x)&&x>=0;
const gate=x=>x===true;
export function assertApprovedPassengerStagingOrigin({
 apiOrigin,approvedStagingHost
}={}){
 if(typeof approvedStagingHost!=='string'||approvedStagingHost.length>200
  ||!approvedStagingHost.includes('staging')
  ||!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(approvedStagingHost)
  ||approvedStagingHost.includes('..')||approvedStagingHost.endsWith('.local')
  ||approvedStagingHost==='localhost'||/^\d+\.\d+\.\d+\.\d+$/.test(approvedStagingHost)
  ||typeof apiOrigin!=='string'||apiOrigin.includes('\\'))
  throw Error('Passenger chat requires an independently approved HTTPS STAGING DNS host');
 let url;
 try{url=new URL(apiOrigin);}catch{throw Error('Invalid Passenger HTTPS origin');}
 if(url.protocol!=='https:'||url.hostname!==approvedStagingHost
  ||url.origin!==apiOrigin||url.port||url.pathname!=='/'
  ||url.username||url.password||url.search||url.hash)
  throw Error('Untrusted Passenger HTTPS STAGING origin');
 return url.origin;
}
export function createPassengerChatStagingComposition({
 ownerApprovedStaging=false,identityContractCertified=false,
 chatContractsCertified=false,httpsStagingRuntimeVerified=false,
 liveEnabled=false,apiOrigin,approvedStagingHost,
 authProvider,verifyExclusivePassengerRole,fetchImpl,
 now=()=>Date.now(),timeoutMs=8000
}={}){
 // No staging or production connections are possible under default settings.
 if(!gate(ownerApprovedStaging)||!gate(identityContractCertified)
  ||!gate(chatContractsCertified)||!gate(httpsStagingRuntimeVerified)
  ||liveEnabled!==false)
  return Object.freeze({ready:false,code:'PASSENGER_STAGING_NOT_AUTHORIZED',
   productionEnabled:false,experience:createClientExperience()});
 if(!isObj(authProvider)||typeof authProvider.readSession!=='function'
  ||typeof authProvider.signOut!=='function'
  ||typeof verifyExclusivePassengerRole!=='function'
  ||typeof fetchImpl!=='function'||typeof now!=='function'
  ||!valid(timeoutMs)||timeoutMs<1500||timeoutMs>10000)
  throw Error('Passenger staging requires certified identity and transport callbacks');
 const origin=assertApprovedPassengerStagingOrigin({apiOrigin,approvedStagingHost});
 const approvedIdentity=Object.freeze({
  async readSession(){
   const s=await authProvider.readSession();
   if(!isObj(s)||s.role!=='passenger'||!UUID.test(s.subject)
    ||typeof s.token!=='string'||!TOKEN.test(s.token)
    ||!valid(s.expiresAt)||s.expiresAt<=now()+1000)
    return null;
   // Must be server-verifiable and independent from untrusted JWT/app claims.
   const accepted=await verifyExclusivePassengerRole(Object.freeze({
    subject:s.subject,token:s.token,expiresAt:s.expiresAt
   }));
   return accepted===true?s:null;
  },
  signOut:()=>authProvider.signOut()
 });
 const options=Object.freeze({
  enabled:true,contractCertified:true,stagingRuntimeVerified:true,
  origin,pinnedOrigin:origin,fetchImpl,timeoutMs
 });
 return Object.freeze({ready:true,mode:'STAGING_QA_ONLY',
  productionEnabled:false,
  experience:createClientExperience({
   authProvider:approvedIdentity,
   g51ChatInboxHttpOptions:{...options},
   g52ChatHistoryHttpOptions:{...options},
   g53ChatSendHttpOptions:{...options},
   now
  })
 });
}
