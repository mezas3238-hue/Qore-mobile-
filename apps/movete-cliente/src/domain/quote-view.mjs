/**
 * Quote UI: solo proyecta un DTO explícito validado. Contrato propuesto
 * a A, NO certificado ni conectado a OpenAPI. No deriva importe de km/min.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const modes=new Set(['AUTO','DELIVERY','MERCHANT_DELIVERY']);
const subjects=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
export function inspectServerQuote(value,{subject,now=Date.now()}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(typeof subject!=='string'||!UUID.test(subject)||value.ownerId!==subject)return null;
 if(!UUID.test(value.quoteId||'')||!Number.isSafeInteger(value.amountGs)
  ||value.amountGs<1||value.amountGs>1000000000
  ||!modes.has(value.fareMode)||!subjects.has(value.subjectKind)
  ||!UUID.test(value.subjectId||'')
  ||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now
  ||value.expiresAt>now+3600000
  ||typeof value.fareVersion!=='string'||value.fareVersion.length<1||value.fareVersion.length>80
  ||value.routingVerified!==true)return null;
 if(value.subjectKind==='RIDE'&&value.fareMode!=='AUTO')return null;
 if(value.subjectKind==='DELIVERY'&&value.fareMode!=='DELIVERY')return null;
 if(value.subjectKind==='MERCHANT_ORDER'&&value.fareMode!=='MERCHANT_DELIVERY')return null;
 return Object.freeze({
  quoteId:value.quoteId,subjectId:value.subjectId,amountGs:value.amountGs,
  fareMode:value.fareMode,subjectKind:value.subjectKind,expiresAt:value.expiresAt,
  fareVersion:value.fareVersion,formattedAmount:new Intl.NumberFormat('es-PY',{
    style:'decimal',maximumFractionDigits:0
  }).format(value.amountGs)+' Gs.'
 });
}
export function createQuoteViewStore({now=()=>Date.now()}={}){
 let data=null;
 function show(dto,subject){
  data=inspectServerQuote(dto,{subject,now:now()});
  return data!==null;
 }
 function current(){
  if(!data||data.expiresAt<=now()){data=null;return null;}
  return data;
 }
 function clear(){data=null;}
 return Object.freeze({show,current,clear});
}
