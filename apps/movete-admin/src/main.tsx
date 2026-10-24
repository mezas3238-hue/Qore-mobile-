import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createReviewDraft,TRAINING_CASES} from './review-draft.mjs';
import {AdminRuntimeProvider,useAdminView} from './AdminRuntime';
import type {AdminExperience,AdminKycRecord,AdminSnapshot} from './admin-experience.mjs';
import {projectKycPageView} from './kyc-page-view.mjs';
import {projectIncidentPageTriage} from './incident-page-triage.mjs';
import type {IncidentPageFilter,IncidentPageOrder} from './incident-page-triage.mjs';
import type {MerchantCasePageSuccess} from './merchant-case-page.mjs';
import type {KycFilter} from './kyc-page-view.mjs';
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

const kycLabels:Record<KycFilter,string>={
 ALL:'Todos',EXPIRED:'Documento vencido',REJECTED:'Documento rechazado',
 MISSING:'Documentación ausente',PENDING:'Verificación pendiente',
 REPORTED_VALID:'Documentación reportada válida'
};
function AuthorizedQueue({items}:{items:readonly AdminKycRecord[]}){
 const [filter,setFilter]=useState<KycFilter>('ALL');
 const page=projectKycPageView(items,{filter});
 return <Panel className="detail">
  <div className="section-head"><div><h2>Expedientes de vehículos · solo lectura</h2>
   <p>Estado documental certificado por el contrato del backend. Sin fotografías, nombres, teléfonos o documentación privada.</p></div>
   <span className="muted-tag">SIN DECISIONES</span></div>
  <p className="kyc-notice" role="note">Un expediente aprobado o con documentos reportados como válidos <strong>NO significa que el vehículo esté habilitado</strong> para operar. La verificación independiente y vigencia legal corresponden al servidor.</p>
  {page?<><div className="kyc-filters">
    <label htmlFor="kyc-filter">Filtrar estados de esta página</label>
    <select id="kyc-filter" value={filter}
     onChange={event=>setFilter(event.target.value as KycFilter)}>
     {Object.entries(kycLabels).map(([code,label])=>
      <option key={code} value={code}>{label}</option>)}
    </select>
    <small>Mostrando {page.visibleCount} de {page.counts.ALL} expedientes de esta página. El filtro no incluye otras páginas.</small>
   </div>
   <div className="kyc-counters" aria-label="Totales documentales de esta página">
    {(['EXPIRED','REJECTED','MISSING','PENDING','REPORTED_VALID'] as KycFilter[]).map(key=>
     <span key={key}><strong>{page.counts[key]}</strong> {kycLabels[key]}</span>)}
   </div>
   {page.visibleCount===0?<div className="empty"><h3>Sin coincidencias en esta página</h3>
    <p>No equivale a cero expedientes en otras páginas. El total de la plataforma no tiene un límite de 50 registros.</p></div>:
    <div>{page.items.map(record=><div className="kyc-record" key={record.vehicleId}>
     <div><strong>Vehículo {record.vehicleKind}</strong>
      <small>Solicitud: {record.applicationStatus} · Revisión de servidor: {record.reviewRevision}</small>
      <small>Licencia: {record.licenseStatus} · Seguro: {record.insuranceStatus} · Inspección: {record.inspectionStatus}</small>
     </div><span className="muted-tag">{kycLabels[record.evidence]} · NO HABILITADO</span>
    </div>)}</div>}
   </>:<div className="owner-warning" role="alert">
    No se pueden mostrar estos expedientes: el contenido no cumple el contrato G29.
   </div>}
  <p className="training-disclaimer">El estado de los documentos no permite aprobar, rechazar ni habilitar vehículos. Consulta por páginas, con consistencia eventual y sin límite global de expedientes.</p>
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
function ZoneReadOnly({zones,allowed}:{
 zones:AdminSnapshot['zones'];allowed:boolean;
}){
 return <Panel className="detail">
  <div className="section-head"><div>
   <h2>Supervisión geográfica por servicio</h2>
   <p>La cobertura habilitada nunca garantiza un automóvil o repartidor disponible.</p>
  </div><span className="muted-tag">SOLO LECTURA</span></div>
  {!allowed?<p>No hay sesión administrativa autorizada. El propietario no hereda la consulta operativa de zonas.</p>
   :!zones?<div className="empty"><h3>Sin datos de zonas certificados</h3>
    <p>Esperando el contrato de lectura y la validación de la cobertura en backend.</p></div>
   :zones.items.length===0?<div className="empty"><h3>Sin resultados en esta consulta</h3>
    <p>No se infiere que Paraguay carezca de zonas operativas.</p></div>
   :<div className="zone-rows">{zones.items.map(item=>
    <div className="zone-row" key={item.zoneId+":"+item.serviceKind}>
     <div><strong>{item.municipality}</strong>
      <small>{item.serviceKind.replaceAll('_',' ')} · Cobertura: {item.coverageStatus}</small>
      <small>Permiso operativo: {item.eligibleByPolicy?'Reportado habilitado':'No habilitado'}</small></div>
     <div className="zone-count">{item.availabilityFresh?String(item.onDutyVehicles):'—'}
      <small>Vehículos en línea reportados</small></div>
    </div>)}</div>}
  <p className="training-disclaimer">Estos datos son solo una vista del servidor. No estiman aceptación, tiempos de espera ni capacidad de despacho; no habilitan rutas, motos de pasajeros ni zonas nuevas.</p>
 </Panel>;
}


/** G41 se muestra únicamente si el runtime autorizado está CERTIFICADO.
 * No declara total global de casos ni envío SOS. A05 continúa independiente.
 */
function GlobalTriagePanel({client,state}:{client:AdminExperience;state:AdminSnapshot}){
 const [severity,setSeverity]=useState('');
 const [status,setStatus]=useState('');
 const queue=state.globalTriage;
 if(!queue?.contractReady)return null;
 const selectedSeverity=severity||null,selectedStatus=status||null;
 const matching=queue.page?.severityFilter===selectedSeverity
  &&queue.page?.statusFilter===selectedStatus;
 const page=matching?queue.page:null;
 const labels:Record<string,string>={
  CRITICAL:'Crítica',HIGH:'Alta',MEDIUM:'Media',LOW:'Baja'
 };
 return <Panel className="detail">
  <div className="section-head"><div>
   <h2>Triaje global del servidor · solo STAGING</h2>
   <p>Filtros aplicados antes de paginar por el backend autorizado. Sin datos personales, sin acciones sobre cuentas ni despacho de emergencias.</p>
  </div><span className="muted-tag">G41 · LECTURA QA</span></div>
  <p className="kyc-notice" role="note">
   El servidor filtra globalmente, pero esta pantalla solo cuenta las filas de <strong>la página consultada</strong>. No se dispone de total global ni snapshot consistente.
  </p>
  <div className="kyc-filters">
   <label htmlFor="global-incident-severity">Gravedad — filtro en servidor</label>
   <select id="global-incident-severity" value={severity}
    onChange={event=>setSeverity(event.target.value)}>
    <option value="">Todas las gravedades</option>
    <option value="CRITICAL">Crítica</option>
    <option value="HIGH">Alta</option>
    <option value="MEDIUM">Media</option>
    <option value="LOW">Baja</option>
   </select>
   <label htmlFor="global-incident-status">Estado — filtro en servidor</label>
   <select id="global-incident-status" value={status}
    onChange={event=>setStatus(event.target.value)}>
    <option value="">Todos los estados</option>
    <option value="OPEN">Abierto</option>
    <option value="TRIAGED">Clasificado</option>
    <option value="INVESTIGATING">Investigando</option>
    <option value="RESOLVED">Resuelto</option>
    <option value="CLOSED">Cerrado</option>
   </select>
  </div>
  <div className="refresh-actions">
   <button type="button" disabled={queue.loading} onClick={()=>void client.loadGlobalIncidentTriage({
    severityFilter:selectedSeverity,statusFilter:selectedStatus
   })}>{queue.loading?'Consultando…':'Consultar filtro global'}</button>
   <button type="button" disabled={queue.loading||!matching||!queue.hasPrevious}
    onClick={()=>void client.loadGlobalIncidentTriage({
     severityFilter:selectedSeverity,statusFilter:selectedStatus,previous:true
    })}>Página anterior filtrada</button>
   <button type="button" disabled={queue.loading||!matching||!queue.hasNext}
    onClick={()=>void client.loadGlobalIncidentTriage({
     severityFilter:selectedSeverity,statusFilter:selectedStatus,next:true
    })}>Siguiente página filtrada</button>
  </div>
  {queue.error&&<p role="alert" className="owner-warning">
   La consulta G41 no pudo validarse ({queue.error}). No se presentan datos no confirmados.
  </p>}
  {page?<div aria-live="polite">
   <p>Resultado filtrado por servidor: página {queue.pageNumber}. {page.items.length} casos en esta página; total de plataforma desconocido.</p>
   {page.items.length===0?<div className="empty"><h3>Sin coincidencias en esta página</h3>
    <p>No demuestra que existan cero casos en otras páginas.</p></div>
   :<div className="zone-rows">{page.items.map(item=>
    <div className="zone-row" key={item.incidentId}>
     <div><strong>{item.category} · {labels[item.severity]??'Sin nivel'}</strong>
      <small>Estado de servidor: {item.status}</small>
      <small>Fecha: {new Date(item.createdAt).toLocaleString('es-PY')}</small>
     </div><div className="zone-count">#{item.revision}<small>Revisión de servidor</small></div>
    </div>)}</div>}
  </div>:<p className="training-disclaimer">
   Consultá el filtro seleccionado para obtener una página vigente. La información anterior nunca se presenta como resultado de filtros nuevos.
  </p>}
  <p className="training-disclaimer">G41 no confirma atención, SOS, emergencias, ni habilita suspensiones. La autorización es exclusiva del backend.</p>
 </Panel>;
}

/**
 * R43: bandeja comercial INDEPENDIENTE de seguridad genérica y G41.
 * La UI nunca transforma una categoría OTHER/DELIVERY en MERCHANT_ORDER.
 * Hasta que A monte el endpoint no hay casos para mostrar ni gestionar.
 */
function MerchantCasesReadOnly({cases,contractReady,allowed}:{
 cases:MerchantCasePageSuccess|null;contractReady:boolean;allowed:boolean;
}){
 const fresh=allowed&&contractReady&&cases?.ok===true
  &&cases.expiresAt>Date.now();
 const reasons:Record<string,string>={
  MISSING_ITEM:'Producto faltante',WRONG_ITEM:'Producto equivocado',
  DAMAGED_ITEM:'Artículo dañado',LATE_DELIVERY:'Entrega demorada',
  PRICE_DISPUTE:'Desacuerdo por importe',
  SAFETY_CONCERN:'Problema de seguridad (NO SOS)'
 };
 const states:Record<string,string>={
  RECEIVED_QA:'Recibido en base QA',CLASSIFIED_QA:'Clasificado en QA',
  REVIEW_QA:'En estado de revisión QA',CLOSED_QA:'Cerrado en QA'
 };
 return <Panel className="detail">
  <div className="section-head"><div>
   <h2>Casos de pedidos comerciales</h2>
   <p>Supermercados, farmacias autorizadas, restaurantes y otros comercios.
    Canal independiente del chat con conductores.</p>
  </div><span className="muted-tag">QA · SOLO LECTURA</span></div>
  {!allowed?<div className="owner-warning" role="alert">
   Se requiere sesión administrativa autorizada con MFA. No hay acceso de propietario, pasajero ni conductor a esta bandeja.
  </div>
  :!contractReady?<div className="empty">
   <h3>Gestión comercial pendiente de conexión</h3>
   <p>No existe todavía un endpoint certificado que identifique expedientes de pedidos comerciales. La cola de incidentes generales no puede usarse para deducirlos.</p>
   <p>No se han asignado agentes, enviado mensajes, abierto tickets ni contactado comercios desde esta pantalla.</p>
  </div>
  :!fresh?<div className="owner-warning" role="alert">
   Sin página comercial certificada y vigente. No se pueden mostrar expedientes anteriores ni asumir que hay cero casos.
  </div>
  :<>
   <p role="status">
    {cases.counts.visible} expedientes en esta página, de los cuales
    {' '}{cases.counts.open} tienen estado abierto QA. Total de la plataforma desconocido.
   </p>
   {cases.items.length===0?<div className="empty">
    <h3>Esta página no contiene casos</h3>
    <p>Puede haber otros expedientes en páginas siguientes; no se infiere un total global.</p>
   </div>:<div className="zone-rows">
    {cases.items.map(item=><div className="zone-row" key={item.caseId}>
     <div>
      <strong>{reasons[item.reason]??'Motivo no verificable'} · {item.severity}</strong>
      <small>{states[item.state]??'Estado QA no verificable'}</small>
      <small>Actualización QA: {new Date(item.updatedAt).toLocaleString('es-PY')}</small>
     </div><div className="zone-count">
      #{item.revision}<small>Revisión QA</small>
     </div>
    </div>)}
   </div>}
   <p className="training-disclaimer">
    Solo esta página autorizada. Sin asignaciones, respuestas,
    resolución operativa, atención humana, suspensión ni SOS.
   </p>
  </>}
  <p className="training-disclaimer">
   Sin identificadores de clientes, teléfonos, direcciones o artículos privados.
   La autorización, comunicación y decisiones corresponden al backend auditado.
  </p>
 </Panel>;
}

function IncidentReadOnly({incidents,allowed}:{
 incidents:AdminSnapshot['incidents'];allowed:boolean;
}){
 const [filter,setFilter]=useState<IncidentPageFilter>('ALL');
 const [order,setOrder]=useState<IncidentPageOrder>('PRIORITY');
 const page=allowed&&incidents?projectIncidentPageTriage(incidents,{filter,order}):null;
 const severities:Record<string,string>={LOW:'Baja',MEDIUM:'Media',HIGH:'Alta',CRITICAL:'Crítica'};
 return <Panel className="detail">
  <div className="section-head"><div><h2>Bandeja privada de incidentes</h2>
   <p>Metadatos autorizados únicamente, sin nombres, teléfonos, ubicación ni documentos personales.</p>
  </div><span className="muted-tag">SOLO LECTURA · NO SOS</span></div>
  {!allowed?<div className="empty"><h3>Sin autorización Admin</h3>
    <p>Los incidentes no se muestran a propietarios ni pasajeros sin permiso específico.</p></div>
   :!incidents?<div className="empty"><h3>Sin conexión al canal seguro</h3>
    <p>No se puede afirmar que hay cero incidentes. No hay recepción ni respuesta de emergencias activa.</p></div>
   :!page?<div className="owner-warning" role="alert">
    La página de incidentes está vencida o no cumple el contrato seguro. Actualizá antes de continuar.
   </div>
   :<>
    <div className="kyc-counters" aria-label="Recuento exclusivo de la página consultada">
     <span><strong>{page.counts.all}</strong> expedientes en esta página</span>
     <span><strong>{page.counts.active}</strong> casos activos en esta página</span>
     <span><strong>{page.counts.criticalActive}</strong> críticos activos en esta página</span>
    </div>
    <p className="kyc-notice" role="note">Estas cifras corresponden <strong>solo a esta página</strong>, no al total del servidor. La prioridad es exclusivamente visual; NO representa despacho, SOS ni atención confirmada.</p>
    <div className="kyc-filters">
     <label htmlFor="incident-page-filter">Filtrar casos de esta página</label>
     <select id="incident-page-filter" value={filter}
      onChange={event=>setFilter(event.target.value as IncidentPageFilter)}>
      <option value="ALL">Todos los de esta página</option>
      <option value="ACTIVE">Solo estados abiertos o en revisión</option>
      <option value="CRITICAL_ACTIVE">Críticos activos de esta página</option>
     </select>
     <label htmlFor="incident-page-order">Ordenar los resultados de esta página</label>
     <select id="incident-page-order" value={order}
      onChange={event=>setOrder(event.target.value as IncidentPageOrder)}>
      <option value="PRIORITY">Activos y mayor severidad primero</option>
      <option value="RECENT">Fecha más reciente primero</option>
     </select>
     <small role="status">Mostrando {page.items.length} de {page.counts.all} casos de esta página. Para ver los siguientes registros usá la paginación del servidor.</small>
    </div>
    {page.items.length===0?<div className="empty"><h3>Sin coincidencias en esta página</h3>
     <p>El filtro no revisa otras páginas. No significa que no existan incidentes pendientes en el resto de la plataforma.</p></div>
    :<div className="zone-rows">{page.items.map(item=>
     <div className="zone-row" key={item.incidentId}>
      <div><strong>{item.category} · {severities[item.severity]??'Sin nivel'}</strong>
       <small>Estado informado por servidor: {item.status}</small>
       <small>Fecha de servidor: {new Date(item.createdAt).toLocaleString('es-PY')}</small>
      </div><div className="zone-count">#{item.revision}<small>Revisión</small></div>
     </div>)}</div>}
   </>}
  <p className="training-disclaimer">Sin detalle personal ni operaciones para suspender cuentas. Las decisiones y la respuesta de seguridad corresponden a servicios autorizados y auditados del backend.</p>
 </Panel>;
}

function AuditReadOnly({audit,allowed}:{
 audit:AdminSnapshot['audit'];allowed:boolean;
}){
 return <Panel className="detail">
  <div className="section-head"><div><h2>Registro de auditoría de servidor</h2>
   <p>Vista mínima sin identidades personales. G30 comprende únicamente revisión de vehículos, incidentes y suspensiones/restablecimientos; todavía faltan auditorías de tarifas, comisiones, zonas, comercios y accesos. No es una bitácora integral.</p>
  </div><span className="muted-tag">SOLO LECTURA</span></div>
  {!allowed?<div className="empty"><h3>Permiso de auditoría no otorgado</h3>
     <p>Requiere sesión administrativa y permiso específico del backend.</p></div>
   :!audit?<div className="empty"><h3>Sin respuesta de auditoría certificada</h3>
     <p>No se afirma ausencia de eventos: falta lectura autorizada y contrato auditable.</p></div>
   :audit.items.length===0?<div className="empty"><h3>Sin eventos en esta página</h3>
     <p>La ausencia de resultados aquí no certifica un registro global vacío.</p></div>
   :<div className="zone-rows">{audit.items.map(event=>
     <div className="zone-row" key={event.eventId}>
      <div><strong>{event.operation.replaceAll('_',' ')}</strong>
       <small>Recurso: {event.targetKind} · Resultado: {event.outcome}</small>
       <small>Tipo actor: {event.actorRole} · {new Date(event.occurredAt).toLocaleString('es-PY')}</small></div>
      <div className="zone-count">#{event.revision}<small>Revisión</small></div>
     </div>)}</div>}
  <p className="training-disclaimer">La interfaz no crea, firma ni borra eventos. El backend deberá garantizar orden, cadena de integridad, almacenamiento y acceso por permisos auditados.</p>
 </Panel>;
}

const readOperation:Record<Page,string|null>={
 resumen:null,propietario:'finance',kyc:'kyc',zonas:'zones',incidentes:'incidents',auditoria:'audit'
};
const safeFeedback:Record<string,string>={
 AUTH_REQUIRED:'La sesión caducó. Volvé a autenticarte.',
 FORBIDDEN:'No tenés permiso para consultar estos datos.',
 STALE_SESSION_RESPONSE:'La cuenta cambió durante la lectura. Se descartó la respuesta.',
 INVALID_READ_DTO:'La respuesta del servidor no cumple el contrato aprobado.',
 NETWORK_OR_TIMEOUT:'No se obtuvo respuesta segura del servidor.',
 READ_CONTRACT_NOT_CERTIFIED:'Contrato pendiente de certificación.',
 NO_ADDITIONAL_PAGE:'No hay otra página disponible.'
};
function App(){
 const {client,view:adminState}=useAdminView();
 const [page,setPage]=useState<Page>('resumen');
 const [menuOpen,setMenuOpen]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 const [refreshStatus,setRefreshStatus]=useState<{page:Page;description:string}|null>(null);
 const view=sections.find(x=>x.id===page)!;
 const operation=readOperation[page];
 const expectedRole=page==='propietario'?'owner':'admin';
 const canRefresh=operation!==null
   &&adminState.account?.role===expectedRole
   &&client.isReadConfigured(operation);
 const navigable=operation!==null&&operation!=='finance';
 const pager=navigable?adminState.pagination[operation as keyof AdminSnapshot['pagination']]:null;
 async function refreshPage(direction:'refresh'|'next'|'previous'|'reset'='refresh'){
  if(!operation||!canRefresh||refreshing)return;
  const requestedPage=page;
  setRefreshing(true);
  try{
   const result=await client.syncFromServer(operation,direction);
   setRefreshStatus({page:requestedPage,
    description:result.ok?'Lectura validada. Datos actualizados según permisos y vigencia.':
     safeFeedback[result.code??'']??'No se pudo validar la lectura. No se mostraron datos nuevos.'});
  }catch{
   setRefreshStatus({page:requestedPage,description:'Consulta no confirmada. No se mostraron datos nuevos.'});
  }finally{setRefreshing(false);}
 }
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
    {operation!==null&&<div className="refresh-panel" aria-label="Actualización segura del panel">
     <div>
      <strong>Consulta segura del servidor</strong>
      <small>{canRefresh?'Contrato habilitado para esta sesión y rol.':
        'Pendiente de autorización Backend y contrato STAGING certificado.'}</small>
     </div>
     <div className="refresh-actions">
      <button type="button" disabled={!canRefresh||refreshing} onClick={()=>{void refreshPage('refresh');}}>
       {refreshing?'Consultando…':'Actualizar datos'}
      </button>
      {navigable&&<div className="page-actions" aria-label="Paginación de la bandeja">
       <button type="button" disabled={!canRefresh||refreshing||!pager?.hasPrevious}
        onClick={()=>{void refreshPage('previous');}}>Anterior</button>
       <span aria-live="polite">Página {pager?.pageNumber??1}</span>
       <button type="button" disabled={!canRefresh||refreshing||!pager?.hasNext}
        onClick={()=>{void refreshPage('next');}}>Siguiente</button>
      </div>}
     </div>
     {refreshStatus?.page===page&&<p role="status">{refreshStatus.description}</p>}
    </div>}
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
     </>:page==='propietario'?<OwnerPanel authorized={adminState.account?.role==='owner'} finance={adminState.account?.role==='owner'?adminState.finance:null}/>:page==='auditoria'?<AuditReadOnly audit={adminState.audit} allowed={adminState.account?.role==='admin'}/>:page==='incidentes'?<>
   <MerchantCasesReadOnly
    cases={adminState.merchantCases}
    contractReady={adminState.merchantCaseContractReady}
    allowed={adminState.account?.role==='admin'&&adminState.account.mfaVerified===true}/>
   <GlobalTriagePanel client={client} state={adminState}/>
   <IncidentReadOnly incidents={adminState.incidents} allowed={adminState.account?.role==='admin'}/>
  </>:page==='zonas'?<ZoneReadOnly zones={adminState.zones} allowed={adminState.account?.role==='admin'}/>:page==='kyc'?(adminState.account?.role==='owner'?<Panel className="detail"><h2>Revisión de documentos</h2><p>Esta sesión es de propietario, no de revisor KYC. La lectura y las decisiones requieren permisos administrativos separados y certificados por el servidor.</p><div className="empty-chip">Acceso no autorizado para rol owner</div></Panel>:adminState.authenticated&&adminState.kyc?<AuthorizedQueue items={adminState.kyc.items}/>:<KycTraining/>):<Panel className="detail">
       <h2>Sección no disponible</h2>
       <p>Esta vista no tiene contrato autorizado. No hay acciones operativas ni datos reales.</p>
       <div className="empty-chip">QA · SIN API</div>
     </Panel>}

    <footer>Arquitecto B · PR #8 DRAFT · Sin despliegue, SQL remoto ni cobros</footer>
   </div>
  </main>
 </div>;
}
const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><AdminRuntimeProvider><App/></AdminRuntimeProvider></React.StrictMode>);
