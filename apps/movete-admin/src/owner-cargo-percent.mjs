/** Admin Owner: visible cargo commission as percent, wire format as basis points.
 * 12.50% => 1250 bps, 15% => 1500 bps. No locale ambiguity or rounding.
 */
export function parseOwnerCargoPercent(value){
 if(typeof value!=='string'||!/^[0-9]{1,2}(?:\.[0-9]{1,2})?$/.test(value))
  return null;
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>30)return null;
 const exact=n*100,bps=Math.round(exact);
 return Number.isSafeInteger(bps)&&Math.abs(exact-bps)<0.000001?bps:null;
}
export function displayOwnerCargoPercent(bps){
 if(!Number.isSafeInteger(bps)||bps<0||bps>3000)return null;
 return String(bps/100);
}
