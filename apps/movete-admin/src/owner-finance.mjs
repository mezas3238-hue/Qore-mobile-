/**
 * Owner Finance — contrato de proyección propuesto (NO API certificada).
 * Ningún dato se infiere de kilómetros, viajes o comisiones locales.
 * Solo aceptar resúmenes agregados, conciliados y declarados por servidor.
 * Nunca incluir PII, facturación individual, claves ni cuentas bancarias.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=1_000_000_000_000;
const signed=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1_000_000_000_000;
const own=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(o,k));
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const dateValue=s=>{
 if(typeof s!=='string'||!DATE.test(s))return null;
 const parsed=new Date(s+'T00:00:00.000Z');
 return Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==s?null:parsed.getTime();
};
export const OWNER_TOTAL_FIELDS=Object.freeze([
 'completedRides','completedDeliveries','completedMerchantOrders',
 'grossCollectedGs','driverPayoutGs','platformCommissionGs',
 'refundsGs','processingFeesGs','netPlatformGs'
]);
export function projectOwnerFinance(payload,{role,subject,now=Date.now()}={}){
 if(role!=='owner'||typeof subject!=='string'||!UUID.test(subject)
  ||!own(payload,['scope','ownerId','period','currency','revision',
    'ledgerRevision','reconciliationStatus','generatedAt','expiresAt','totals'])
  ||payload.scope!=='owner.finance.read'||payload.ownerId!==subject
  ||payload.currency!=='PYG'||payload.reconciliationStatus!=='RECONCILED'
  ||!Number.isSafeInteger(payload.revision)||payload.revision<0
  ||!Number.isSafeInteger(payload.ledgerRevision)||payload.ledgerRevision<1
  ||!Number.isSafeInteger(payload.generatedAt)||payload.generatedAt>now
  ||payload.generatedAt<now-300000||!Number.isSafeInteger(payload.expiresAt)
  ||payload.expiresAt<=now||payload.expiresAt-payload.generatedAt>300000
  ||!own(payload.period,['from','to','timezone'])
  ||payload.period.timezone!=='America/Asuncion'
  ||!own(payload.totals,OWNER_TOTAL_FIELDS))return null;
 const from=dateValue(payload.period.from),to=dateValue(payload.period.to);
 if(from===null||to===null||from>to||to-from>92*86400000)return null;
 if(!OWNER_TOTAL_FIELDS.every(f=>f==='netPlatformGs'?signed(payload.totals[f]):integer(payload.totals[f])))return null;
 const totals=Object.freeze({...payload.totals});
 return Object.freeze({
  period:Object.freeze({...payload.period}),currency:'PYG',
  revision:payload.revision,ledgerRevision:payload.ledgerRevision,
  reconciliationStatus:'RECONCILED',generatedAt:payload.generatedAt,
  expiresAt:payload.expiresAt,totals
 });
}
export function createOwnerFinanceStore({now=()=>Date.now()}={}){
 let data=null,identity=null;
 function clear(){data=null;identity=null;}
 function replace(payload,session){
  const next=projectOwnerFinance(payload,{
   role:session?.role,subject:session?.subject,now:now()
  });
  if(!next){clear();return false;}
  if(identity!==null&&identity!==session.subject){clear();return false;}
  if(data){
   const samePeriod=next.period.from===data.period.from
    &&next.period.to===data.period.to
    &&next.period.timezone===data.period.timezone;
   // For an unchanged accounting period, a server GET is not allowed to
   // silently edit already-reconciled money or counts at the SAME ledger
   // revision. Never show a contradictory balance by simply reloading.
   if(next.ledgerRevision<data.ledgerRevision
    ||(samePeriod&&(next.revision<data.revision
     ||next.generatedAt<data.generatedAt
     ||(next.ledgerRevision===data.ledgerRevision&&
      OWNER_TOTAL_FIELDS.some(field=>next.totals[field]!==data.totals[field]))))){
    clear();return false;
   }
  }
  identity=session.subject;data=next;return true;
 }
 function current(session){
  if(!data||data.expiresAt<=now()
    ||!session||session.role!=='owner'||session.subject!==identity){
   clear();return null;
  }
  return data;
 }
 return Object.freeze({replace,current,clear});
}
