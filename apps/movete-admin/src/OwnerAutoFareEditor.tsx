import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createOwnerAutoFareGateway} from './owner-auto-fare-gateway.mjs';
import {parseG285OwnerAutoFareInput} from './g285-owner-auto-fare-input.mjs';
import {createOwnerPolicyScopeFence} from './owner-policy-scope-fence.mjs';
import type {OwnerFareInputs} from './g285-owner-auto-fare-input.mjs';

const blank=():OwnerFareInputs=>({
 basePyg:'',perKmPyg:'',perMinutePyg:'',minimumPyg:'',commissionPercent:''
});
const inputs=[
 ['basePyg','Precio base (Gs.)','1000','1000000','1'],
 ['perKmPyg','Precio por kilómetro (Gs.)','0','100000','1'],
 ['perMinutePyg','Precio por minuto (Gs.)','0','20000','1'],
 ['minimumPyg','Tarifa mínima (Gs.)','1000','1000000','1'],
 ['commissionPercent','Comisión QORE (%)','0','30','0.01']
] as const;

export function OwnerAutoFareEditor({authorized}:{authorized:boolean}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createOwnerAutoFareGateway({
  enabled:import.meta.env.VITE_G285_OWNER_AUTO_FARE_ENABLED==='true',
  contractCertified:import.meta.env.VITE_G285_OWNER_AUTO_FARE_CERTIFIED==='true',
  origin:import.meta.env.VITE_G285_OWNER_AUTO_FARE_ORIGIN,
  pinnedOrigin:import.meta.env.VITE_G285_OWNER_AUTO_FARE_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??null,
  fetchImpl:(url,opts)=>fetch(url,opts as RequestInit)
 }),[auth]);
 const [zone,setZone]=useState('');
 const [form,setForm]=useState<OwnerFareInputs>(blank);
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState('');
 const [error,setError]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const scopeFence=useRef(createOwnerPolicyScopeFence());
 const attemptedScopes=useRef(new Set<string>());
 const ready=authorized&&gateway.isConfigured();
 const validZone=/^[A-Z_]{3,40}$/.test(zone);
 const validData=useMemo(()=>parseG285OwnerAutoFareInput(form),[form]);
 const locked=attemptedScopes.current.has(zone);
 scopeFence.current.select(zone,authorized,gateway);
 useEffect(()=>{
  setConfirmed(false);setResult('');setError('');setUncertain(false);
 },[zone,authorized]);
 async function publish(){
  if(!ready||busy||locked||!validZone||validData===null||!confirmed){
   setError('Verificá los importes, la zona y la confirmación del propietario.');
   return;
  }
  const ticket=scopeFence.current.select(zone,authorized,gateway);
  // Never automatically retry a POST after an ambiguous timeout / commit.
  attemptedScopes.current.add(zone);
  setBusy(true);setUncertain(true);setConfirmed(false);setError('');setResult('');
  const body={...validData,requestKey:crypto.randomUUID()};
  try{
   const outcome=await gateway.publish(zone,body);
   if(!scopeFence.current.current(ticket))return;
   if(outcome.ok&&outcome.data){
    setResult('El servidor aceptó la regla '+outcome.data.ruleKey+
     ' para '+outcome.data.zoneTag+' con comisión '+
     outcome.data.commissionPercent+
     ' %. Falta conciliación independiente con la tarifa persistida.');
    setUncertain(true);
   }else{
    setError('No fue posible verificar la operación ('+
     (outcome.code??'G285_UNAVAILABLE')+
     '). No repitas el POST: verificá primero la tarifa persistida con el operador.');
   }
  }finally{setBusy(false);}
 }
 return <section className="panel">
  <h2>Tarifa AUTO pasajeros · Owner G285</h2>
  <p>Configuración en guaraníes por zona, exclusivamente en STAGING.
   El motor calcula el importe a partir de base, kilómetros, minutos,
   mínimo y comisión. Ningún precio se propone ni se activa automáticamente.</p>
  {!ready&&<p className="owner-warning" role="status">
   Bloqueado: requiere Owner autorizado G27, MFA AAL2 y endpoint HTTPS G268
   desplegado y certificado. Los tests locales no habilitan esta función.
  </p>}
  <label htmlFor="auto-fare-zone">Zona autorizada por servidor</label>
  <input id="auto-fare-zone" value={zone} maxLength={40}
   autoComplete="off" placeholder="Código de zona"
   disabled={!ready||busy}
   onChange={e=>{scopeFence.current.invalidate();
    setZone(e.currentTarget.value.toUpperCase());}}/>
  <form onSubmit={e=>{e.preventDefault();void publish();}}>
   {inputs.map(([key,label,min,max,step])=><div key={key}>
    <label htmlFor={'auto-fare-'+key}>{label}</label>
    <input id={'auto-fare-'+key} type="number" min={min} max={max}
     step={step} inputMode="decimal" value={form[key]}
     disabled={!ready||busy||locked}
     onChange={e=>{scopeFence.current.invalidate();setConfirmed(false);
      setForm(v=>({...v,[key]:e.currentTarget.value}));}}/>
   </div>)}
   <label className="owner-warning">
    <input type="checkbox" checked={confirmed} disabled={!ready||busy||locked
     ||!validZone||validData===null}
     onChange={e=>setConfirmed(e.currentTarget.checked)}/>
    Confirmo que estos importes son una decisión expresa del Owner y que
    esta operación no habilita pagos ni viajes LIVE.
   </label>
   <button type="submit" disabled={!ready||busy||locked||!confirmed
    ||!validZone||validData===null}>Publicar regla en STAGING</button>
  </form>
  {locked&&<p className="owner-warning" role="status">
   Se intentó una publicación en esta zona durante esta sesión. El formulario
   bloquea nuevas escrituras hasta realizar una auditoría independiente.
  </p>}
  {result&&<p role="status">{result}</p>}
  {error&&<p role="alert" className="owner-warning">{error}</p>}
  {uncertain&&<p className="training-disclaimer">
   La respuesta POST no constituye por sí sola una lectura independiente
   del precio persistido. No hay actualización automática ni reintentos.
  </p>}
  <p className="training-disclaimer">Tarifas previas no se editan en el navegador.
   Para MOTO, ENVÍOS y COMERCIOS se usan reglas y autorizaciones separadas.</p>
 </section>;
}
