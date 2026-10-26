/** Private AUTO/MOTO passenger route handoff: RAM only, no URLs or durable storage.
 * Does not imply geocoding, price, coverage, permission or a reservation.
 */
import {emptyLocalRouteDraft,editLocalRouteDraft,reviewLocalRouteDraft} from './client-route-editor.mjs';
const TEN_MINUTES=10*60*1000;
const fail=reason=>Object.freeze({ok:false,reason});
export function createPassengerRideIntent({now=Date.now}={}){
 if(typeof now!=='function')throw Error('Clock required');
 let value=null;
 const validRevision=x=>Number.isSafeInteger(x)&&x>=0;
 function save({ownerRevision,kind,origin,destination}={}){
  if(!validRevision(ownerRevision)||!['AUTO','MOTO'].includes(kind))
   return fail('INVALID_PASSENGER_SCOPE');
  const first=editLocalRouteDraft(emptyLocalRouteDraft(),{type:'origin',value:origin});
  if(!first.ok)return fail('INVALID_PASSENGER_ROUTE');
  const second=editLocalRouteDraft(first.route,{type:'destination',value:destination});
  if(!second.ok)return fail('INVALID_PASSENGER_ROUTE');
  const checked=reviewLocalRouteDraft(second.route);
  if(!checked.ok)return fail('INVALID_PASSENGER_ROUTE');
  const timestamp=now();
  if(!Number.isSafeInteger(timestamp)||timestamp<0)return fail('INVALID_CLOCK');
  value=Object.freeze({ownerRevision,kind,origin:checked.route.origin,
   destination:checked.route.destination,createdAt:timestamp});
  return Object.freeze({ok:true});
 }
 function read(ownerRevision,kind){
  if(!value)return null;
  const age=now()-value.createdAt;
  if(!Number.isSafeInteger(age)||age<0||age>TEN_MINUTES||
     value.ownerRevision!==ownerRevision){
   value=null;return null;
  }
  return value.kind===kind?value:null;
 }
 function clear(){value=null;}
 return Object.freeze({save,read,clear});
}
