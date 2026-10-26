import React,{useEffect,useMemo,useState} from 'react';
import {useWebAdminAuth} from './AdminRuntime';
import {createOwnerCargoRateGateway} from './owner-cargo-rate-gateway.mjs';
import type {CargoKind,CargoRate,CargoDraft} from './owner-cargo-rate-gateway.mjs';

const fields=[
 ['basePyg','Base (Gs.)',0,1000000],
 ['perKmPyg','Por km (Gs.)',0,100000],
 ['perMinutePyg','Por minuto (Gs.)',0,20000],
 ['minimumPyg','Mínimo (Gs.)',1,1000000],
 ['commissionBps','Comisión (puntos base)',0,3000],
 ['durationDays','Vigencia propuesta (días)',1,90]
] as const;
type Key=typeof fields[number][0];
type Data=Record<Key,string>;
const blank=():Data=>({basePyg:'',perKmPyg:'',perMinutePyg:'',
 minimumPyg:'',commissionBps:'',durationDays:'30'});
export function OwnerCargoRateEditor({authorized}:{authorized:boolean}){
 const auth=useWebAdminAuth();
 const gateway=useMemo(()=>createOwnerCargoRateGateway({
  enabled:import.meta.env.VITE_G124_OWNER_CARGO_ENABLED==='true',
  contractCertified:import.meta.env.VITE_G124_OWNER_CARGO_CERTIFIED==='true',
  origin:import.meta.env.VITE_G124_OWNER_CARGO_ORIGIN,
  pinnedOrigin:import.meta.env.VITE_G124_OWNER_CARGO_PINNED_ORIGIN,
  getSession:()=>auth?.readSession()??null,
  fetchImpl:(url,options)=>fetch(url,options as RequestInit)
 }),[auth]);
 const [kind,setKind]=useState<CargoKind>('AUTO');
 const [zone,setZone]=useState('');
 const [rate,setRate]=useState<CargoRate|null>(null);
 const [data,setData]=useState<Data>(blank);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(true);
 const [message,setMessage]=useState('');
 const ready=authorized&&gateway.isConfigured();
 useEffect(()=>{setRate(null);setUncertain(true);
  setData(blank());setMessage('');},[kind,zone,authorized]);
 const validZone=/^[A-Z_]{3,20}$/.test(zone);
 async function read(){
  if(!ready||!validZone||busy)return;
  setBusy(true);setMessage('');
  try{
   const answer=await gateway.read(kind,zone);
   if(!answer.ok||!answer.data){
    setRate(null);setUncertain(true);
    setMessage(answer.code==='CARGO_RATE_NOT_CONFIGURED'
     ?'No existe tarifa aprobada en esta zona. No se puede editar sin contrato de creación específico.'
     :'No se pudo verificar la tarifa en el servidor.');
    return;
   }
   const d=answer.data;
   setRate(d);setUncertain(false);
   setData({basePyg:String(d.basePyg),perKmPyg:String(d.perKmPyg),
    perMinutePyg:String(d.perMinutePyg),minimumPyg:String(d.minimumPyg),
    commissionBps:String(d.commissionBps),durationDays:'30'});
  }finally{setBusy(false);}
 }
 async function save(){
  if(!ready||busy||uncertain||!rate||!validZone)return;
  const parsed={} as Record<Key,number>;
  for(const [field,,lo,hi] of fields){
   if(!/^\d+$/.test(data[field])){
    setMessage('Ingresá valores enteros válidos en todos los campos.');return;
   }
   parsed[field]=Number(data[field]);
   if(!Number.isSafeInteger(parsed[field])||parsed[field]<lo||parsed[field]>hi){
    setMessage('Hay un valor fuera del rango permitido por Backend A.');return;
   }
  }
  const body:CargoDraft={...parsed,requestKey:crypto.randomUUID()};
  setBusy(true);setUncertain(true);setMessage('');
  try{
   const answer=await gateway.change(kind,zone,body);
   if(!answer.ok||!answer.data||answer.data.version<=rate.version){
    setRate(null);
    setMessage('Resultado incierto. Consultá nuevamente antes de intentar otra modificación.');
    return;
   }
   setRate(answer.data);setUncertain(false);
   setMessage('Tarifa STAGING confirmada por el backend. Sin efecto en cotizaciones anteriores.');
  }finally{setBusy(false);}
 }
 return <section className="panel">
  <h2>Envíos AUTO / MOTO — tarifa Owner G124</h2>
  <p>Importes y comisión configurables por vehículo y zona, de origen servidor.
   El subsidio de pasajeros del 10 % <strong>no se aplica</strong> automáticamente a envíos.</p>
  {!ready&&<p role="status" className="owner-warning">
   Bloqueado: falta autorización G124 HTTPS / Owner AAL2 / PostgreSQL externo.</p>}
  <label htmlFor="cargo-kind">Vehículo de envío</label>
  <select id="cargo-kind" value={kind} disabled={busy||!ready}
   onChange={e=>setKind(e.currentTarget.value as CargoKind)}>
   <option value="AUTO">AUTO (paquetes)</option>
   <option value="MOTO">MOTO (paquetes)</option>
  </select>
  <label htmlFor="cargo-zone">Código de zona autorizado por backend</label>
  <input id="cargo-zone" value={zone} maxLength={20} autoComplete="off"
   placeholder="Ej. ASUNCION; validar contra servidor"
   disabled={busy||!ready} onChange={e=>setZone(e.currentTarget.value.toUpperCase())}/>
  <button type="button" disabled={!ready||busy||!validZone}
   onClick={()=>void read()}>{busy?'Verificando…':'Consultar tarifa vigente'}</button>
  <p>Tarifa certificada: <strong>{rate?
   kind+' / '+zone+' · versión '+rate.version+' · válida hasta '+rate.validUntil:
   'No verificada'}</strong></p>
  <form onSubmit={e=>{e.preventDefault();void save();}}>
   {fields.map(([name,label,min,max])=><div key={name}>
    <label htmlFor={'cargo-'+name}>{label}</label>
    <input id={'cargo-'+name} type="number" min={min} max={max} step="1"
     value={data[name]} disabled={!ready||busy||uncertain||!rate}
     onChange={e=>setData(prev=>({...prev,[name]:e.currentTarget.value}))}/>
   </div>)}
   <p className="training-disclaimer">Comisión: 950 puntos base = 9,50 %.
    La zona debe existir y estar aprobada por el backend.</p>
   <button type="submit" disabled={!ready||busy||uncertain||!rate}>
    Guardar tarifa de envío en servidor</button>
  </form>
  {message&&<p role="status" className="owner-warning">{message}</p>}
  <p className="training-disclaimer">STAGING solamente; un POST no garantiza
   disponibilidad de conductor, asignación ni cobro. No hay tarifas inventadas.</p>
 </section>;
}
