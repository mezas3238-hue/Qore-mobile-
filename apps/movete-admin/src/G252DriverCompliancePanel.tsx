import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createG252ComplianceClient}
 from './g252-compliance-client.mjs';
import type {G252AlertsPage} from './g252-compliance-client.mjs';

const FLAGS=import.meta.env;
const fetchApi=(url:string,opt:unknown)=>fetch(url,opt as RequestInit);
const labels:Readonly<Record<string,string>>={
 licencia:'Licencia de conducir',identidad_frente:'Cédula de identidad',
 identidad_dorso:'Cédula de identidad',cedula_verde:'Cédula verde',
 habilitacion:'Habilitación',seguro:'Seguro',
 inspeccion:'Inspección técnica',rostro_selfie:'Verificación de identidad'
};
const severity:Readonly<Record<string,string>>={
 EXPIRED:'Vencido',D01:'Vence en 1 día',D07:'Vence en 7 días',
 D15:'Vence en 15 días',D30:'Vence en 30 días'
};
/** Administrative exceptions only. No upload, dispatch or approval controls.
 * A blank inbox is NOT evidence that all documents are up to date.
 */
export function G252DriverCompliancePanel({authorized}:{
 authorized:boolean
}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createG252ComplianceClient({
  enabled:FLAGS.VITE_D_G252_OWNER_APPROVED==='true',
  ownerApproved:FLAGS.VITE_D_G252_OWNER_APPROVED==='true',
  contractVerified:FLAGS.VITE_D_G252_CONTRACT_VERIFIED==='true',
  externalRuntimeVerified:FLAGS.VITE_D_G252_EXTERNAL_RUNTIME_VERIFIED==='true',
  serverMfaVerified:FLAGS.VITE_D_G252_SERVER_MFA_VERIFIED==='true',
  serverRbacVerified:FLAGS.VITE_D_G252_SERVER_RBAC_VERIFIED==='true',
  serverRevocationVerified:FLAGS.VITE_D_G252_REVOCATION_VERIFIED==='true',
  origin:FLAGS.VITE_D_G252_STAGING_ORIGIN,
  pinnedOrigin:FLAGS.VITE_D_G252_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??Promise.resolve(null),
  fetchImpl:fetchApi
 }),[auth]);
 const [page,setPage]=useState<G252AlertsPage|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setPage(null);setError(null);setLoading(false);},
  [authorized]);
 async function refresh(){
  if(!authorized||loading||!gateway.isConfigured())return;
  const seq=epoch.current;
  setLoading(true);setPage(null);setError(null);
  try{
   const result=await gateway.fetchAlerts();
   if(seq!==epoch.current)return;
   if(!result.ok){setError(result.code);return;}
   if(result.page.expiresAt<=Date.now()){
    setError('G252_DOCUMENT_SNAPSHOT_EXPIRED');return;
   }
   setPage(result.page);
  }catch{if(seq===epoch.current)setError('G252_NOT_AVAILABLE');}
  finally{if(seq===epoch.current)setLoading(false);}
 }
 return <section className="panel detail" aria-label="Vencimientos documentales de conductores">
  <div className="section-head">
   <div><h2>Vencimientos documentales automáticos</h2>
    <p>Alertas creadas por el monitor de cumplimiento. Solo atención de
     excepciones: renovación, reclamos y casos que requieran revisión humana.</p>
   </div>
   <span className="muted-tag">G252 · SOLO LECTURA</span>
  </div>
  {!authorized?<p>Requiere Admin con MFA y permisos documentales.</p>:
   !gateway.isConfigured()?
   <p>Sin conexión documental certificada. El monitor y la bandeja no
    están habilitados para datos reales. No se muestran alertas ficticias.</p>:
   <>
    <button type="button" disabled={loading} onClick={()=>void refresh()}>
     {loading?'Consultando…':'Consultar alertas documentales'}
    </button>
    {error&&<p role="alert">No se verificó la lectura privada: {error}</p>}
    {page&&page.expiresAt>Date.now()&&<>
     {page.items.length===0?<p>Sin alertas en esta página. La ausencia de
      registros no certifica la vigencia de toda la flota.</p>:
      <div className="kyc-records">
       {page.items.map(x=><div className="kyc-record"
        key={x.driverId+':'+x.kind+':'+x.band}>
         <div><strong>{labels[x.kind]} · Conductor {x.driverId}</strong>
          <small>{severity[x.band]} · Fecha documental verificada:
           {' '}{new Date(x.validUntilMs).toLocaleDateString('es-PY')}</small>
         </div><span className="muted-tag">{severity[x.band]}</span>
        </div>)}
      </div>}
     {page.hasMore&&<p>Existen más alertas fuera de esta página.
      No se deduce el total de conductores.</p>}
    </>}
   </>}
  <p className="training-disclaimer">
   La vigencia y elegibilidad del conductor se validan en el backend.
   Esta pantalla no bloquea ni habilita viajes y no permite despacho manual.
  </p>
 </section>;
}
