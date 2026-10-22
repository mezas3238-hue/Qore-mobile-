/** QORE synthetic STAGING fares: no billing or collections. Integer PYG only. */
export const FARE_LIVE_ENABLED=false;
const modes=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const round=(a,b)=>Math.floor((a+Math.floor(b/2))/b);
export function quoteSyntheticFare({mode,distanceMeters,durationSeconds,basePyg,perKmPyg,perMinutePyg,minPyg,tollsPyg=0,commissionBps,ruleVersion}){
 if(!modes.has(mode)||!integer(distanceMeters,0,500000)||!integer(durationSeconds,0,86400)||!integer(basePyg,0,1000000)||!integer(perKmPyg,0,100000)||!integer(perMinutePyg,0,20000)||!integer(minPyg,0,1000000)||!integer(tollsPyg,0,1000000)||!integer(commissionBps,0,3000)||typeof ruleVersion!=='string'||!/^[a-zA-Z0-9._-]{1,48}$/.test(ruleVersion))return {ok:false,reason:'Invalid synthetic fare inputs',liveEnabled:false};
 const distanceCharge=round(distanceMeters*perKmPyg,1000);
 const timeCharge=round(durationSeconds*perMinutePyg,60);
 const subtotal=Math.max(minPyg,basePyg+distanceCharge+timeCharge);
 const totalPyg=subtotal+tollsPyg;
 if(!integer(totalPyg,0,100000000))return {ok:false,reason:'Synthetic fare exceeds limit',liveEnabled:false};
 const commissionPyg=round(subtotal*commissionBps,10000);
 return {ok:true,liveEnabled:false,mode,ruleVersion,totalPyg,subtotalPyg:subtotal,tollsPyg,commissionBps,commissionPyg,providerPyg:totalPyg-commissionPyg,breakdown:{basePyg,distanceChargePyg:distanceCharge,timeChargePyg:timeCharge,minPyg}};
}
export function verifySyntheticQuote(q){return q?.ok===true&&q.liveEnabled===false&&integer(q.totalPyg,0,100000000)&&integer(q.commissionPyg,0,q.totalPyg)&&q.providerPyg+q.commissionPyg===q.totalPyg;}
