/** STAGING only. No dispatch, storage, or commercial delivery. */
export const DELIVERY_LIVE_ENABLED = false;
const states = Object.freeze({requested:{accept:'accepted',cancel:'cancelled'},accepted:{pickup:'picked_up',cancel:'cancelled'},picked_up:{deliver:'delivered',dispute:'disputed'},disputed:{return:'returned',resolve:'delivered'}});
export function nextSyntheticDeliveryState(state,action){
 const next=Object.prototype.hasOwnProperty.call(states,state)?states[state][action]:undefined;
 return next?{ok:true,state:next,liveEnabled:false}:{ok:false,reason:'Invalid transition',liveEnabled:false};
}
export function checkSyntheticParcel({vehicle,grams,lengthCm,widthCm,heightCm}={}){
 const int=(v,max)=>Number.isSafeInteger(v)&&v>0&&v<=max;
 if(!['AUTO','MOTO'].includes(vehicle)||!int(grams,100000)||!int(lengthCm,200)||!int(widthCm,200)||!int(heightCm,200))return {ok:false,reason:'Invalid parcel',liveEnabled:false};
 const volume=lengthCm*widthCm*heightCm;
 const permitted=vehicle==='MOTO'?grams<=10000&&volume<=45000&&Math.max(lengthCm,widthCm,heightCm)<=60:volume<=1000000;
 return {ok:permitted,reason:permitted?null:'Capacity exceeded',liveEnabled:false};
}
