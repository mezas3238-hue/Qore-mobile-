/** D Owner — anti-cross-scope fence for asynchronous tariff/commission requests.
 * A response from a prior vehicle, zone, role or gateway cannot alter the
 * currently selected policy. The backend alone authorizes actual writes.
 */
export function createOwnerPolicyScopeFence(){
 let generation=0,selection=null;
 return Object.freeze({
  select(...parts){
   if(parts.length===0||parts.some(x=>x===null||x===undefined))
    throw Error('Owner policy scope required');
   if(!selection||selection.length!==parts.length||
    parts.some((x,i)=>!Object.is(x,selection[i]))){
    selection=parts;generation++;
   }
   return generation;
  },
  current(ticket){return Number.isSafeInteger(ticket)&&ticket===generation;},
  invalidate(){generation++;selection=null;}
 });
}
