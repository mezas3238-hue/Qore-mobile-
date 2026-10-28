/**
 * F1 AUTO presentation fence. The UI may display only a verified, unexpired
 * PYG quote from the QA consumer flow. It never derives fares from the route.
 * A route cannot be edited while its server quote/POST is active.
 */
const ACTIVE=new Set(['ready','quoting','quoted','accepted','sending','ambiguous','confirmed']);
const DISCARD=new Set(['ready','quoting','quoted','accepted','expired','failed']);
export function projectAutoPrequoteScreen({
 prequote=null,authenticated=false,mutationPhase='idle',now=Date.now()
}={}){
 const phase=typeof prequote?.phase==='string'?prequote.phase:'unknown';
 const quote=prequote?.quote;
 const valid=quote!==null&&typeof quote==='object'
  &&prequote?.quoteAvailable===true
  &&quote.currency==='PYG'
  &&typeof quote.quoteId==='string'
  &&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quote.quoteId)
  &&Number.isSafeInteger(quote.amountGs)&&quote.amountGs>0
  &&typeof quote.fareVersion==='string'&&quote.fareVersion.length>0
  &&Number.isSafeInteger(quote.expiresAt)&&quote.expiresAt>now;
 const visible=Boolean(valid&&['quoted','accepted','sending'].includes(phase));
 const discount=prequote?.subsidy,required=prequote?.subsidyRequired===true;
 const validDiscount=Boolean(valid&&discount
  &&discount.quoteId===quote.quoteId
  &&discount.fareVersion===quote.fareVersion
  &&discount.originalFareGs===quote.amountGs
  &&discount.commissionBps===1500&&discount.subsidyBps===1000
  &&Number.isSafeInteger(discount.customerSubsidyGs)
  &&Number.isSafeInteger(discount.customerPaysGs)
  &&discount.customerPaysGs===discount.originalFareGs-discount.customerSubsidyGs
  &&Number.isSafeInteger(discount.expiresAt)&&discount.expiresAt>now
  &&discount.expiresAt<=quote.expiresAt);
 const ready=authenticated===true&&mutationPhase==='idle';
 return Object.freeze({
  phase,quote:visible?Object.freeze({...quote}):null,
  amountLabel:visible?'Gs. '+quote.amountGs.toLocaleString('es-PY'):null,
  subsidyRequired:required,
  subsidy:visible&&validDiscount?Object.freeze({...discount}):null,
  canPreviewSubsidy:ready&&valid&&required&&!validDiscount
   &&prequote.subsidyAvailable===true&&prequote.subsidyLoading!==true
   &&phase==='quoted',
  canEditRoute:!ACTIVE.has(phase)&&phase!=='unknown',
  canAccept:ready&&valid&&phase==='quoted'&&prequote.canAccept===true
   &&(!required||validDiscount),
  canReserve:ready&&valid&&phase==='accepted'
   &&prequote.bookingAvailable===true&&prequote.canReserve===true
   &&(!required||validDiscount),
  canReconcile:authenticated===true&&phase==='ambiguous'
   &&prequote.requiresReconciliation===true,
  canDiscard:authenticated===true&&DISCARD.has(phase),
  locked:ACTIVE.has(phase),
  productionEnabled:false
 });
}
