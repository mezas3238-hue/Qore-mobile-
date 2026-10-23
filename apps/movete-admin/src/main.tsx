import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createReviewDraft,TRAINING_CASES} from './review-draft.mjs';
import {AdminRuntimeProvider,useAdminView} from './AdminRuntime';
import type {AdminKycRecord,AdminSnapshot} from './admin-experience.mjs';
import './styles.css';

type Page='resumen'|'propietario'|'kyc'|'zonas'|'incidentes'|'auditoria';
const sections:{id:Page;label:string;hint:string}[]=[
 {id:'resumen',label:'Resumen',hint:'Indicadores operativos'},
 {id:'propietario',label:'Propietario',hint:'Ingresos, comisiones y control estratégico'},
 {id:'kyc',label:'Documentos y KYC',hint:'Revisión por responsable'},
 {id:'zonas',label:'Zonas y cobertura',hint:'Habilitaciones geográficas'},
 {id:'incidentes',label:'Seguridad',hint:'Incidentes y suspensiones'},
 {id:'auditoria',label:'Auditoría',hint:'Registro de acciones'}
];
const cards=[
 ['Solicitudes de viajes','Sin conexión','Solo datos autorizados'],
 ['Conductores pendientes','Sin conexión','No equivale a aprobados'],
 ['Envíos por estado','Sin conexión','No se muestran envíos ficticios'],
 ['Alertas de seguridad','Sin conexión','Requiere bandeja privada']
] as const;
const panels:Record<Exclude<Page,'resumen'>,{title:string;description:string;empty:string;requirements:string[]}>={
 propietario:{title:'Finanzas propietario',description:'Cifras exclusivamente del libro financiero conciliado',empty:'Sin datos conectados',requirements:['Rol owner + MFA del servidor','Ledger conciliado','Permisos y auditoría']},
 kyc:{
  title:'Revisión documental de conductores y vehículos',
  description:'Documentación legal y seguros sujetos a verificación. No se aprueba automáticamente ningún conductor.',
  empty:'La cola KYC todavía no está conectada. No se muestran cédulas, licencias ni fotografías reales.',
  requirements:['Metadatos autorizados desde API Admin','Documentos por URL temporal y permisos','Decisión registrada con motivo, versión y auditoría']},
 zonas:{
  title:'Zonas, servicios y elegibilidad',
  description:'La cobertura de una zona no implica disponibilidad de automóviles o repartidores.',
  empty:'No hay zonas recuperadas del servidor. No habilites ninguna operación desde esta pantalla.',
  requirements:['Municipio y permisos por servicio','AUTO pasajeros separado de MOTO carga','Disponibilidad y seguros validados por servidor']},
 incidentes:{
  title:'Incidentes, suspensiones y soporte',
  description:'Toda acción sensible requiere autorización por rol y bitácora en el backend.',
  empty:'Sin bandeja de incidentes conectada. Este panel no es un canal activo de emergencia.',
  requirements:['Incidentes con PII redactada','Historial de medidas y motivos','Suspender o revertir solo tras confirmación auditada']},
 auditoria:{
  title:'Trazabilidad de decisiones administrativas',
  description:'El registro debe provenir de eventos inmutables del servidor, no del navegador.',
  empty:'No hay eventos reales disponibles. No se generaron registros falsos.',
  requirements:['Actor y permiso autorizados','Marca temporal del servidor','Revisión, idempotencia y exportación filtrada']}
};
function Panel({children,className=''}:{children:React.ReactNode;className?:string}){
 return <section className={'panel '+className}>{children}</section>;
}
function KycTraining(){
 const [selected,setSelected]=useState(TRAINING_CASES[0].id);
 const [decision,setDecision]=useState<'approve'|'reject'>('reject');
 const [reason,setReason]=useState('');
 const [feedback,setFeedback]=useState('');
 const record=TRAINING_CASES.find(x=>x.id===selected) || TRAINING_CASES[0];
 function validate(){
  const outcome=createReviewDraft({
   vehicleId:record.id,
   requestKey:'123e4567-e89b-42d3-a456-426614174088',
   approve:decision==='approve',
   reason
  });
  setFeedback(outcome.ok
   ?'Borrador sintético válido. No se aprobó ni rechazó ningún vehículo. No se transmitió al servidor.'
   :outcome.reason);
 }
 return <div className="training-grid">
  <Panel className="training-list">
   <div className="section-head"><h2>Casos ficticios para validar interfaz</h2><span className="muted-tag">100% SINTÉTICOS</span></div>
   <p>La cola de conductores real está bloqueada hasta confirmar sesión Admin, permisos y lectura autorizada del servidor.</p>
   {TRAINING_CASES.map(c=><button key={c.id} type="button"
     className={'training-row '+(c.id===selected?'selected':'')}
     onClick={()=>{setSelected(c.id);setFeedback('');setReason('');}}
     aria-pressed={c.id===selected}>
     <span><strong>{c.label}</strong><small>{c.vehicleKind} · {c.documentLabel}</small></span>
     <span className="muted-tag">QA</span>
   </button>)}
   <p className="training-disclaimer">Estos expedientes no existen en ninguna base de datos. Se generan únicamente como ejemplos estáticos para evaluar navegación y formularios.</p>
  </Panel>
  <Panel className="training-detail">
   <div className="section-head"><h2>Revisión simulada</h2><span className="muted-tag">NO SE ENVÍA</span></div>
   <dl><dt>Identificador</dt><dd>{record.label}</dd>
    <dt>Vehículo</dt><dd>{record.vehicleKind}</dd>
    <dt>Documentación</dt><dd>{record.documentLabel} (dato ficticio)</dd>
    <dt>Permiso comercial</dt><dd>No validado / no habilitado</dd>
   </dl>
   <fieldset className="choice-group"><legend>Decisión de práctica</legend>
     <label><input type="radio" name="decision" checked={decision==='reject'} onChange={()=>{setDecision('reject');setFeedback('');}}/> Rechazar borrador</label>
     <label><input type="radio" name="decision" checked={decision==='approve'} onChange={()=>{setDecision('approve');setFeedback('');}}/> Preparar revisión de aprobación</label>
   </fieldset>
   <label className="reason-label" htmlFor="kyc-reason">Motivo de revisión (12–500 caracteres)</label>
   <textarea id="kyc-reason" rows={4} maxLength={500} value={reason}
     onChange={e=>{setReason(e.target.value);setFeedback('');}}
     placeholder="Usá una razón genérica sin datos personales ni información real."/>
   <button className="review-action" type="button" onClick={validate}>Validar borrador local (QA)</button>
   {feedback&&<p className="review-feedback" role="status">{feedback}</p>}
   <p className="training-disclaimer">No hay token de administrador ni acceso al backend. Una validación local nunca constituye revisión legal, KYC ni autorización operativa.</p>
  </Panel>
 </div>;
}

