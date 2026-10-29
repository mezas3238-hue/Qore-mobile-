import React,{useEffect,useMemo,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createG158FraudReportsClient}
 from './g158-fraud-reports-gateway.mjs';
import type {G158FraudPage} from './g158-fraud-reports-gateway.mjs';

const kindLabels:Record<string,string>={
 DRIVER:'Conductor',COURIER:'Repartidor',MERCHANT:'Comercio',CLIENT:'Cliente'
};
const flags=import.meta.env;
const webFetch=(url:string,opts:unknown)=>fetch(url,opts as RequestInit);
/** Read-only, manually refreshed; never exposes reporter identity, rating
 * details, GPS, phone, automated suspensions or an imaginary total.
 */
export function G158FraudReportsPanel({authorized,subject}:{
 authorized:boolean;subject:string|null
}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createG158FraudReportsClient({
  enabled:flags.VITE_D_G158_OWNER_APPROVED==='true',
  ownerApproved:flags.VITE_D_G158_OWNER_APPROVED==='true',
  contractVerified:flags.VITE_D_G158_CONTRACT_VERIFIED==='true',
  externalRuntimeVerified:flags.VITE_D_G158_EXTERNAL_RUNTIME_VERIFIED==='true',
  serverMfaVerified:flags.VITE_D_G158_SERVER_MFA_VERIFIED==='true',
  serverRbacVerified:flags.VITE_D_G158_SERVER_RBAC_VERIFIED==='true',
  serverRevocationVerified:flags.VITE_D_G158_REVOCATION_VERIFIED==='true',
  origin:flags.VITE_D_G158_STAGING_ORIGIN,
  pinnedOrigin:flags.VITE_D_G158_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??Promise.resolve(null),
  fetchImpl:webFetch
 }),[auth]);
 const [page,setPage]=useState<G158FraudPage|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const epoch=React.useRef(0);
 useEffect(()=>{epoch.current++;setPage(null);setError(null);setLoading(false);},
  [authorized,subject]);
 async function refresh(){
  if(loading||!authorized||!subject||!gateway.isConfigured())return;
  setLoading(true);setPage(null);setError(null);
  const version=epoch.current;
  try{
   const result=await gateway.fetchReports();
   if(version!==epoch.current)return;
   if(!result.ok){setError(result.code);return;}
   if(result.page.expiresAt<=Date.now()){setError('G158_EXPIRED');return;}
   setPage(result.page);
  }catch{if(version===epoch.current)setError('G158_READ_UNAVAILABLE');}
  finally{if(version===epoch.current)setLoading(false);}
 }
 return <section className="panel detail" aria-label="Alertas antifraude verificadas">
  <div className="section-head"><div>
   <h2>Alertas antifraude verificadas</h2>
   <p>Solo denuncias ligadas a viajes o entregas completados. Estas son
    alegaciones pendientes de investigación, nunca culpabilidad demostrada.</p>
  </div><span className="muted-tag">G158 · SOLO LECTURA</span></div>
  {!authorized?<p>Se requiere Admin con MFA. La sesión Owner no habilita
    investigaciones privadas.</p>:
   !gateway.isConfigured()?<p>Sin acceso remoto hasta que la API externa
    y los permisos Admin superen la certificación independiente.</p>:
   <>
    <button type="button" disabled={loading} onClick={()=>void refresh()}>
     {loading?'Consultando evidencia…':'Consultar alertas verificadas'}
    </button>
    {error&&<p role="alert">No fue posible confirmar la consulta: {error}</p>}
    {page&&page.expiresAt>Date.now()&&<>
     {page.items.length===0?<p>No hay alertas en esta página verificada.
      Esto no demuestra ausencia de fraude.</p>:
      <div className="kyc-records">
       {page.items.map(x=><div className="kyc-record" key={x.ratedKind+':'+x.ratedId}>
        <div><strong>{kindLabels[x.ratedKind]} · ID {x.ratedId}</strong>
         <small>Reportes recientes: {x.recentReports} ·
          Denunciantes independientes: {x.independentReporters} ·
          Servicios distintos: {x.distinctServices}</small>
         <small>{x.reviewTier==='MULTI_SOURCE_REVIEW'
          ?'Prioridad de revisión por múltiples fuentes'
          :'Alerta individual para verificación'}</small>
        </div><span className="muted-tag">NO CONFIRMADO</span>
       </div>)}
      </div>}
     {page.hasMore&&<p>Existen más casos fuera de esta página de 50.
      No se infiere el total de la plataforma.</p>}
    </>}
   </>}
  <p className="training-disclaimer">No muestra identidad del denunciante
   ni decide sanciones, cierres de cuentas, prioridad de despacho o pagos.
   Toda investigación requiere revisión humana y derecho a responder.</p>
 </section>;
}
