/**
 * G320 only two input UUIDs; never user_id, session_id, summary or
 * customer information. The verified actor comes from Auth on the server.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function exactKeys(x,keys){return Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
export function parseSupportClaimIntent(x){
 if(!plain(x)||!exactKeys(x,['ticket_id','idempotency_key'])||
  typeof x.ticket_id!=='string'||!UUID.test(x.ticket_id)||
  typeof x.idempotency_key!=='string'||!UUID.test(x.idempotency_key))return null;
 return Object.freeze({ticket_id:x.ticket_id,idempotency_key:x.idempotency_key});
}
export function parseSupportClaimReceipt(x,intent){
 if(!plain(x)||!intent||!exactKeys(x,['claim_id','ticket_id','outcome'])||
  typeof x.claim_id!=='string'||!UUID.test(x.claim_id)||
  x.ticket_id!==intent.ticket_id||x.outcome!=='CLAIMED')return null;
 return Object.freeze({claim_id:x.claim_id,ticket_id:x.ticket_id,outcome:'CLAIMED'});
}
