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
const f1MotoGetRoute=/^\/v1\/staging\/rider\/moto\/bookings\/[0-9a-f-]{36}(?:\/(?:cancellation|status))?$/i;
const g189DriverMotoCurrent='/v1/staging/driver/moto/current';
const g169DriverMotoGet=/^\/v1\/staging\/driver\/moto\/bookings\/[0-9a-f-]{36}\/status$/i;
const g169DriverMotoPost=/^\/v1\/staging\/driver\/moto\/bookings\/[0-9a-f-]{36}\/advance$/i;
const ownerCommissionRoute=/^\/v1\/staging\/owner\/commissions\/(AUTO_RIDE|MOTO_RIDE|DELIVERY_AUTO|DELIVERY_MOTO|COMMERCE)$/;
const ownerCargoRateRoute=/^\/v1\/staging\/owner\/delivery-rates\/(AUTO|MOTO)\/[A-Z_]{3,20}$/;
const adminF1AuditRoute=/^\/v1\/staging\/admin\/rides\/[0-9a-f-]{36}\/f1-verification$/i;
const adminServiceTraceRoute=/^\/v1\/staging\/admin\/services\/AUTO_RIDE\/[0-9a-f-]{36}\/trace$/i;
const adminMotoTraceRoute=/^\/v1\/staging\/admin\/services\/MOTO_RIDE\/[0-9a-f-]{36}\/trace$/i;
const adminCargoTraceRoute=/^\/v1\/staging\/admin\/services\/(DELIVERY_AUTO|DELIVERY_MOTO)\/[0-9a-f-]{36}\/trace$/i;
const adminCommerceTraceRoute=/^\/v1\/staging\/admin\/services\/COMMERCE\/[0-9a-f-]{36}\/trace$/i;
const riderCancelRoute=/^\/v1\/staging\/rider\/trips\/[0-9a-f-]{36}\/cancel$/i;
const tripTransitionRoute=/^\/v1\/staging\/trips\/[0-9a-f-]{36}\/transition$/i;
const deliveryRequestRoute=/^\/v1\/staging\/sender\/deliveries\/request$/;
const deliveryQuoteConfirmRoute=/^\/v1\/staging\/sender\/deliveries\/quotes\/confirm$/;
const deliveryRecoverRoute=/^\/v1\/staging\/sender\/deliveries\/requests\/[0-9a-f-]{36}$/i;
const deliveryTransitionRoute=/^\/v1\/staging\/deliveries\/[0-9a-f-]{36}\/transition$/i;
const deliveryStatusRoute=/^\/v1\/staging\/deliveries\/[0-9a-f-]{36}\/status$/i;
// G143: Driver app G66 private custody endpoints; never bypass G10 offers.
const courierCustodyGetRoute=/^\/v1\/staging\/courier\/deliveries\/[0-9a-f-]{36}\/custody$/i;
const courierCustodyPostRoute=/^\/v1\/staging\/courier\/deliveries\/[0-9a-f-]{36}\/custody-transition$/i;
const verifiedRatingRoute=/^\/v1\/staging\/reputation\/ratings$/;
const adminFraudRoute=/^\/v1\/staging\/admin\/fraud\/verified-reports$/;
const merchantRequestRoute=/^\/v1\/staging\/buyer\/orders\/request$/;
const commerceQaRoute=/^\/v1\/staging\/buyer\/orders\/qa\/(reserve|cancel)$/;
const commerceQaReadRoute=/^\/v1\/staging\/buyer\/orders\/qa\/requests\/[0-9a-f-]{36}$/i;
const merchantTransitionRoute=/^\/v1\/staging\/(?:merchant|buyer)\/orders\/[0-9a-f-]{36}\/transition$/i;
const merchantAttachRoute=/^\/v1\/staging\/merchant\/orders\/[0-9a-f-]{36}\/attach-delivery$/i;
const merchantStatusRoute=/^\/v1\/staging\/orders\/[0-9a-f-]{36}\/status$/i;
const merchantInboxRoute=/^\/v1\/staging\/merchant\/[0-9a-f-]{36}\/orders\/inbox$/i;
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
const g187RecipientRoute=/^\/v1\/staging\/(?:sender|recipient)\/deliveries\/[0-9a-f-]{36}\/(?:recipient-bind|recipient-confirmation|confirmation|confirm)$/i;
const g197PickupRoute=/^\/v1\/staging\/driver\/pickup-preferences$/;
const g198LostItemRoute=/^\/v1\/staging\/(?:rider\/trips\/[0-9a-f-]{36}\/lost-items|driver\/lost-items|lost-items\/[0-9a-f-]{36}(?:\/(?:messages|close))?)$/i;
const g200MotoLostItemRoute=/^\/v1\/staging\/(?:rider\/moto\/trips\/[0-9a-f-]{36}\/lost-items|driver\/moto\/lost-items|moto\/lost-items\/[0-9a-f-]{36}(?:\/(?:messages|close))?)$/i;
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
 courierCustodyHandler,recipientConfirmationHandler,pickupPreferenceHandler,lostItemsHandler,motoLostItemsHandler,merchantInboxHandler,
 f1AutoHandler,motoHandler,driverMotoJourneyHandler,adminF1AuditHandler,adminServiceTraceHandler,adminMotoTraceHandler,adminCargoTraceHandler,adminCommerceTraceHandler,ownerCommissionHandler,ownerCargoRateHandler,driverDecisionRecoveryHandler,commerceQaHandler,ratingHandler,adminFraudHandler,
 courierPollHandler,driverInboxHandler,driverDocumentHandler,driverEnrollmentHandler,
 driverLicenseReadinessHandler,driverKycValidityHandler,driverTripStatusHandler,driverCurrentTripHandler,
}){
 if(typeof riderHandler!=='function'||
   (riderHistoryHandler!==undefined&&typeof riderHistoryHandler!=='function')||
   typeof offerHandler!=='function'||
   typeof tripCommandHandler!=='function'||
   (f1AutoHandler!==undefined&&typeof f1AutoHandler!=='function')||
   (motoHandler!==undefined&&typeof motoHandler!=='function')||
   (driverMotoJourneyHandler!==undefined&&typeof driverMotoJourneyHandler!=='function')||
   (adminF1AuditHandler!==undefined&&typeof adminF1AuditHandler!=='function')||
   (adminServiceTraceHandler!==undefined&&typeof adminServiceTraceHandler!=='function')||
   (adminMotoTraceHandler!==undefined&&typeof adminMotoTraceHandler!=='function')||
   (adminCargoTraceHandler!==undefined&&typeof adminCargoTraceHandler!=='function')||
   (adminCommerceTraceHandler!==undefined&&typeof adminCommerceTraceHandler!=='function')||
   (ownerCommissionHandler!==undefined&&typeof ownerCommissionHandler!=='function')||
   (ownerCargoRateHandler!==undefined&&typeof ownerCargoRateHandler!=='function')||
   (commerceQaHandler!==undefined&&typeof commerceQaHandler!=='function')||
   (ratingHandler!==undefined&&typeof ratingHandler!=='function')||
   (adminFraudHandler!==undefined&&typeof adminFraudHandler!=='function')||
   (courierCustodyHandler!==undefined&&typeof courierCustodyHandler!=='function')||
   (recipientConfirmationHandler!==undefined&&typeof recipientConfirmationHandler!=='function')||
   (pickupPreferenceHandler!==undefined&&typeof pickupPreferenceHandler!=='function')||
   (lostItemsHandler!==undefined&&typeof lostItemsHandler!=='function')||
   (motoLostItemsHandler!==undefined&&typeof motoLostItemsHandler!=='function')||
   (merchantInboxHandler!==undefined&&typeof merchantInboxHandler!=='function')||
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
  const driverMotoGet=req.method==='GET'&&
   (g169DriverMotoGet.test(path)||path===g189DriverMotoCurrent);
  const driverMotoPost=req.method==='POST'&&g169DriverMotoPost.test(path);
  const adminF1AuditGet=req.method==='GET'&&adminF1AuditRoute.test(path);
  const adminServiceTraceGet=req.method==='GET'&&adminServiceTraceRoute.test(path);
  const adminMotoTraceGet=req.method==='GET'&&adminMotoTraceRoute.test(path);
  const adminCargoTraceGet=req.method==='GET'&&adminCargoTraceRoute.test(path);
  const adminCommerceTraceGet=req.method==='GET'&&adminCommerceTraceRoute.test(path);
  const ownerCommissionGet=req.method==='GET'&&ownerCommissionRoute.test(path);
  const ownerCommissionPost=req.method==='POST'&&ownerCommissionRoute.test(path);
   const ownerCargoRateGet=req.method==='GET'&&ownerCargoRateRoute.test(path);
   const ownerCargoRatePost=req.method==='POST'&&ownerCargoRateRoute.test(path);
  const f1AutoPost=req.method==='POST'&&
   (f1AutoPostRoute.test(path)||f1AutoCancelPostRoute.test(path));
  // This POST is a read-only persisted quote disclosure: NO JSON request
  // body, no browser cookies, no network provider, no price supplied by Rider.
  const f1AutoSubsidyPost=req.method==='POST'&&f1AutoSubsidyPostRoute.test(path);
  const deliveryGet=req.method==='GET'&&
   (deliveryStatusRoute.test(path)||deliveryRecoverRoute.test(path));
  const deliveryPost=req.method==='POST'&&
   (deliveryRequestRoute.test(path)||deliveryQuoteConfirmRoute.test(path)||deliveryTransitionRoute.test(path));
  const ratingPost=req.method==='POST'&&verifiedRatingRoute.test(path);
  const adminFraudGet=req.method==='GET'&&adminFraudRoute.test(path);
  const commerceQaPost=req.method==='POST'&&commerceQaRoute.test(path);
  const commerceQaGet=req.method==='GET'&&commerceQaReadRoute.test(path);
  const courierCustodyGet=req.method==='GET'&&courierCustodyGetRoute.test(path);
  const courierCustodyPost=req.method==='POST'&&courierCustodyPostRoute.test(path);
  const recipientConfirmationGet=req.method==='GET'&&g187RecipientRoute.test(path);
  const recipientConfirmationPost=req.method==='POST'&&g187RecipientRoute.test(path);
  const pickupPreferenceGet=req.method==='GET'&&g197PickupRoute.test(path);
  const pickupPreferencePut=req.method==='PUT'&&g197PickupRoute.test(path);
  const lostItemsGet=req.method==='GET'&&g198LostItemRoute.test(path);
  const lostItemsPost=req.method==='POST'&&g198LostItemRoute.test(path);
  const motoLostItemsGet=req.method==='GET'&&g200MotoLostItemRoute.test(path);
  const motoLostItemsPost=req.method==='POST'&&g200MotoLostItemRoute.test(path);
  const merchantGet=req.method==='GET'&&merchantStatusRoute.test(path);
   const merchantInboxGet=req.method==='GET'&&merchantInboxRoute.test(path);
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
  if(!rider&&!riderHistory&&!offerGet&&!offerPost&&!offerRecoveryPost&&!tripPost&&!f1AutoGet&&!f1AutoPost&&!f1AutoSubsidyPost&&!motoPost&&!motoGet&&!driverMotoGet&&!driverMotoPost&&!adminF1AuditGet&&!adminServiceTraceGet&&!adminMotoTraceGet&&!adminCargoTraceGet&&!adminCommerceTraceGet&&!ownerCommissionGet&&!ownerCommissionPost&&!ownerCargoRateGet&&!ownerCargoRatePost&&
    !deliveryGet&&!deliveryPost&&
    !merchantGet&&!merchantInboxGet&&!merchantPost&&!adminFraudGet&&!ratingPost&&!commerceQaPost&&!commerceQaGet&&!courierCustodyGet&&!courierCustodyPost&&!recipientConfirmationGet&&!recipientConfirmationPost&&!pickupPreferenceGet&&!pickupPreferencePut&&!lostItemsGet&&!lostItemsPost&&!motoLostItemsGet&&!motoLostItemsPost&&!financeGet&&!financePost&&
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
  if((rider||riderHistory||offerGet||f1AutoGet||f1AutoSubsidyPost||motoGet||driverMotoGet||adminF1AuditGet||adminServiceTraceGet||adminMotoTraceGet||adminCargoTraceGet||adminCommerceTraceGet||adminFraudGet||ownerCommissionGet||ownerCargoRateGet||deliveryGet||courierCustodyGet||recipientConfirmationGet||pickupPreferenceGet||lostItemsGet||motoLostItemsGet||merchantGet||merchantInboxGet||commerceQaGet||financeGet||safetyGet||
      deliveryOfferGet||courierPollGet||driverInboxGet||driverDocumentGet||
      driverLicenseReadinessGet||driverKycValidityGet||driverTripStatusGet||driverCurrentTripGet)&&
     (req.headers['transfer-encoding']!==undefined||
      (req.headers['content-length']!==undefined&&req.headers['content-length']!=='0'))){
   send(res,400,{error:'GET body not supported'});return;
  }
  let body;
  if(offerPost||offerRecoveryPost||tripPost||f1AutoPost||motoPost||driverMotoPost||deliveryPost||merchantPost||financePost||safetyPost||
    merchantManagementPost||deliveryOfferPost||driverDocumentPost||driverEnrollmentPost||ownerCommissionPost||ownerCargoRatePost||ratingPost||commerceQaPost||courierCustodyPost||recipientConfirmationPost||pickupPreferencePut||lostItemsPost||motoLostItemsPost){
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??'')){
    send(res,415,{error:'JSON required'});return;
   }
   const declared=Number(req.headers['content-length']??0);
   const bodyLimit=commerceQaPost?8192:maxBody;
   if(!Number.isSafeInteger(declared)||declared<0||declared>bodyLimit){
    send(res,413,{error:'Body too large'});return;
   }
   const chunks=[];let length=0;
   try{
    for await (const chunk of req){
     length+=chunk.byteLength;
     if(length>bodyLimit){send(res,413,{error:'Body too large'});return;}
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
    (driverMotoGet||driverMotoPost)?(driverMotoJourneyHandler??(()=>({status:503,body:{error:'G169 MOTO Driver original SQL not authorized'}}))):
    (ownerCommissionGet||ownerCommissionPost)?(ownerCommissionHandler??(()=>({status:503,body:{error:'G116 Owner unavailable'}}))):
     (ownerCargoRateGet||ownerCargoRatePost)?(ownerCargoRateHandler??(()=>({status:503,body:{error:'G124 Owner cargo rate unavailable'}}))):
    adminF1AuditGet?(adminF1AuditHandler??(()=>({status:503,body:{error:'G75 IdP MFA unavailable'}}))):
    adminServiceTraceGet?(adminServiceTraceHandler??(()=>({status:503,body:{error:'G138 Admin trace unavailable'}}))):
    adminMotoTraceGet?(adminMotoTraceHandler??(()=>({status:503,body:{error:'G142 MOTO Admin trace unavailable'}}))):
    adminCargoTraceGet?(adminCargoTraceHandler??(()=>({status:503,body:{error:'G145 Cargo Admin trace unavailable'}}))):
    adminCommerceTraceGet?(adminCommerceTraceHandler??(()=>({status:503,body:{error:'G146 Commerce Admin trace unavailable'}}))):
    adminFraudGet?(adminFraudHandler??(()=>({status:503,body:{error:'G158 Admin fraud review unavailable'}}))):
    offerRecoveryPost?(driverDecisionRecoveryHandler??(()=>({status:503,body:{error:'G64 owner-only decision reader unavailable',retrySafe:false}}))):
    tripPost?tripCommandHandler:
    (deliveryGet||deliveryPost)?deliveryHandler:
    ratingPost?(ratingHandler??(()=>({status:503,body:{error:'G155 QA reputation not authorized'}}))):
    (commerceQaPost||commerceQaGet)?(commerceQaHandler??(()=>({status:503,body:{error:'G139 QA not mounted'}}))):
    (courierCustodyGet||courierCustodyPost)?(courierCustodyHandler??(()=>({status:503,body:{error:'G66 custody proof/session authority unavailable'}}))):
    (recipientConfirmationGet||recipientConfirmationPost)?(recipientConfirmationHandler??(()=>({status:503,body:{error:'G187 independent recipient session authority unavailable',retrySafe:false}}))):
    (pickupPreferenceGet||pickupPreferencePut)?(pickupPreferenceHandler??(()=>({status:503,body:{error:'G197 Driver road distance authority unavailable',retrySafe:false}}))):
    (lostItemsGet||lostItemsPost)?(lostItemsHandler??(()=>({status:503,body:{error:'G198 post-trip contact authority unavailable',retrySafe:false}}))):
    (motoLostItemsGet||motoLostItemsPost)?(motoLostItemsHandler??(()=>({status:503,body:{error:'G200 original MOTO post-trip contact authority unavailable',retrySafe:false}}))):
    merchantInboxGet?(merchantInboxHandler??(()=>({status:503,body:{error:'G156 staff inbox unavailable'}}))):
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
