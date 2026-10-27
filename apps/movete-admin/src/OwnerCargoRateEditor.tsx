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
 const [lookup,setLookup]=useState<'unknown'|'missing'|'present'>('unknown');
 const [initialConfirmed,setInitialConfirmed]=useState(false);
 const [data,setData]=useState<Data>(blank);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(true);
 const [message,setMessage]=useState('');
 const ready=authorized&&gateway.isConfigured();
 useEffect(()=>{setRate(null);setLookup('unknown');
  setInitialConfirmed(false);setUncertain(true);
  setData(blank());setMessage('');},[kind,zone,authorized]);
 const validZone=/^[A-Z_]{3,20}$/.test(zone);
 async function read(){
  if(!ready||!validZone||busy)return;
  setBusy(true);setMessage('');
  try{
   const answer=await gateway.read(kind,zone);
   if(!answer.ok||!answer.data){
    setRate(null);
    if(answer.code==='CARGO_RATE_NOT_CONFIGURED'){
     // A's G124 PG16 confirms 404 before initial POST version 1.
     // This is an invitation to propose a policy, NOT zone approval.
     setLookup('missing');setInitialConfirmed(false);setUncertain(false);
     setData(blank());
     setMessage('No existe tarifa en esta combinación. Podés crear la primera regla G124 tras confirmar expresamente la zona y el vehículo. El backend decide si la zona está autorizada.');
    }else{
     setLookup('unknown');setInitialConfirmed(false);setUncertain(true);
     setMessage('No se pudo verificar el estado de la tarifa en el servidor.');
    }
    return;
   }
   const d=answer.data;
   setLookup('present');setInitialConfirmed(false);
   setRate(d);setUncertain(false);
   setData({basePyg:String(d.basePyg),perKmPyg:String(d.perKmPyg),
    perMinutePyg:String(d.perMinutePyg),minimumPyg:String(d.minimumPyg),
    commissionBps:String(d.commissionBps),durationDays:'30'});
  }finally{setBusy(false);}
 }
 async function save(){
  const createNew=lookup==='missing'&&rate===null;
  if(!ready||busy||uncertain||!validZone||
   !(lookup==='present'&&rate||createNew&&initialConfirmed))return;
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
  const previousVersion=rate?.version??0;
  setBusy(true);setUncertain(true);setLookup('unknown');
  setInitialConfirmed(false);setMessage('');
  try{
   const answer=await gateway.change(kind,zone,body);
   if(!answer.ok||!answer.data||answer.data.version<=previousVersion){
    setRate(null);
    setMessage('Resultado no confirmado. NO repitas el POST: consultá nuevamente por GET antes de actuar.');
    return;
   }
   // One authoritative GET read-back is mandatory after initial creation
   // and after a versioned update; never treat only POST as committed UI state.
   const readBack=await gateway.read(kind,zone);
   if(!readBack.ok||!readBack.data||
    readBack.data.ruleId!==answer.data.ruleId||
    readBack.data.version!==answer.data.version){
    setRate(null);
    setMessage('El POST no pudo conciliarse con GET. No repitas el guardado: consultá la tarifa actual.');
    return;
   }
   const verified=readBack.data;
   setRate(verified);setLookup('present');setUncertain(false);
   setData({basePyg:String(verified.basePyg),perKmPyg:String(verified.perKmPyg),
    perMinutePyg:String(verified.perMinutePyg),
    minimumPyg:String(verified.minimumPyg),
    commissionBps:String(verified.commissionBps),durationDays:'30'});
   setMessage(createNew?'Primera tarifa G124 registrada y conciliada en STAGING.':
    'Tarifa G124 actualizada y conciliada en STAGING. Las cotizaciones anteriores permanecen inmutables.');
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
  <p>Tarifa verificada: <strong>{rate?
   kind+' / '+zone+' · versión '+rate.version+' · válida hasta '+rate.validUntil:
   lookup==='missing'?'Sin tarifa: alta inicial posible tras confirmación Owner':
   'No verificada'}</strong></p>
  {lookup==='missing'&&<label className="owner-warning">
   <input type="checkbox" checked={initialConfirmed}
    disabled={!ready||busy} onChange={e=>setInitialConfirmed(e.currentTarget.checked)}/>
   Confirmo que estoy creando una nueva tarifa de ENVÍOS para {kind} en la zona
   {zone}, que sus importes son una decisión del Owner y que no habilita servicios LIVE.
  </label>}
  <form onSubmit={e=>{e.preventDefault();void save();}}>
   {fields.map(([name,label,min,max])=><div key={name}>
    <label htmlFor={'cargo-'+name}>{label}</label>
    <input id={'cargo-'+name} type="number" min={min} max={max} step="1"
     value={data[name]} disabled={!ready||busy||uncertain||
      (lookup!=='present'&&lookup!=='missing')}
     onChange={e=>setData(prev=>({...prev,[name]:e.currentTarget.value}))}/>
   </div>)}
   <p className="training-disclaimer">Comisión: 950 puntos base = 9,50 %.
    La zona debe existir y estar aprobada por el backend.</p>
   <button type="submit" disabled={!ready||busy||uncertain||
    !(lookup==='present'&&rate||lookup==='missing'&&initialConfirmed)}>
    {lookup==='missing'?'Crear primera tarifa de envío':'Guardar nueva versión en servidor'}
   </button>
  </form>
  {message&&<p role="status" className="owner-warning">{message}</p>}
  <p className="training-disclaimer">STAGING solamente; un POST no garantiza
   disponibilidad de conductor, asignación ni cobro. No hay tarifas inventadas.</p>
 </section>;
}
