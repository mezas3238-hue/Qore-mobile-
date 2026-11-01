/**
 * G304 Cliente payment choices. Commerce is PREPAID DIGITAL ONLY.
 * All availability is explicit from a trusted server/PSP capability snapshot,
 * not invented from the presence of a checkout button.
 * No payment is initiated by this UI contract.
 */
export const CLIENT_COMMERCE_CASH_ENABLED=false;
const validKind=new Map([
 ['RIDE',new Set(['AUTO','MOTO'])],
 ['DELIVERY',new Set(['DELIVERY'])],
 ['MERCHANT_ORDER',new Set(['MERCHANT_DELIVERY'])]
]);
const SUPPORTED_METHODS=Object.freeze(['CARD','BANK_TRANSFER','QR','CASH']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const denied=code=>Object.freeze({ok:false,code,options:Object.freeze([])});
export function chooseClientPaymentOptions(input){
 if(!exact(input,['subjectKind','fareMode','cardAvailable','cashAvailable',
  'bankTransferAvailable','qrAvailable','commercePrepayBackendCertified']))
  return denied('UNVERIFIED_PAYMENT_CAPABILITIES');
 const {subjectKind,fareMode,cardAvailable,cashAvailable,
  bankTransferAvailable,qrAvailable,commercePrepayBackendCertified}=input;
 if(!validKind.get(subjectKind)?.has(fareMode))return denied('UNSUPPORTED_SERVICE');
 if(![cardAvailable,cashAvailable,bankTransferAvailable,qrAvailable,
  commercePrepayBackendCertified].every(x=>typeof x==='boolean'))
  return denied('UNVERIFIED_PAYMENT_CAPABILITIES');
 if(subjectKind==='MERCHANT_ORDER'){
  // Cannot advertise an online checkout without a certified server
  // ready to verify funds BEFORE products are prepared or dispatched.
  if(commercePrepayBackendCertified!==true)
   return denied('MERCHANT_PREPAYMENT_BACKEND_NOT_READY');
  const options=[
   ...(cardAvailable?['CARD']:[]),
   ...(bankTransferAvailable?['BANK_TRANSFER']:[]),
   ...(qrAvailable?['QR']:[])
  ];
  return options.length===0?denied('NO_PREPAY_METHOD_AVAILABLE'):
   Object.freeze({ok:true,options:Object.freeze(options),prepaidRequired:true,
    cashAllowed:false,canSubmitOrderWithoutVerifiedPayment:false});
 }
 const options=[
  ...(cashAvailable?['CASH']:[]),
  ...(cardAvailable?['CARD']:[])
 ];
 return options.length===0?denied('NO_TRIP_PAYMENT_METHOD'):
  Object.freeze({ok:true,options:Object.freeze(options),prepaidRequired:false,
   cashAllowed:cashAvailable,canSubmitOrderWithoutVerifiedPayment:false});
}
export function validateClientPaymentChoice(input,method){
 const permitted=chooseClientPaymentOptions(input);
 if(!permitted.ok)return permitted;
 if(typeof method!=='string'||!SUPPORTED_METHODS.includes(method)||
  !permitted.options.includes(method))
  return denied('PAYMENT_METHOD_NOT_PERMITTED');
 return Object.freeze({ok:true,method,
  prepaidRequired:permitted.prepaidRequired,
  requiresIndependentServerProof:permitted.prepaidRequired,
  paymentExecuted:false,orderReleased:false});
}
