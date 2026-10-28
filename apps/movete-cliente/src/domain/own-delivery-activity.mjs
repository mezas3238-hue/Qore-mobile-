/**
 * B#16 — Envíos propios, única evidencia: G26 historial + G68 custodia.
 * Both AUTO and MOTO share an owner-scoped DELIVERY id; vehicle kind
 * is displayed only after a separately authenticated G68 server GET.
 * No price, Driver PII, GPS, delivery proof or payout is fabricated.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const HISTORY=new Set(['searching','assigned','in_progress','completed','cancelled','failed']);
const CUSTODY=new Set(['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
const kindLabel=Object.freeze({AUTO:'Auto para envíos',MOTO:'Moto para envíos'});
const stateLabel=Object.freeze({
 requested:'Solicitud registrada',accepted:'Repartidor aceptó',picked_up:'Paquete recogido',
 delivered:'Entrega registrada',disputed:'Entrega en revisión',
 returned:'Devuelto',cancelled:'Cancelado'
});
function snapshotShape(view){
 const id=view?.account?.subject;
 if(view?.authenticated!==true||typeof id!=='string'||!UUID.test(id)
  ||view.account.role!=='passenger'||view.history?.ownerId!==id
  ||!Array.isArray(view.history.items))return null;
 return view.history.items;
}
export function projectOwnDeliveryActivity(view,{limit=12}={}){
 const list=snapshotShape(view);
 const ready=Boolean(view?.authenticated===true&&view?.historyConfigured===true);
 const custodyReady=Boolean(ready&&view?.senderCustody?.readReady===true);
 const busy=Boolean(view?.historyLoading||view?.senderCustody?.loading);
 if(!list)return Object.freeze({ready,canLoad:ready&&!view?.historyLoading,
  custodyReady:false,busy,rows:Object.freeze([]),selected:null,
  qaOnly:true,productionEnabled:false});
 const rows=[];
 for(const entry of list){
  if(entry?.kind!=='DELIVERY'||typeof entry.serviceId!=='string'
   ||!UUID.test(entry.serviceId)||!HISTORY.has(entry.status)
   ||!Number.isSafeInteger(entry.revision)||entry.revision<1
   ||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)continue;
  if(rows.length>=limit)break;
  rows.push(Object.freeze({deliveryId:entry.serviceId,
   shortRef:entry.serviceId.slice(-8).toUpperCase(),
   status:'Registrado en historial privado · '+entry.status,
   revision:entry.revision,
   // History deliberately lacks AUTO/MOTO: never infer it from a local draft.
   vehicleKind:null,canVerify:custodyReady&&!view.senderCustody.loading}));
 }
 const proof=view.senderCustody;
 const belongs=rows.some(row=>row.deliveryId===proof?.deliveryId);
 const trusted=belongs&&custodyReady&&!view.senderCustody.loading
  &&typeof proof?.vehicleKind==='string'
  &&Object.hasOwn(kindLabel,proof.vehicleKind)
  &&CUSTODY.has(proof.state)&&Number.isSafeInteger(proof.revision)
  &&proof.revision>=1&&typeof proof.proofVerified==='boolean';
 const verifiedDelivery=trusted&&proof.state==='delivered'&&proof.proofVerified===true;
 const selected=trusted?Object.freeze({
  deliveryId:proof.deliveryId,vehicleKind:proof.vehicleKind,
  vehicleLabel:kindLabel[proof.vehicleKind],state:proof.state,
  stateLabel:stateLabel[proof.state],revision:proof.revision,
  // A status read alone NEVER verifies delivery without G68 proof.
  proofVerified:verifiedDelivery,complete:verifiedDelivery,
  paymentConfirmed:false,gpsVerified:false,etaVerified:false
 }):null;
 return Object.freeze({ready,canLoad:ready&&!view.historyLoading,
  custodyReady,busy,rows:Object.freeze(rows),selected,
  qaOnly:true,productionEnabled:false});
}
