/**
 * G306 — isolated verification boundary for PREPAID merchant goods.
 * NO PSP is configured here; no API capture, mutation, payout or transfer.
 * A future trusted PSP adapter MUST verify signed event + independently
 * query the provider, then return a narrow attestation. The phone never
 * supplies amount, method, verified status or payer identity.
 */
export const G306_LIVE_COMMERCE_ENABLED=false;
export const G306_REAL_PSP_CONNECTED=false;
export const G306_ORDER_RELEASE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF=/^[a-zA-Z0-9._:-]{8,120}$/;
const exact=(value,fields)=>value!==null&&typeof value==='object'&&
 !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
 Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k));
const money=(v)=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
const rejected=(code)=>Object.freeze({ok:false,code,qaOnly:true,
 merchantCanPrepare:false,payoutEnabled:false,liveEnabled:false});
const ORDER=['orderId','buyerId','merchantId','merchantSubtotalPyg',
 'deliveryFeePyg','totalPyg','quoteVersion','reservedStock','status',
 'expiresAtMs','serverPersisted'];
const PROOF=['orderId','buyerId','paymentReference','eventReference',
 'provider','method','status','amountPyg','currency',
 'signedCallbackVerified','providerLookupVerified','refundOrChargeback',
 'capturedAtMs'];
/** Intentionally cannot accept raw payment form details or pasted webhook.
 * getOrder: independent DB state, never user/client payload.
 * getTrustedProviderReceipt: private adapter with signature validation AND
 * authenticated provider-status lookup, never a Browser Supabase callback.
 */
export function createG306CommercePrepayVerifier({
 environment,qaOnly,liveEnabled,getOriginalOrder,getTrustedProviderReceipt,
 now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [getOriginalOrder,getTrustedProviderReceipt,now].some(x=>typeof x!=='function'))
  throw Error('G306 requires isolated server-only order + PSP verification adapters');
 return async ({orderId,paymentReference}={})=>{
  if(!UUID.test(orderId??'')||!REF.test(paymentReference??''))
   return rejected('INVALID_PREPAYMENT_REFERENCE');
  const at=now();
  if(!Number.isSafeInteger(at)||at<=0)return rejected('INVALID_SERVER_TIME');
  let order;
  try{order=await getOriginalOrder({orderId});}
  catch{return rejected('ORDER_LOOKUP_UNAVAILABLE');}
  if(!exact(order,ORDER)||order.orderId!==orderId||
   !UUID.test(order.buyerId??'')||!UUID.test(order.merchantId??'')||
   order.buyerId===order.merchantId||
   !money(order.merchantSubtotalPyg)||order.merchantSubtotalPyg===0||
   !money(order.deliveryFeePyg)||!money(order.totalPyg)||
   order.totalPyg!==order.merchantSubtotalPyg+order.deliveryFeePyg||
   order.totalPyg===0||!REF.test(order.quoteVersion??'')||
   order.reservedStock!==true||order.serverPersisted!==true||
   !['requested','confirmed','AWAITING_PAYMENT','RESERVED'].includes(order.status)||
   !Number.isSafeInteger(order.expiresAtMs)||order.expiresAtMs<=at)
   return rejected('ORIGINAL_ORDER_NOT_PAYABLE');
  let proof;
  try{proof=await getTrustedProviderReceipt({
   orderId,paymentReference,expectedAmountPyg:order.totalPyg,
   expectedBuyerId:order.buyerId
  });}catch{return rejected('PSP_VERIFICATION_UNAVAILABLE');}
  if(!exact(proof,PROOF)||proof.orderId!==orderId||
   proof.buyerId!==order.buyerId||
   proof.paymentReference!==paymentReference||
   !REF.test(proof.eventReference??'')||
   !REF.test(proof.provider??'')||
   !['CARD','QR','BANK_TRANSFER'].includes(proof.method)||
   (proof.method==='CARD'
    ?!['CAPTURED','SETTLED'].includes(proof.status):proof.status!=='SETTLED')||
   proof.currency!=='PYG'||!money(proof.amountPyg)||
   proof.amountPyg!==order.totalPyg||
   proof.signedCallbackVerified!==true||
   proof.providerLookupVerified!==true||proof.refundOrChargeback!==false||
   !Number.isSafeInteger(proof.capturedAtMs)||proof.capturedAtMs<=0||
   proof.capturedAtMs>at+60000)
   return rejected('PSP_ATTESTATION_NOT_MATCHED');
  // No order transition: receipt is one input to a FUTURE atomic SQL writer.
  // A successful provider read alone MUST NEVER release products.
  return Object.freeze({ok:true,mode:'STAGING_VERIFICATION_ONLY',
   liveEnabled:false,qaOnly:true,orderId,merchantId:order.merchantId,
   buyerId:order.buyerId,paymentReference:proof.paymentReference,
   providerEventReference:proof.eventReference,provider:proof.provider,
   method:proof.method,status:proof.status,amountPyg:proof.amountPyg,
   currency:'PYG',quoteVersion:order.quoteVersion,
   paymentVerifiedAtMs:at,needsAtomicDatabaseCommit:true,
   merchantCanPrepare:false,merchantCanDispatch:false,
   payoutEnabled:false,bankTransferExecuted:false});
 };
}
