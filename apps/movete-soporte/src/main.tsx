import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {readSupportCases,type SupportCase} from './support-gateway.mjs';
import {verifySupportAccess,supportPasswordLogin,supportTotpVerify} from './support-auth.mjs';
import {createSupportRequestFence} from './support-request-fence.mjs';
import {allowedSupportActions} from './support-action-options.mjs';
import {enqueueSupportAction} from './support-action-gateway.mjs';
import type {SupportActionKind} from './support-action-contract.mjs';
import './styles.css';

type Tab='bandeja'|'seguridad'|'tareas'|'acceso';
const labels:Record<string,string>={
 VIAJE_AUTO:'Viaje AUTO',VIAJE_MOTO:'Viaje MOTO',
 ENVIO_AUTO:'Envío AUTO',ENVIO_MOTO:'Envío MOTO',
 COMERCIO:'Comercio',CUENTA:'Cuenta',OTRO:'Otros',
 OPEN:'Nuevo',IN_PROGRESS:'En atención',WAITING_CUSTOMER:'Esperando al cliente',
 ESCALATED:'Escalado',RESOLVED:'Resuelto',NORMAL:'Normal',HIGH:'Alta',CRITICAL:'Crítica'
};
const env=import.meta.env;
const supportActionsEnabled=env.VITE_QORE_SUPPORT_ACTIONS_APPROVED==='true';
function stagingClient():SupabaseClient|null{
 if(env.VITE_QORE_SUPPORT_STAGING_APPROVED!=='true')return null;
 const ref=env.VITE_QORE_SUPPORT_PROJECT_REF;
 const url=env.VITE_QORE_SUPPORT_SUPABASE_URL;
 const key=env.VITE_QORE_SUPPORT_PUBLISHABLE_KEY;
 if(typeof ref!=='string'||!/^[a-z0-9]{20}$/.test(ref)||
  typeof url!=='string'||url!==`https://${ref}.supabase.co`||
  typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{18,}$/.test(key))
  return null;
 // Volatile authentication: support tokens never written to persistent storage.
 return createClient(url,key,{auth:{persistSession:false,
  autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'}});
}
const client=stagingClient();
function App(){
 const [tab,setTab]=useState<Tab>('bandeja');
 const [phase,setPhase]=useState<'locked'|'loading'|'ready'>('locked');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [otp,setOtp]=useState('');
 const [factorId,setFactorId]=useState('');
 const [busy,setBusy]=useState(false);
 // Every async auth/case request must belong to the current UI session.
 const fence=useRef(createSupportRequestFence());
 const actionKeys=useRef(new Map<string,string>());
 const [supportUserId,setSupportUserId]=useState('');
 const [actionMessage,setActionMessage]=useState('');
 const [message,setMessage]=useState('El portal necesita una cuenta de soporte aprobada y MFA AAL2.');
 const [tickets,setTickets]=useState<readonly SupportCase[]>([]);
 const [filter,setFilter]=useState('ALL');
 const [query,setQuery]=useState('');
 const [loadError,setLoadError]=useState('');
 useEffect(()=>{
  let active=true;
  if(!client)return;
  const version=fence.current.current();
  void verifySupportAccess(client).then(session=>{
   if(active&&fence.current.isCurrent(version)&&session){
    setSupportUserId(session.userId);setPhase('ready');
   }
  });
  return()=>{active=false;fence.current.invalidate();};
 },[]);
 async function login(){
  if(!client||busy)return;
  const version=fence.current.begin();
  const pass=password;setPassword('');setBusy(true);setMessage('');
  const res=await supportPasswordLogin(client,email,pass);
  if(!fence.current.isCurrent(version))return;
  if(res.ok){
   const session=await verifySupportAccess(client);
   if(!fence.current.isCurrent(version))return;
   if(session){
    setSupportUserId(session.userId);
    setFactorId('');setPhase('ready');setTab('bandeja');
   }else{setPhase('locked');setMessage('La sesión no pudo verificarse nuevamente.');}
  }
  else if(res.code==='MFA_REQUIRED'&&res.factorId){
   setFactorId(res.factorId);setMessage('Verificá el código temporal de tu autenticador.');
  }else{
   setFactorId('');setMessage(res.code==='MFA_NOT_ENROLLED'?
    'La cuenta requiere TOTP previamente registrado. Contactá con el titular para completar el alta oficial.':
    'Acceso rechazado. Solo personal de soporte previamente aprobado puede ingresar.');
  }
  setBusy(false);
 }
 async function verifyMfa(){
  if(!client||busy)return;
  const version=fence.current.begin();
  const code=otp;setOtp('');setBusy(true);setMessage('');
  const result=await supportTotpVerify(client,factorId,code);
  if(!fence.current.isCurrent(version))return;
  if(result.ok){
   const session=await verifySupportAccess(client);
   if(!fence.current.isCurrent(version))return;
   if(session){
    setSupportUserId(session.userId);
    setPhase('ready');setFactorId('');setTab('bandeja');
   }else{setPhase('locked');setMessage('La sesión no pudo verificarse nuevamente.');}
  }
  else{setMessage('Segundo factor o permiso de soporte no confirmado. No se habilitó la cuenta.');
   if(result.code==='SUPPORT_ROLE_REQUIRED')setFactorId('');}
  setBusy(false);
 }
 async function logout(){
  fence.current.invalidate(); // defeat stale refresh, MFA and login promises
  actionKeys.current.clear();
  setActionMessage('');setSupportUserId('');
  setBusy(false);
  setTickets([]);setLoadError('');setFactorId('');setOtp('');
  setPhase('locked');setPassword('');setEmail('');setMessage('Sesión de soporte cerrada.');
  try{await client?.auth.signOut();}catch{
   setMessage('El portal quedó bloqueado, pero no se confirmó la revocación remota.');
  }
 }
 async function refresh(){
  if(!client||busy)return;
  const version=fence.current.begin();
  setBusy(true);setPhase('loading');setLoadError('');
  const result=await readSupportCases(client);
  if(!fence.current.isCurrent(version))return;
  if(result.ok){
   const session=await verifySupportAccess(client);
   if(!fence.current.isCurrent(version))return;
   if(!session){
    setTickets([]);setSupportUserId('');setPhase('locked');
    setLoadError('Se revocó el acceso a Soporte.');setBusy(false);return;
   }
   setSupportUserId(session.userId);
   setTickets(result.cases);setPhase('ready');
  }else{
   setTickets([]);
   if(result.code==='NOT_AUTHORIZED'||result.code==='SESSION_CHANGED')setSupportUserId('');
   setPhase(result.code==='NOT_AUTHORIZED'||result.code==='SESSION_CHANGED'?'locked':'ready');
   setLoadError(result.code==='SERVER_NOT_READY'
    ?'La bandeja privada aún no está habilitada en el servidor. No se mostrará información de otras cuentas.'
    :'No se pudo validar la consulta o el permiso. Ningún expediente fue mostrado.');
  }
  setBusy(false);
 }
 async function requestAction(c:SupportCase,action:SupportActionKind){
  if(!client||busy||!supportActionsEnabled||!supportUserId)return;
  if(!allowedSupportActions(c,supportUserId,true).some(x=>x.action===action))return;
  const version=fence.current.begin();
  const key=`${c.ticket_id}|${c.status}|${action}`;
  const requestKey=actionKeys.current.get(key)??crypto.randomUUID();
  actionKeys.current.set(key,requestKey);
  setBusy(true);setActionMessage('');
  const result=await enqueueSupportAction(client,{
   ticket_id:c.ticket_id,expected_status:c.status,action,
   idempotency_key:requestKey
  },{approved:supportActionsEnabled});
  if(!fence.current.isCurrent(version))return;
  if(result.ok){
   actionKeys.current.delete(key);
   setActionMessage(`Solicitud ${result.request_id} EN COLA. Esto no confirma respuesta, cierre ni transferencia.`);
  }else{
   if(result.code==='NOT_AUTHORIZED'||result.code==='SESSION_CHANGED'){
    setTickets([]);setSupportUserId('');setPhase('locked');
   }
   setActionMessage('No se pudo registrar la solicitud. No se confirmó ninguna acción.');
  }
  setBusy(false);
 }
 const visible=useMemo(()=>tickets.filter(t=>
  (filter==='ALL'||t.status===filter)&&
  (query.trim()===''||[t.case_code,t.summary,t.category].some(v=>v.toLowerCase().includes(query.trim().toLowerCase())))
 ),[tickets,filter,query]);
 const counts=useMemo(()=>({
  open:tickets.filter(t=>t.status==='OPEN').length,
  progress:tickets.filter(t=>t.status==='IN_PROGRESS').length,
  waiting:tickets.filter(t=>t.status==='WAITING_CUSTOMER').length,
  escalated:tickets.filter(t=>t.status==='ESCALATED').length
 }),[tickets]);
 return <div className="shell">
  <header className="topbar"><div className="brandmark">MF</div><div className="brand"><strong>Movete Fácil</strong><span>Portal de Soporte · STAGING</span></div>
   <div className="topstatus">{phase==='ready'?'Acceso soporte verificado':'Acceso restringido'}</div>
  </header>
  <div className="layout">
   <nav className="sidebar" aria-label="Navegación de soporte">
    {([['bandeja','Bandeja'],['tareas','Mis funciones'],['seguridad','Seguridad'],['acceso','Mi acceso']] as const).map(([id,name])=>
     <button key={id} type="button" aria-current={tab===id?'page':undefined}
      className={tab===id?'active':''} onClick={()=>setTab(id)}>{name}</button>)}
    <p className="small">Sin permisos para precios, pagos, autorizaciones Driver ni cuentas Owner.</p>
   </nav>
   <main className="content">
    <div className="page-title"><div><div className="eyebrow">ATENCIÓN Y OPERACIONES</div>
     <h1>{tab==='bandeja'?'Centro de atención':tab==='tareas'?'Mis funciones':tab==='seguridad'?'Escalamiento de seguridad':'Cuenta de soporte'}</h1>
     <p>Herramientas propias para el equipo de soporte, separadas de administración y finanzas.</p>
    </div>{phase==='ready'&&<button className="secondary" onClick={()=>void logout()}>Cerrar sesión</button>}</div>
    {tab==='acceso'||phase==='locked'?<section className="panel login">
     <h2>Acceso exclusivo de soporte</h2>
     <p>El acceso exige una identidad individual, permiso de soporte verificado por el servidor y TOTP AAL2. El personal no hereda facultades de propietario.</p>
     {!client?<div className="notice">El portal está bloqueado por defecto. Falta habilitar el servidor de soporte, su rol independiente y la compilación STAGING. No ingreses contraseñas aquí.</div>:
      phase==='ready'?<p className="notice success">Sesión de soporte validada. Las funciones disponibles siguen limitadas por políticas del servidor.</p>:
      factorId?<form onSubmit={e=>{e.preventDefault();void verifyMfa();}}>
       <label htmlFor="otp">Código de autenticador (6 dígitos)</label>
       <input id="otp" value={otp} maxLength={6} inputMode="numeric" autoComplete="one-time-code" disabled={busy}
        onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}/>
       <button type="submit" disabled={busy||otp.length!==6}>Verificar TOTP</button>
       <button type="button" className="secondary" onClick={()=>void logout()}>Cancelar</button>
      </form>:
      <form onSubmit={e=>{e.preventDefault();void login();}}>
       <label htmlFor="mail">Correo de soporte</label><input id="mail" type="email" maxLength={254}
        autoComplete="username" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/>
       <label htmlFor="pass">Contraseña</label><input id="pass" type="password" autoComplete="current-password"
        value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/>
       <button type="submit" disabled={busy||!email||password.length<8}>Ingresar al soporte</button>
      </form>}
     <p role="status">{message}</p>
    </section>:tab==='bandeja'?<>
     <div className="metrics">
      <div><span>Nuevos</span><strong>{counts.open}</strong></div>
      <div><span>En atención</span><strong>{counts.progress}</strong></div>
      <div><span>Esperando respuesta</span><strong>{counts.waiting}</strong></div>
      <div><span>Escalados</span><strong>{counts.escalated}</strong></div>
     </div>
     <section className="panel">
      <div className="section-top"><div><h2>Casos autorizados</h2>
       <p>Solo tickets asignados o en la cola permitida por el servidor; datos mínimos, sin documentos ni teléfonos.</p></div>
       <button disabled={busy} onClick={()=>void refresh()}>{busy?'Consultando…':'Actualizar casos'}</button>
      </div>
      <div className="filters"><label htmlFor="find">Buscar ticket</label>
       <input id="find" placeholder="Código, categoría o motivo" value={query} onChange={e=>setQuery(e.target.value)} />
       <label htmlFor="status">Estado</label>
       <select id="status" value={filter} onChange={e=>setFilter(e.target.value)}>
        {['ALL','OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED','RESOLVED'].map(v=>
         <option key={v} value={v}>{v==='ALL'?'Todos':labels[v]}</option>)}
       </select>
      </div>
      {loadError&&<p className="notice" role="alert">{loadError}</p>}
      {actionMessage&&<p className="notice" role="status">{actionMessage}</p>}
      {phase==='loading'?<p>Comprobando permisos y consultando casos…</p>:
       visible.length===0?<div className="empty"><strong>Sin casos autorizados visibles</strong>
        <p>Esto no demuestra que no existan tickets en la plataforma. Actualizá para consultar el servidor.</p></div>:
       <div className="tickets">{visible.map(c=><article key={c.ticket_id} className="ticket">
        <div><strong>{c.case_code}</strong><span>{labels[c.category]}</span></div>
        <p>{c.summary}</p><div className="ticket-meta">
         <span>{labels[c.status]}</span><span>{labels[c.priority]}</span>
         <span>{new Date(c.updated_at).toLocaleString('es-PY')}</span>
        </div>
        {supportActionsEnabled&&allowedSupportActions(c,supportUserId,true).length>0&&
         <div className="ticket-actions" aria-label={`Acciones para ${c.case_code}`}>
          {allowedSupportActions(c,supportUserId,true).map(option=>
           <button type="button" key={option.action} disabled={busy}
            onClick={()=>void requestAction(c,option.action)}>{option.label}</button>)}
         </div>}
       </article>)}</div>}
      <p className="small">Las solicitudes del agente permanecen desactivadas por defecto. Si se habilitan tras certificación, solamente se colocan en una cola auditada: NO envían mensajes, no cierran reclamos ni modifican pagos. Los tickets sin asignar no admiten acciones.</p>
     </section>
    </>:tab==='tareas'?<section className="panel"><h2>Trabajo cotidiano del agente</h2>
      <div className="tasklist">
       <div><strong>Atender reclamos</strong><p>Incidencias de viajes AUTO/MOTO, demoras, cancelaciones y objetos olvidados.</p></div>
       <div><strong>Consultar envíos</strong><p>Estados autorizados de envíos AUTO/MOTO y pedidos de comercios.</p></div>
       <div><strong>Orientar a clientes y conductores</strong><p>Ayuda con el uso de la aplicación y estado de solicitudes, sin ver documentos privados.</p></div>
       <div><strong>Escalar casos especiales</strong><p>Fraude, seguridad, accidentes, identidad, reembolsos y disputas al responsable autorizado.</p></div>
      </div>
      <p className="notice">Este módulo describe la actividad de soporte. Las operaciones reales se habilitarán individualmente después de certificar el backend; no simula acciones.</p>
    </section>:<section className="panel">
      <h2>Casos que requieren escalamiento</h2>
      <p>Ante una emergencia, los servicios oficiales de emergencia son la vía inmediata. El portal no sustituye el botón SOS ni realiza llamadas.</p>
      <div className="tasklist">
       <div><strong>Accidente, violencia o amenaza</strong><p>Prioridad crítica; escalar al responsable de seguridad. No difundir ubicación ni identidad.</p></div>
       <div><strong>Fraude o suplantación</strong><p>Registrar la referencia del ticket y solicitar investigación autorizada.</p></div>
       <div><strong>Documentos y habilitaciones</strong><p>Derivar al equipo de revisión legal/KYC; soporte no puede aprobar ni eliminar evidencia.</p></div>
       <div><strong>Pagos y devoluciones</strong><p>Escalar a finanzas. Soporte no puede mover dinero ni modificar comisiones.</p></div>
      </div>
     </section>}
   </main>
  </div><footer>Movete Fácil · Soporte STAGING · Acceso mínimo · Sin operaciones LIVE</footer>
 </div>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
