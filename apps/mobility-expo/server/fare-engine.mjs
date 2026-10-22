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
export function verifySyntheticQuote(q){
 if(q?.ok!==true||q.liveEnabled!==false||!modes.has(q.mode)||!integer(q.totalPyg,0,100000000)||!integer(q.subtotalPyg,0,100000000)||!integer(q.tollsPyg,0,1000000)||!integer(q.commissionBps,0,3000)||!integer(q.commissionPyg,0,q.totalPyg)||!integer(q.providerPyg,0,q.totalPyg))return false;
 const b=q.breakdown;
 if(typeof q.ruleVersion!=='string'||!/^[a-zA-Z0-9._-]{1,48}$/.test(q.ruleVersion)||!b||!integer(b.basePyg,0,1000000)||!integer(b.distanceChargePyg,0,50000000)||!integer(b.timeChargePyg,0,28800000)||!integer(b.minPyg,0,1000000))return false;
 return q.subtotalPyg===Math.max(b.minPyg,b.basePyg+b.distanceChargePyg+b.timeChargePyg)&&q.totalPyg===q.subtotalPyg+q.tollsPyg&&q.commissionPyg===round(q.subtotalPyg*q.commissionBps,10000)&&q.providerPyg+q.commissionPyg===q.totalPyg;
}
