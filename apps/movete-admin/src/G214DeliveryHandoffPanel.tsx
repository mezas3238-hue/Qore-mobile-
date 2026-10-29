import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createG214AdminHandoffClient}
 from './g214-delivery-handoff-client.mjs';
const env=import.meta.env;
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const webFetch=(url:string,options:unknown)=>fetch(url,options as RequestInit);
type Receipt={serviceId:string;serviceKind:string;deliveryState:string;
 revision:number;quoteId:string;bookingRequestKey:string;
 courierProofCommitted:boolean;recipientConfirmed:boolean;
 eligibleForSettlement:boolean;paymentAuthorized:false;commerciallyCertified:false;
 commerceOrderId:string|null;expiresAt:number};
/** Read-only, no personal recipient/courier details, no invented delivery. */
export function G214DeliveryHandoffPanel({authorized,subject}:{
 authorized:boolean;subject:string|null
}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createG214AdminHandoffClient({
  enabled:env.VITE_D_G214_OWNER_APPROVED==='true',
  ownerApproved:env.VITE_D_G214_OWNER_APPROVED==='true',
  contractVerified:env.VITE_D_G214_CONTRACT_VERIFIED==='true',
  externalRuntimeVerified:env.VITE_D_G214_EXTERNAL_RUNTIME_VERIFIED==='true',
  serverMfaVerified:env.VITE_D_G214_MFA_VERIFIED==='true',
  serverRbacVerified:env.VITE_D_G214_RBAC_VERIFIED==='true',
  serverRevocationVerified:env.VITE_D_G214_REVOCATION_VERIFIED==='true',
  origin:env.VITE_D_G214_STAGING_ORIGIN,
  pinnedOrigin:env.VITE_D_G214_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??Promise.resolve(null),
  fetchImpl:webFetch
 }),[auth]);
 const [kind,setKind]=useState<'DELIVERY_AUTO'|'DELIVERY_MOTO'>('DELIVERY_AUTO');
 const [id,setId]=useState('');
 const [data,setData]=useState<Receipt|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const epoch=useRef(0);
 useEffect(()=>{
  epoch.current++;gateway.cancelPending();
  setData(null);setMessage('');setBusy(false);
 },[gateway,authorized,subject]);
 async function inspect(){
  if(!authorized||!subject||!gateway.isConfigured()||busy||!ID.test(id))
   return;
  const version=++epoch.current;
  setBusy(true);setData(null);setMessage('');
  try{
   const result=await gateway.read(kind,id.toLowerCase());
   if(version!==epoch.current)return;
   if(!result.ok){setMessage(result.code);return;}
   if(result.item.expiresAt<=Date.now()){
    setMessage('La evidencia caducó: consultá de nuevo.');return;
   }
   setData(result.item as Receipt);
  }catch{if(version===epoch.current)setMessage('Lectura no disponible');}
  finally{if(version===epoch.current)setBusy(false);}
 }
 return <section className="panel detail" aria-label="Entrega independiente con comprobante de destinatario">
  <div className="section-head"><div>
   <h2>Cadena de entrega y confirmación del destinatario</h2>
   <p>Repartidor → prueba de entrega → destinatario → estado Admin.
    Se consulta el ID original; no se dan por terminadas entregas sin evidencia.</p>
  </div><span className="muted-tag">G214 · STAGING · LECTURA</span></div>
  {!authorized?<p>Requiere Admin con autenticación multifactor.</p>:
   !gateway.isConfigured()?<p>La consulta está preparada, pero no se habilita hasta verificar
    HTTPS externo, PostgreSQL, MFA, revocación y autorización de Owner.</p>:
   <div className="kyc-filters">
    <label htmlFor="g214-kind">Servicio</label>
    <select id="g214-kind" value={kind} disabled={busy} onChange={e=>{
     epoch.current++;gateway.cancelPending();
     setKind(e.target.value as 'DELIVERY_AUTO'|'DELIVERY_MOTO');
     setData(null);setMessage('');
    }}>
     <option value="DELIVERY_AUTO">Envío AUTO</option>
     <option value="DELIVERY_MOTO">Envío MOTO</option>
    </select>
    <label htmlFor="g214-delivery">ID original del envío</label>
    <input id="g214-delivery" value={id} maxLength={36} autoComplete="off"
     onChange={e=>{epoch.current++;gateway.cancelPending();
      setId(e.target.value);setData(null);setMessage('');}}
     placeholder="UUID de PostgreSQL"/>
    <button type="button" disabled={busy||!ID.test(id)}
     onClick={()=>void inspect()}>{busy?'Verificando…':'Consultar entrega original'}</button>
   </div>}
  {message&&<p role="alert">{message}</p>}
  {data&&data.expiresAt>Date.now()&&<div className="kyc-records" role="status">
   <div className="kyc-record"><div>
    <strong>{data.serviceKind} · {data.deliveryState}</strong>
    <small>Entrega original {data.serviceId} · revisión {data.revision}</small>
    <small>Reserva: {data.bookingRequestKey} · cotización: {data.quoteId}</small>
    <small>Repartidor: {data.courierProofCommitted?'Prueba registrada':'SIN PRUEBA'}</small>
    <small>Destinatario: {data.recipientConfirmed
     ?'Confirmación independiente verificada':'Confirmación NO recibida'}</small>
    <small>{data.eligibleForSettlement
     ?'Solo elegibilidad registrada (NO es pago)'
     :'No elegible para liquidación; posible pendiente, disputa o devolución'}</small>
    {data.commerceOrderId&&<small>Pedido comercial vinculado: {data.commerceOrderId}</small>}
   </div><span className="muted-tag">SIN PAGO · SIN CERTIFICACIÓN LIVE</span></div>
  </div>}
  <p className="training-disclaimer">Evidencia de laboratorio, nunca prueba de entrega física
   real, permisos municipales, GPS certificado ni autorización de cobro.
   No muestra datos privados del destinatario o repartidor.</p>
 </section>;
}