function AuthorizedQueue({items}:{items:readonly AdminKycRecord[]}){
 return <Panel className="detail">
  <div className="section-head"><div><h2>Vehículos pendientes · lectura autorizada</h2>
   <p>Metadatos mínimos recibidos desde una sesión Admin con MFA. Sin documentos, nombres ni teléfonos.</p></div>
   <span className="muted-tag">SOLO LECTURA</span></div>
  {items.length===0?<div className="empty"><h3>Sin registros en esta página</h3>
   <p>Sin afirmar que la cola global está vacía. No hay decisiones habilitadas.</p></div>:
   <div>{items.map(record=><div className="training-row" key={record.vehicleId}>
    <div><strong>Vehículo {record.vehicleKind}</strong>
     <small>Solicitud: {record.applicationStatus} · Seguro: {record.insuranceStatus}</small>
     <small>Licencia: {record.licenseStatus} · Inspección: {record.inspectionStatus}</small>
     <small>Revisión servidor: {record.reviewRevision}</small>
    </div><span className="muted-tag">SIN ACCIÓN</span>
   </div>)}</div>}
  <p className="training-disclaimer">Toda aprobación o rechazo requiere endpoint autorizado y confirmación posterior del servidor. No se muestran archivos ni enlaces de evidencia.</p>
 </Panel>;
}
type OwnerFinance=NonNullable<AdminSnapshot['finance']>;
function OwnerPanel({finance,authorized}:{finance:OwnerFinance|null;authorized:boolean}){
 const amount=(x:number)=>new Intl.NumberFormat('es-PY',{maximumFractionDigits:0}).format(x)+' Gs.';
 const metrics:{key:keyof OwnerFinance['totals'];name:string;hint:string}[]=[
  {key:'grossCollectedGs',name:'Cobros brutos',hint:'Importes registrados'},
  {key:'platformCommissionGs',name:'Comisiones plataforma',hint:'Valor declarado por servidor'},
  {key:'driverPayoutGs',name:'Liquidaciones conductores',hint:'No son utilidades de la empresa'},
  {key:'refundsGs',name:'Reembolsos',hint:'Importes devueltos'},
  {key:'processingFeesGs',name:'Costos de procesamiento',hint:'Costos del ledger'},
  {key:'netPlatformGs',name:'Neto de plataforma',hint:'Neto conciliado, no utilidad fiscal'}
 ];
 return <div className="owner-layout">
  <Panel>
   <div className="section-head"><div><h2>Control financiero del propietario</h2>
    <p>Información agregada y conciliada por el servidor, nunca calculada desde viajes ficticios.</p></div>
    <span className="muted-tag">{finance?'CONCILIADO':'NO CONECTADO'}</span></div>
   {!authorized?<p className="owner-warning">Acceso reservado al rol propietario con MFA autorizado por el backend. Ningún importe está disponible.</p>
    :!finance?<p className="owner-warning">No hay cifras financieras verificadas y vigentes de esta cuenta. No asumimos saldo cero.</p>
    :<p className="owner-period">Período {finance.period.from} — {finance.period.to} · Ledger {finance.ledgerRevision} · PYG</p>}
   <div className="owner-metrics">{metrics.map(m=><div className="owner-kpi" key={m.key}>
    <small>{m.name}</small><strong>{finance?amount(finance.totals[m.key]):'—'}</strong>
    <span>{m.hint}</span></div>)}</div>
   <div className="owner-counts">
    <span>Viajes: <strong>{finance?.totals.completedRides??'—'}</strong></span>
    <span>Envíos: <strong>{finance?.totals.completedDeliveries??'—'}</strong></span>
    <span>Pedidos: <strong>{finance?.totals.completedMerchantOrders??'—'}</strong></span>
   </div>
   <p className="training-disclaimer">Un guion indica dato no verificado, no cero. No se accede a cuentas bancarias ni información personal de conductores.</p>
  </Panel>
  <Panel><h2>Control estratégico</h2>
   <p>Las tarifas, comisiones, zonas y liquidaciones necesitan autorización de servidor, revisión y bitácora. Esta interfaz no habilita modificaciones.</p>
   <div className="empty-chip">SOLO LECTURA · NO LIVE</div></Panel>
 </div>;
}
function App(){
 const {view:adminState}=useAdminView();
 const [page,setPage]=useState<Page>('resumen');
 const [menuOpen,setMenuOpen]=useState(false);
 const view=sections.find(x=>x.id===page)!;
 return <div className="shell">
  <aside className={'sidebar '+(menuOpen?'is-open':'')} aria-label="Navegación administrativa">
   <div className="brand"><span className="mark">M</span><div><strong>Movete Fácil</strong><small>ADMIN · QA</small></div></div>
   <div className="nav-label">GESTIÓN</div>
   <nav>{sections.map(item=><button key={item.id}
    className={'nav-item '+(page===item.id?'active':'')}
    aria-current={page===item.id?'page':undefined}
    onClick={()=>{setPage(item.id);setMenuOpen(false);}}>
    <span>{item.label}</span><span aria-hidden="true">›</span></button>)}</nav>
   <div className="sidebar-bottom"><div className="dot" /> <span>Servidor sin conexión</span><small>Operaciones deshabilitadas</small></div>
  </aside>
  <main className="main">
   <header className="topbar">
    <button type="button" className="mobile-nav" aria-label="Abrir menú" onClick={()=>setMenuOpen(!menuOpen)}>☰</button>
    <span className="topbar-title">Panel de administración</span>
    <span className="environment">MODO QA · NO LIVE</span>
   </header>
   <div className="container">
    <div className="intro"><div><p className="overline">MOVETE FÁCIL · ADMINISTRACIÓN</p>
     <h1>{view.label}</h1><p>{view.hint} · {adminState.authenticated?'Sesión de QA por proveedor (sin backend certificado)':'Sin autenticación administrativa activa'}</p></div>
     <div className="date">Versión de interfaz · 22 OCT 2026</div></div>
    <div role="status" className="notice"><span aria-hidden="true">ⓘ</span>
     <span><strong>Modo demostración técnica.</strong> El panel no consulta datos personales, no ejecuta decisiones KYC ni modifica zonas. No ingreses credenciales reales.</span></div>
    {page==='resumen'?<>
      <div className="metric-grid">{cards.map(([label,value,desc])=><Panel key={label} className="metric">
       <small>{label}</small><strong>{value}</strong><span>{desc}</span></Panel>)}</div>
      <div className="two-column"><Panel><div className="section-head"><h2>Estado de integración</h2><span className="muted-tag">PENDIENTE</span></div>
       <ul className="milestones"><li><span className="status-circle" /> Sesión Admin segura / MFA</li>
        <li><span className="status-circle" /> Lectura de colas KYC</li>
        <li><span className="status-circle" /> Estado de zonas e incidentes</li>
        <li><span className="status-circle" /> Auditoría con revisión del servidor</li></ul></Panel>
       <Panel><h2>Separación de aplicaciones</h2>
        <p>Esta interfaz web es independiente de la aplicación <strong>Cliente</strong> y de la aplicación <strong>Driver</strong>.</p>
        <p>Los permisos de administrador nunca deben enviarse ni empaquetarse en una app móvil.</p>
        <div className="empty-chip">Solo presentación · Sin service role</div>
       </Panel></div>
     </>:page==='propietario'?<OwnerPanel authorized={adminState.account?.role==='owner'} finance={adminState.account?.role==='owner'?adminState.finance:null}/>:page==='kyc'?(adminState.authenticated&&adminState.kyc?<AuthorizedQueue items={adminState.kyc.items}/>:<KycTraining/>):<Panel className="detail"><div className="section-head"><div><h2>{panels[page].title}</h2><p>{panels[page].description}</p></div>
        <span className="muted-tag">SIN API</span></div>
       <div className="empty"><div className="empty-symbol">○</div><h3>Sin datos conectados</h3>
        <p>{panels[page].empty}</p></div>
       <h3>Requisitos de activación</h3><ul className="requirements">{panels[page].requirements.map(x=><li key={x}>{x}</li>)}</ul>
     </Panel>}
    <footer>Arquitecto B · PR #8 DRAFT · Sin despliegue, SQL remoto ni cobros</footer>
   </div>
  </main>
 </div>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><AdminRuntimeProvider><App/></AdminRuntimeProvider></React.StrictMode>);
