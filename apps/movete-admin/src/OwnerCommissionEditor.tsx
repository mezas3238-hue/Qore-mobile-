import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createOwnerPolicyScopeFence} from './owner-policy-scope-fence.mjs';
import {createOwnerCommissionGateway} from './owner-commission-gateway.mjs';
import type {CommissionKind,CommissionReceipt} from './owner-commission-gateway.mjs';

/** Owner-only commission editor. Never calculates or saves tariffs locally.
 * Disabled by default until A's HTTPS Owner AAL2 + PostgreSQL is certified.
 */
export function OwnerCommissionEditor({authorized}:{authorized:boolean}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createOwnerCommissionGateway({
  enabled:import.meta.env.VITE_G116_OWNER_COMMISSION_ENABLED==='true',
  contractCertified:import.meta.env.VITE_G116_OWNER_CONTRACT_VERIFIED==='true',
  origin:import.meta.env.VITE_G116_OWNER_ORIGIN,
  pinnedOrigin:import.meta.env.VITE_G116_OWNER_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??null,
  fetchImpl:(url,options)=>fetch(url,options as RequestInit)
 }),[auth]);
 const [service,setService]=useState<CommissionKind>('AUTO_RIDE');
 const [rate,setRate]=useState<CommissionReceipt|null>(null);
 const [percent,setPercent]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const ready=authorized&&gateway.isConfigured();
 const scopeFence=useRef(createOwnerPolicyScopeFence());
 scopeFence.current.select(service,authorized,gateway);
 useEffect(()=>{
  setRate(null);setPercent('');setError('');setUncertain(false);
 },[authorized,service]);
 async function refresh(){
  if(!ready||busy)return;
  const ticket=scopeFence.current.select(service,authorized,gateway);
  setBusy(true);setError('');
  try{
   const result=await gateway.read(service);
   if(!scopeFence.current.current(ticket))return;
   if(result.ok&&result.data){
    setRate(result.data);setPercent(String(result.data.commissionBps/100));
    setUncertain(false);
   }else{
    setRate(null);setUncertain(true);
    setError('No se pudo confirmar la comisión en el servidor.');
   }
  }finally{setBusy(false);}
 }
 async function save(){
  const numeric=Number(percent),bps=Math.round(numeric*100);
  if(!ready||busy||uncertain||!rate||percent.trim()===''
   ||!Number.isFinite(numeric)||!Number.isSafeInteger(bps)
   ||Math.abs(bps/100-numeric)>0.000001||bps<1000||bps>3000){
   setError('Consultá primero la comisión e ingresá un porcentaje entre 10 y 30.');
   return;
  }
  if(bps===rate.commissionBps)return;
  const ticket=scopeFence.current.select(service,authorized,gateway);
  setBusy(true);setError('');
  try{
   const result=await gateway.change(service,{
    requestKey:crypto.randomUUID(),commissionBps:bps
   });
   if(!scopeFence.current.current(ticket))return;
   if(result.ok&&result.data&&result.data.version>rate.version){
    setRate(result.data);setPercent(String(result.data.commissionBps/100));
   }else{
    setUncertain(true);setRate(null);
    setError('Resultado no confirmado. Volvé a consultar antes de guardar.');
   }
  }finally{setBusy(false);}
 }
 return <section className="panel">
  <h2>Configurar porcentaje de comisión</h2>
  <p>Comisión individual para AUTO y MOTO pasajeros. El subsidio
   al cliente es siempre <strong>10 %</strong>. Cotizaciones anteriores
   mantienen el porcentaje aceptado.</p>
  {!ready&&<p role="status" className="owner-warning">
   Edición bloqueada: requiere propietario, MFA AAL2 y backend HTTPS certificado.
  </p>}
  <label htmlFor="commission-service">Servicio</label>
  <select id="commission-service" value={service} disabled={!ready||busy}
   onChange={e=>{scopeFence.current.invalidate();
    setService(e.currentTarget.value as CommissionKind);}}>
   <option value="AUTO_RIDE">AUTO · pasajeros</option>
   <option value="MOTO_RIDE">MOTO · pasajeros</option>
  </select>
  <p>Comisión verificada: <strong>{
   rate?String(rate.commissionBps/100)+' % · versión '+rate.version:'—'
  }</strong></p>
  <button type="button" disabled={!ready||busy} onClick={()=>void refresh()}>
   Consultar comisión
  </button>
  <form onSubmit={e=>{e.preventDefault();void save();}}>
   <label htmlFor="commission-percent">Nueva comisión (%)</label>
   <input id="commission-percent" type="number" min="10" max="30"
    step="0.01" value={percent} disabled={!ready||busy||!rate||uncertain}
    onChange={e=>setPercent(e.currentTarget.value)}/>
   <button type="submit" disabled={!ready||busy||!rate||uncertain
    ||percent.trim()===''||Number(percent)===rate?.commissionBps/100}>
    Guardar en servidor
   </button>
  </form>
  {error&&<p role="alert" className="owner-warning">{error}</p>}
  <p className="training-disclaimer">
   Configuración de laboratorio, sin cobros reales ni cambios en producción.
  </p>
 </section>;
}
