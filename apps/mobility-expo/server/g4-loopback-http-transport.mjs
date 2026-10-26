/**
 * QORE Radar — loopback-only HTTP transport, integration harness.
 *
 * This intentionally creates an UNBOUND Node HTTP server. It can be bound
 * only to 127.0.0.1 by listenQoreRadarLoopback(), and MUST NOT be deployed
 * or forwarded to a public interface. Auth, storage and DB are adapters
 * injected into the authenticated G4 gateways, not invented here.
 * NO LIVE, NO PSP, NO GPS devices, NO push delivery.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';

const riderRoute=/^\/v1\/staging\/rider\/trips\/[0-9a-f-]{36}\/status$/i;
const riderHistoryRoute=/^\/v1\/staging\/rider\/history$/;
const offerReadRoute=/^\/v1\/staging\/driver\/offers\/[0-9a-f-]{36}$/i;
const offerDecisionRoute=/^\/v1\/staging\/driver\/offers\/(accept|decline)$/;
const offerRecoveryRoute=/^\/v1\/staging\/(?:driver\/offers|courier\/delivery-offers)\/reconcile$/;
const tripRequestRoute=/^\/v1\/staging\/rider\/trips\/request$/;
// G97: route already-authenticated G93/G94/G95 through loopback HTTP.
const f1AutoPostRoute=/^\/v1\/staging\/rider\/auto\/(?:routes|prequote|book)$/;
const f1AutoCancelPostRoute=/^\/v1\/staging\/rider\/auto\/bookings\/[0-9a-f-]{36}\/cancel$/i;
const f1AutoSubsidyPostRoute=/^\/v1\/staging\/rider\/auto\/prequotes\/[0-9a-f-]{36}\/subsidy$/i;
const f1AutoGetRoute=/^\/v1\/staging\/rider\/auto\/bookings\/[0-9a-f-]{36}(?:\/(?:dispatch|financial-status|cancellation))?$/i;
// G101 MOTO passenger is a different ride kind from AUTO/DELIVERY.
const f1MotoPostRoute=/^\/v1\/staging\/rider\/moto\/(?:quotes|book|bookings\/[0-9a-f-]{36}\/cancel)$/i;
const f1MotoGetRoute=/^\/v1\/staging\/rider\/moto\/bookings\/[0-9a-f-]{36}(?:\/cancellation)?$/i;
const ownerCommissionRoute=/^\/v1\/staging\/owner\/commissions\/(AUTO_RIDE|MOTO_RIDE)$/;
const adminF1AuditRoute=/^\/v1\/staging\/admin\/rides\/[0-9a-f-]{36}\/f1-verification$/i;
const riderCancelRoute=/^\/v1\/staging\/rider\/trips\/[0-9a-f-]{36}\/cancel$/i;
const tripTransitionRoute=/^\/v1\/staging\/trips\/[0-9a-f-]{36}\/transition$/i;
const deliveryRequestRoute=/^\/v1\/staging\/sender\/deliveries\/request$/;
const deliveryTransitionRoute=/^\/v1\/staging\/deliveries\/[0-9a-f-]{36}\/transition$/i;
const deliveryStatusRoute=/^\/v1\/staging\/deliveries\/[0-9a-f-]{36}\/status$/i;
const merchantRequestRoute=/^\/v1\/staging\/buyer\/orders\/request$/;
const merchantTransitionRoute=/^\/v1\/staging\/(?:merchant|buyer)\/orders\/[0-9a-f-]{36}\/transition$/i;
const merchantAttachRoute=/^\/v1\/staging\/merchant\/orders\/[0-9a-f-]{36}\/attach-delivery$/i;
const merchantStatusRoute=/^\/v1\/staging\/orders\/[0-9a-f-]{36}\/status$/i;
const fareQuoteRoute=/^\/v1\/staging\/fares\/quote$/;
const paymentAuthorizeRoute=/^\/v1\/staging\/payments\/authorize$/;
const paymentTransitionRoute=/^\/v1\/staging\/payments\/[0-9a-f-]{36}\/transition$/i;
const paymentStatusRoute=/^\/v1\/staging\/payments\/[0-9a-f-]{36}\/status$/i;
const safetyReportRoute=/^\/v1\/staging\/safety\/incidents\/report$/;
const safetyStatusRoute=/^\/v1\/staging\/safety\/incidents\/[0-9a-f-]{36}\/status$/i;
const safetyTransitionRoute=/^\/v1\/staging\/admin\/safety\/incidents\/[0-9a-f-]{36}\/transition$/i;
const suspensionApplyRoute=/^\/v1\/staging\/admin\/safety\/suspensions\/apply$/;
const suspensionLiftRoute=/^\/v1\/staging\/admin\/safety\/suspensions\/[0-9a-f-]{36}\/lift$/i;
const merchantOnboardingRoute=/^\/v1\/staging\/merchant\/onboarding\/request$/;
const merchantReviewRoute=/^\/v1\/staging\/admin\/merchants\/[0-9a-f-]{36}\/review$/i;
const merchantBranchWriteRoute=/^\/v1\/staging\/merchant\/branches\/upsert$/;
const merchantCatalogWriteRoute=/^\/v1\/staging\/merchant\/catalog\/upsert$/;
const driverLicenseReadinessRoute=/^\/v1\/staging\/driver\/license-readiness$/;
const driverKycValidityRoute=/^\/v1\/staging\/driver\/kyc\/validity$/;
const driverTripStatusRoute=/^\/v1\/staging\/driver\/trips\/[0-9a-f-]{36}\/status$/i;
const driverEnrollmentRoute=/^\/v1\/staging\/driver\/enrollment$/;
const driverDocumentReadRoute=/^\/v1\/staging\/driver\/documents$/;
const driverDocumentObserveRoute=/^\/v1\/staging\/driver\/documents\/observe$/;
const adminDocumentReviewRoute=/^\/v1\/staging\/admin\/driver-documents\/review$/;
const driverCurrentTripRoute=new RegExp('^/v1/staging/driver/trips/current$');
const driverInboxRoute=/^\/v1\/staging\/driver\/inbox$/;
const courierPollRoute=/^\/v1\/staging\/courier\/delivery-offers$/;
const deliveryOfferReadRoute=/^\/v1\/staging\/courier\/delivery-offers\/[0-9a-f-]{36}$/i;
const deliveryOfferDecisionRoute=/^\/v1\/staging\/courier\/delivery-offers\/(accept|decline)$/;
const safe=(code,body)=>({status:code,body});
const maxBody=2048;
const JSON_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'",
};
function send(res,status,body) {
 if(res.writableEnded||res.destroyed)return;
 // Never echo raw request or any authentication value.
 const allowed=Number.isInteger(status)&&status>=200&&status<=599?status:503;
 res.writeHead(allowed,JSON_HEADERS);
 res.end(JSON.stringify(body));
}
export function createQoreRadarLoopbackTransport({
 riderHandler,riderHistoryHandler,offerHandler,tripCommandHandler,deliveryHandler,merchantHandler,
 financeHandler,safetyHandler,merchantManagementHandler,deliveryOfferHandler,
 f1AutoHandler,motoHandler,adminF1AuditHandler,ownerCommissionHandler,driverDecisionRecoveryHandler,
 courierPollHandler,driverInboxHandler,driverDocumentHandler,driverEnrollmentHandler,
 driverLicenseReadinessHandler,driverKycValidityHandler,driverTripStatusHandler,driverCurrentTripHandler,
}){
 if(typeof riderHandler!=='function'||
   (riderHistoryHandler!==undefined&&typeof riderHistoryHandler!=='function')||
   typeof offerHandler!=='function'||
   typeof tripCommandHandler!=='function'||
   (f1AutoHandler!==undefined&&typeof f1AutoHandler!=='function')||
   (motoHandler!==undefined&&typeof motoHandler!=='function')||
   (adminF1AuditHandler!==undefined&&typeof adminF1AuditHandler!=='function')||
   (ownerCommissionHandler!==undefined&&typeof ownerCommissionHandler!=='function')||
   (driverDecisionRecoveryHandler!==undefined&&typeof driverDecisionRecoveryHandler!=='function')||
   typeof deliveryHandler!=='function'||
   typeof merchantHandler!=='function'||typeof financeHandler!=='function'||
   typeof safetyHandler!=='function'||typeof merchantManagementHandler!=='function'||
   typeof deliveryOfferHandler!=='function'||
   (courierPollHandler!==undefined&&typeof courierPollHandler!=='function')||
   (driverInboxHandler!==undefined&&typeof driverInboxHandler!=='function')||
   (driverDocumentHandler!==undefined&&typeof driverDocumentHandler!=='function')||
   (driverEnrollmentHandler!==undefined&&typeof driverEnrollmentHandler!=='function')||
   (driverLicenseReadinessHandler!==undefined&&typeof driverLicenseReadinessHandler!=='function')||
   (driverKycValidityHandler!==undefined&&typeof driverKycValidityHandler!=='function')||
   (driverTripStatusHandler!==undefined&&typeof driverTripStatusHandler!=='function')||
   (driverCurrentTripHandler!==undefined&&typeof driverCurrentTripHandler!=='function'))
  throw new Error('All G4/G5/G6/G7/G8/G9/G10 authenticated gateways required');
 const server=createServer(async(req,res)=>{
  // No middleware, cookies, CORS, public preflight, or unrestricted proxying.
  const path=req.url;
  if(typeof path!=='string'||path.length>180||
     path.includes('?')||path.includes('#')||path.includes('%')||
     path.includes('\\')||path.includes('//')){
   send(res,404,{error:'Not found'});return;
  }
  const rider=req.method==='GET'&&riderRoute.test(path);
  const riderHistory=req.method==='GET'&&riderHistoryRoute.test(path);
  const offerGet=req.method==='GET'&&offerReadRoute.test(path);
  const offerPost=req.method==='POST'&&offerDecisionRoute.test(path);
  const offerRecoveryPost=req.method==='POST'&&offerRecoveryRoute.test(path);
  const tripPost=req.method==='POST'&&
   (tripRequestRoute.test(path)||tripTransitionRoute.test(path)||
    riderCancelRoute.test(path));
  const f1AutoGet=req.method==='GET'&&f1AutoGetRoute.test(path);
  const motoPost=req.method==='POST'&&f1MotoPostRoute.test(path);
  const motoGet=req.method==='GET'&&f1MotoGetRoute.test(path);
  const adminF1AuditGet=req.method==='GET'&&adminF1AuditRoute.test(path);
  const ownerCommissionGet=req.method==='GET'&&ownerCommissionRoute.test(path);
  const ownerCommissionPost=req.method==='POST'&&ownerCommissionRoute.test(path);
  const f1AutoPost=req.method==='POST'&&
   (f1AutoPostRoute.test(path)||f1AutoCancelPostRoute.test(path));
  // This POST is a read-only persisted quote disclosure: NO JSON request
  // body, no browser cookies, no network provider, no price supplied by Rider.
  const f1AutoSubsidyPost=req.method==='POST'&&f1AutoSubsidyPostRoute.test(path);
  const deliveryGet=req.method==='GET'&&deliveryStatusRoute.test(path);
  const deliveryPost=req.method==='POST'&&
   (deliveryRequestRoute.test(path)||deliveryTransitionRoute.test(path));
  const merchantGet=req.method==='GET'&&merchantStatusRoute.test(path);
  const merchantPost=req.method==='POST'&&
   (merchantRequestRoute.test(path)||merchantTransitionRoute.test(path)||
    merchantAttachRoute.test(path));
  const financeGet=req.method==='GET'&&paymentStatusRoute.test(path);
  const financePost=req.method==='POST'&&
   (fareQuoteRoute.test(path)||paymentAuthorizeRoute.test(path)||
    paymentTransitionRoute.test(path));
  const safetyGet=req.method==='GET'&&safetyStatusRoute.test(path);
  const safetyPost=req.method==='POST'&&
   (safetyReportRoute.test(path)||safetyTransitionRoute.test(path)||
    suspensionApplyRoute.test(path)||suspensionLiftRoute.test(path));
  const merchantManagementPost=req.method==='POST'&&
   (merchantOnboardingRoute.test(path)||merchantReviewRoute.test(path)||
    merchantBranchWriteRoute.test(path)||merchantCatalogWriteRoute.test(path));
  const driverLicenseReadinessGet=req.method==='GET'&&driverLicenseReadinessRoute.test(path);
  const driverKycValidityGet=req.method==='GET'&&driverKycValidityRoute.test(path);
  const driverEnrollmentPost=req.method==='POST'&&driverEnrollmentRoute.test(path);
  const driverDocumentGet=req.method==='GET'&&driverDocumentReadRoute.test(path);
  const driverDocumentPost=req.method==='POST'&&
   (driverDocumentObserveRoute.test(path)||adminDocumentReviewRoute.test(path));
  const driverTripStatusGet=req.method==='GET'&&driverTripStatusRoute.test(path);
  const driverCurrentTripGet=req.method==='GET'&&driverCurrentTripRoute.test(path);
  const driverInboxGet=req.method==='GET'&&driverInboxRoute.test(path);
  const courierPollGet=req.method==='GET'&&courierPollRoute.test(path);
  const deliveryOfferGet=req.method==='GET'&&deliveryOfferReadRoute.test(path);
  const deliveryOfferPost=req.method==='POST'&&deliveryOfferDecisionRoute.test(path);
  if(!rider&&!riderHistory&&!offerGet&&!offerPost&&!offerRecoveryPost&&!tripPost&&!f1AutoGet&&!f1AutoPost&&!f1AutoSubsidyPost&&!motoPost&&!motoGet&&!adminF1AuditGet&&!ownerCommissionGet&&!ownerCommissionPost&&
    !deliveryGet&&!deliveryPost&&
    !merchantGet&&!merchantPost&&!financeGet&&!financePost&&
    !safetyGet&&!safetyPost&&!merchantManagementPost&&
    !deliveryOfferGet&&!deliveryOfferPost&&!courierPollGet&&!driverInboxGet&&
    !driverDocumentGet&&!driverDocumentPost&&!driverEnrollmentPost&&
    !driverLicenseReadinessGet&&!driverKycValidityGet&&!driverTripStatusGet&&
    !driverCurrentTripGet){
   send(res,404,{error:'Not found'});return;
  }
  if(req.headers.origin||req.headers.cookie){
   // The loopback test is explicitly NOT a browser or session-cookie API.
   send(res,403,{error:'Browser origins and cookies unsupported'});return;
  }
  if((rider||riderHistory||offerGet||f1AutoGet||f1AutoSubsidyPost||motoGet||adminF1AuditGet||ownerCommissionGet||deliveryGet||merchantGet||financeGet||safetyGet||
      deliveryOfferGet||courierPollGet||driverInboxGet||driverDocumentGet||
      driverLicenseReadinessGet||driverKycValidityGet||driverTripStatusGet||driverCurrentTripGet)&&
     (req.headers['transfer-encoding']!==undefined||
      (req.headers['content-length']!==undefined&&req.headers['content-length']!=='0'))){
   send(res,400,{error:'GET body not supported'});return;
  }
  let body;
  if(offerPost||offerRecoveryPost||tripPost||f1AutoPost||motoPost||deliveryPost||merchantPost||financePost||safetyPost||
    merchantManagementPost||deliveryOfferPost||driverDocumentPost||driverEnrollmentPost||ownerCommissionPost){
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??'')){
    send(res,415,{error:'JSON required'});return;
   }
   const declared=Number(req.headers['content-length']??0);
   if(!Number.isSafeInteger(declared)||declared<0||declared>maxBody){
    send(res,413,{error:'Body too large'});return;
   }
   const chunks=[];let length=0;
   try{
    for await (const chunk of req){
     length+=chunk.byteLength;
     if(length>maxBody){send(res,413,{error:'Body too large'});return;}
     chunks.push(chunk);
    }
    body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   }catch{send(res,400,{error:'Invalid JSON'});return;}
  }
  try {
   const handler=rider?riderHandler:
    riderHistory?(riderHistoryHandler??(()=>({status:503,body:{error:'History not configured'}}))):
    (f1AutoGet||f1AutoPost||f1AutoSubsidyPost)?(f1AutoHandler??(()=>({status:503,body:{error:'F1 Auto not configured'}}))):
    (motoGet||motoPost)?(motoHandler??(()=>({status:503,body:{error:'F1 MOTO passenger not configured'}}))):
    (ownerCommissionGet||ownerCommissionPost)?(ownerCommissionHandler??(()=>({status:503,body:{error:'G116 Owner unavailable'}}))):
    adminF1AuditGet?(adminF1AuditHandler??(()=>({status:503,body:{error:'G75 IdP MFA unavailable'}}))):
    offerRecoveryPost?(driverDecisionRecoveryHandler??(()=>({status:503,body:{error:'G64 owner-only decision reader unavailable',retrySafe:false}}))):
    tripPost?tripCommandHandler:
    (deliveryGet||deliveryPost)?deliveryHandler:
    (merchantGet||merchantPost)?merchantHandler:
    (financeGet||financePost)?financeHandler:
    (safetyGet||safetyPost)?safetyHandler:
    merchantManagementPost?merchantManagementHandler:
    driverCurrentTripGet?(driverCurrentTripHandler??(()=>({status:503,body:{error:'Driver trip recovery not configured'}}))):
    driverTripStatusGet?(driverTripStatusHandler??(()=>({status:503,body:{error:'Driver trip session authority unavailable'}}))):
    driverKycValidityGet?(driverKycValidityHandler??(()=>({status:503,body:{error:'Driver KYC authority unavailable'}}))):
    driverLicenseReadinessGet?
     (driverLicenseReadinessHandler??(()=>({status:503,body:{error:'Driver KYC readiness not configured'}}))):
    driverEnrollmentPost?(driverEnrollmentHandler??(()=>({status:503,body:{error:'Driver enrollment not configured'}}))):
    (driverDocumentGet||driverDocumentPost)?
     (driverDocumentHandler??(()=>({status:503,body:{error:'Private Driver documents not configured'}}))):
    driverInboxGet?(driverInboxHandler??(()=>({status:503,body:{error:'Driver inbox not configured'}}))):
    courierPollGet?(courierPollHandler??(()=>({status:503,body:{error:'Private courier polling not configured'}}))):
    (deliveryOfferGet||deliveryOfferPost)?deliveryOfferHandler:offerHandler;
   const out=await handler({
    method:req.method,path,headers:req.headers,body
   });
   if(out===null||typeof out!=='object'||!Number.isInteger(out.status)||
      typeof out.body!=='object'||out.body===null){
    send(res,503,{error:'Gateway unavailable'});return;
   }
   send(res,out.status,out.body);
  }catch{
   send(res,503,{error:'Gateway unavailable'});
  }
 });
 server.requestTimeout=10_000;
 server.headersTimeout=8_000;
 server.maxRequestsPerSocket=60;
 server.keepAliveTimeout=3_000;
 // The exported test-server object itself must not be bindable to all
 // interfaces, even if a future caller bypasses listenQoreRadarLoopback().
 const nativeListen=server.listen.bind(server);
 Object.defineProperty(server,'listen',{
  configurable:false,writable:false,
  value:(port,host,callback)=>{
   if(!Number.isInteger(port)||port<0||port>65535||
      (port!==0&&port<1024)||host!=='127.0.0.1')
    throw new Error('Only 127.0.0.1 QA listener is supported');
   return typeof callback==='function'?
    nativeListen(port,host,callback):nativeListen(port,host);
  }
 });
 return server;
}
export async function listenQoreRadarLoopback(server,port=0){
 if(!server||typeof server.listen!=='function'||
    !Number.isInteger(port)||port<0||port>65535||
    (port!==0&&port<1024))
  throw new Error('Invalid localhost-only test listener');
 // NEVER change the address to 0.0.0.0 or [::], including in CI.
 server.listen(port,'127.0.0.1');
 await once(server,'listening');
 const address=server.address();
 if(!address||typeof address==='string'||address.address!=='127.0.0.1')
  throw new Error('Refusing non-loopback QORE test server');
 return 'http://127.0.0.1:'+address.port;
}
