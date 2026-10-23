import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type Page='resumen'|'kyc'|'zonas'|'incidentes'|'auditoria';
const sections:{id:Page;label:string;hint:string}[]=[
 {id:'resumen',label:'Resumen',hint:'Indicadores operativos'},
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
function App(){
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
     <h1>{view.label}</h1><p>{view.hint} · Sin autenticación administrativa activa</p></div>
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
     </>:<Panel className="detail"><div className="section-head"><div><h2>{panels[page].title}</h2><p>{panels[page].description}</p></div>
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
if(root)createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
