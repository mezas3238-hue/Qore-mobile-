import React,{useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import {verifyWebAdminConfig} from './web-admin-config.mjs';
import './styles.css';

/** Independent merchant staff portal. No Admin/Owner login or role escalation. */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const states=['requested','confirmed','preparing','ready','handed_to_courier','delivered','cancelled'];
type Order={orderId:string;branchId:string;status:string;revision:number;
 vehicleKind:'AUTO'|'MOTO';subtotalPyg:number;deliveryId:string|null;
 lineCount:number;itemUnits:number;createdAt:string};
type Identity={subject:string;merchantIds:string[]};
const transitions:Record<string,{event:string;label:string}|undefined>={
 requested:{event:'confirm',label:'Confirmar pedido'},
 confirmed:{event:'start_preparing',label:'Iniciar preparación'},
 preparing:{event:'ready',label:'Marcar listo'},
 ready:{event:'hand_to_courier',label:'Registrar entrega al repartidor'}
};
const env=import.meta.env;
function backendOrigin(value:unknown):string|null{
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&
   u.pathname==='/'&&!u.search&&!u.hash&&
   /^[a-z0-9-]+\.onrender\.com$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
}
const configuration=verifyWebAdminConfig({
 url:env.VITE_SUPABASE_URL,
 publishableKey:env.VITE_SUPABASE_PUBLISHABLE_KEY
});
const origin=backendOrigin(env.VITE_G156_MERCHANT_ORIGIN);
const enabled=env.VITE_G156_MERCHANT_PORTAL_ENABLED==='true'&&
 env.VITE_G156_EXTERNAL_RUNTIME_VERIFIED==='true'&&
 env.VITE_G156_PROVIDER_REVOCATION_VERIFIED==='true'&&
 origin!==null&&origin===backendOrigin(env.VITE_G156_MERCHANT_PINNED_ORIGIN)&&
 configuration.ok===true;
const ratingEnabled=enabled&&
 ['VITE_G155_OWNER_APPROVED','VITE_G155_BACKEND_CONTRACT_VERIFIED',
  'VITE_G155_ORIGINAL_COMPLETION_VERIFIED','VITE_G155_EXTERNAL_RUNTIME_VERIFIED',
  'VITE_G155_PROVIDER_REVOCATION_VERIFIED'].every(k=>env[k]==='true');
const sdk=enabled&&configuration.ok===true?
 createClient(configuration.url,configuration.publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,
   detectSessionInUrl:false,flowType:'pkce',storageKey:'qore-merchant-volatile'}
 }):null;
const safeOrders=(raw:unknown,merchantId:string):Order[]=>{
 if(raw===null||typeof raw!=='object')throw Error('Respuesta no válida');
 const data=raw as Record<string,unknown>;
 if(data.merchantId!==merchantId||data.mode!=='STAGING_DEMO_ONLY'||
  data.serverPersisted!==true||data.liveCommerceEnabled!==false||
  data.limit!==20||!Array.isArray(data.orders)||data.orders.length>20)
  throw Error('Respuesta no verificada');
 const result:Order[]=[];
 for(const x of data.orders){
  if(x===null||typeof x!=='object')throw Error('Pedido no válido');
  const row=x as Record<string,unknown>;
  if(!UUID.test(String(row.orderId))||!UUID.test(String(row.branchId))||
   !states.includes(String(row.status))||
   !['AUTO','MOTO'].includes(String(row.vehicleKind))||
   !Number.isSafeInteger(row.revision)||!Number.isSafeInteger(row.subtotalPyg)||
   !Number.isSafeInteger(row.itemUnits)||!Number.isSafeInteger(row.lineCount)||
   row.deliveryId!==null&&!UUID.test(String(row.deliveryId)))
   throw Error('Pedido no verificado');
  result.push(row as Order);
 }
 return result;
};
function MerchantApp(){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [identity,setIdentity]=useState<Identity|null>(null);
 const [merchantId,setMerchantId]=useState('');
 const [orders,setOrders]=useState<Order[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const pending=useRef<Map<string,string>>(new Map());
 const reviewKeys=useRef<Map<string,{stars:number;key:string}>>(new Map());
 const [reviewStars,setReviewStars]=useState<Record<string,number>>({});
 const [reviewed,setReviewed]=useState<string[]>([]);
 const locked=useRef(false);
 const amount=useMemo(()=>new Intl.NumberFormat('es-PY'),[]);
 async function bearer(subject:string){
  if(!sdk)throw Error('Proveedor STAGING no configurado');
  const response=await sdk.auth.getSession(),s=response.data?.session;
  if(response.error||!s||s.user?.id!==subject||
   typeof s.access_token!=='string'||s.access_token.length<20||
   typeof s.expires_at!=='number'||s.expires_at*1000<=Date.now()+5000)
   throw Error('Sesión vencida');
  const verified=await sdk.auth.getUser(s.access_token);
  if(verified.error||verified.data.user?.id!==subject||
   verified.data.user.is_anonymous===true)
   throw Error('Identidad no verificada');
  return s.access_token;
 }
 async function signIn(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!sdk||locked.current)return;
  locked.current=true;setBusy(true);setMessage('');
  try{
   const login=await sdk.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
   setPassword('');
   if(login.error||!login.data.user)throw Error('Credenciales o cuenta no válidas');
   const subject=login.data.user.id;
   await bearer(subject);
   const membership=await sdk.from('mobility_stage_merchant_staff')
    .select('merchant_id').eq('user_id',subject).eq('active',true).limit(20);
   const ids=membership.data?.map(row=>row.merchant_id).filter(x=>UUID.test(x))??[];
   if(membership.error||ids.length===0)throw Error('No se verificó personal activo de comercio');
   setIdentity({subject,merchantIds:ids});
   setMerchantId(ids[0]);setOrders([]);
   setMessage('Sesión verificada. Consultá los pedidos de tu comercio.');
  }catch(e){
   await sdk.auth.signOut();
   setIdentity(null);setOrders([]);
   setMessage(e instanceof Error?e.message:'No se pudo iniciar sesión');
  }finally{locked.current=false;setBusy(false);}
 }
 async function load(id=merchantId){
  if(!identity||!origin||!UUID.test(id)||locked.current)return;
  locked.current=true;setBusy(true);setMessage('');
  try{
   if(!identity.merchantIds.includes(id))throw Error('Comercio no autorizado');
   const token=await bearer(identity.subject);
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   let response:Response;
   try{
    response=await fetch(origin+'/v1/staging/merchant/'+id+'/orders/inbox',{
     method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
     redirect:'error',credentials:'omit',cache:'no-store',
     referrerPolicy:'no-referrer',signal:controller.signal
    });
    if(!response.ok||response.redirected)throw Error('Bandeja no autorizada o no disponible');
    const size=Number(response.headers.get('content-length')??0);
    if(size>32768)throw Error('Respuesta demasiado extensa');
    const text=await response.text();
    if(text.length>32768)throw Error('Respuesta no verificable');
    const validated=safeOrders(JSON.parse(text),id);
    await bearer(identity.subject);
    setOrders(validated);
    setMessage(validated.length===0?'No hay pedidos registrados en esta bandeja.':
     'Pedidos recuperados desde el servidor. No confirma cobros ni despacho.');
   }finally{clearTimeout(timeout);}
  }catch(e){setOrders([]);setMessage(e instanceof Error?e.message:'Lectura no disponible');}
  finally{locked.current=false;setBusy(false);}
 }
 async function transition(order:Order,event:string){
  if(!identity||!origin||busy||locked.current||
   transitions[order.status]?.event!==event)return;
  locked.current=true;setBusy(true);setMessage('');
  const signature=order.orderId+':'+event;
  const key=pending.current.get(signature)??crypto.randomUUID();
  pending.current.set(signature,key);
  try{
   const token=await bearer(identity.subject);
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   try{
    const r=await fetch(origin+'/v1/staging/merchant/orders/'+order.orderId+'/transition',{
     method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
      Accept:'application/json'},body:JSON.stringify({event,eventKey:key}),
     redirect:'error',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
     signal:controller.signal
    });
    if(!r.ok||r.redirected)throw Error('Cambio no confirmado; consultá el pedido antes de reintentar.');
    const data=await r.json();
    if(data.orderId!==order.orderId||data.event!==event||
     !UUID.test(data.eventId??'')||data.serverPersisted!==true||
     data.liveCommerceEnabled!==false)throw Error('Recibo no verificable');
    await bearer(identity.subject);
    pending.current.delete(signature);
    setMessage('Cambio guardado. Actualizá la bandeja para confirmar el nuevo estado.');
   }finally{clearTimeout(timeout);}
  }catch(e){setMessage(e instanceof Error?e.message:'Resultado desconocido. Reintentar con la misma clave.');}
  finally{locked.current=false;setBusy(false);}
 }
 async function rateClient(order:Order){
  if(!ratingEnabled||!identity||!origin||order.status!=='delivered'||
   !UUID.test(order.orderId)||busy||locked.current||reviewed.includes(order.orderId))
   return;
  const selected=reviewStars[order.orderId]??5;
  if(!Number.isSafeInteger(selected)||selected<1||selected>5)return;
  locked.current=true;setBusy(true);setMessage('');
  let saved=reviewKeys.current.get(order.orderId);
  if(!saved){saved={stars:selected,key:crypto.randomUUID()};
   reviewKeys.current.set(order.orderId,saved);}
  try{
   const token=await bearer(identity.subject);
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetch(origin+'/v1/staging/reputation/ratings',{
     method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
     referrerPolicy:'no-referrer',signal:controller.signal,
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
      Accept:'application/json'},
     body:JSON.stringify({requestKey:saved.key,serviceKind:'COMMERCE',
      serviceId:order.orderId,ratedKind:'CLIENT',stars:saved.stars,incidentCode:null})
    });
    if(response.status===401||response.status===403)throw Error('Sesión no autorizada');
    if(response.status===409)throw Error('Pedido no verificable o ya calificado');
    if(response.status!==201||!response.ok||response.redirected)
     throw Error('No hay confirmación. Reintentar solo con la misma clave');
    const length=Number(response.headers.get('content-length')??0);
    if(length>4096||!response.headers.get('content-type')?.startsWith('application/json'))
     throw Error('Recibo no verificable');
    const body=await response.text();
    if(body.length>4096||controller.signal.aborted)throw Error('Recibo no verificable');
    const receipt:unknown=JSON.parse(body);
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))
     throw Error('Recibo mal formado');
    const r=receipt as Record<string,unknown>;
    if(Object.keys(r).length!==11||!UUID.test(String(r.ratingId))||
     r.serviceKind!=='COMMERCE'||r.serviceId!==order.orderId||
     r.ratedKind!=='CLIENT'||r.stars!==saved.stars||r.requestKey!==saved.key||
     r.serverPersisted!==true||r.qaOnly!==true||r.productionEnabled!==false||
     r.dispatchPriorityChanged!==false||r.automatedSuspension!==false)
     throw Error('Recibo G155 no verificado');
    await bearer(identity.subject);
    reviewKeys.current.delete(order.orderId);
    setReviewed(prev=>[...prev,order.orderId]);
    setMessage('Calificación verificada del cliente. No aplica sanciones automáticas.');
   }finally{clearTimeout(timeout);}
  }catch(e){setMessage(e instanceof Error?e.message:'Resultado desconocido. Conservar clave.');}
  finally{locked.current=false;setBusy(false);}
 }
 async function logout(){
  if(sdk)await sdk.auth.signOut();
  pending.current.clear();reviewKeys.current.clear();setReviewStars({});setReviewed([]);
  setIdentity(null);setOrders([]);setPassword('');
  setMessage('Sesión cerrada.');
 }
 return <main style={{maxWidth:960,margin:'0 auto',padding:'28px 20px'}}>
  <header><small>MOVETE FÁCIL · COMERCIOS</small><h1>Gestión de pedidos</h1>
   <p>Panel independiente del administrador. Solo personal autorizado de comercios.</p></header>
  {!enabled?<section role="alert" style={{padding:24,background:'white',borderRadius:12}}>
   <h2>Acceso STAGING deshabilitado</h2>
   <p>La bandeja está implementada y probada en GitHub, pero requiere servidor HTTPS,
   PostgreSQL persistente y revocación del proveedor verificados. No admite pedidos LIVE.</p>
  </section>:!identity?<form onSubmit={e=>void signIn(e)}
   style={{display:'grid',gap:12,maxWidth:420,padding:24,background:'white',borderRadius:12}}>
   <h2>Acceso de personal comercial</h2>
   <label>Correo <input type="email" required autoComplete="username" value={email}
    onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:12}}/></label>
   <label>Contraseña <input type="password" required autoComplete="current-password"
    value={password} onChange={e=>setPassword(e.target.value)}
    style={{width:'100%',padding:12}}/></label>
   <button type="submit" disabled={busy}>Iniciar sesión</button>
  </form>:<section>
   <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
    <label>Comercio <select value={merchantId} onChange={e=>{
     setMerchantId(e.target.value);setOrders([]);pending.current.clear();
     reviewKeys.current.clear();setReviewStars({});setReviewed([]);}}>
     {identity.merchantIds.map(id=><option key={id} value={id}>{id}</option>)}
    </select></label>
    <button disabled={busy} onClick={()=>void load()}>Actualizar pedidos</button>
    <button disabled={busy} onClick={()=>void logout()}>Cerrar sesión</button>
   </div>
   <p>Máximo 20 pedidos recientes. La bandeja no confirma un cobro o una entrega.</p>
   <div style={{display:'grid',gap:14}}>
    {orders.map(o=><article key={o.orderId}
      style={{background:'white',borderRadius:12,padding:20}}>
     <h2>Pedido {o.orderId.slice(0,8)} · {o.status}</h2>
     <p>{amount.format(o.subtotalPyg)} Gs · {o.itemUnits} unidades /
      {o.lineCount} líneas · {o.vehicleKind}</p>
     <p>Sucursal: {o.branchId} · Revisión: {o.revision}</p>
     <p>Envío: {o.deliveryId??'Aún no vinculado'}</p>
     {o.status==='delivered'&&<div style={{marginTop:14}}>
      <strong>Calificar al cliente de este pedido</strong>
      {!ratingEnabled?<p>Calificaciones bloqueadas hasta autorización y certificación STAGING G155.</p>:
       reviewed.includes(o.orderId)?<p>Valoración verificada.</p>:<>
       <p>La entrega debe estar validada por el servidor. Nunca se suspende automáticamente a un cliente.</p>
       <label>Estrellas <select disabled={busy||reviewKeys.current.has(o.orderId)}
        value={reviewKeys.current.get(o.orderId)?.stars??reviewStars[o.orderId]??5}
        onChange={e=>setReviewStars(v=>({...v,[o.orderId]:Number(e.target.value)}))}>
        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} ★</option>)}
       </select></label>
       <button disabled={busy} onClick={()=>void rateClient(o)}>Enviar calificación verificada</button>
       </>}
     </div>}
     {transitions[o.status]&&<button disabled={busy} onClick={()=>
      void transition(o,transitions[o.status]!.event)}>
      {transitions[o.status]!.label}</button>}
    </article>)}
   </div>
  </section>}
  {message&&<p role="status" style={{marginTop:16}}>{message}</p>}
  <footer style={{marginTop:32}}>Entorno de validación técnica · Sin pagos ni asignaciones LIVE.</footer>
 </main>;
}
const root=document.getElementById('merchant-root');
if(root)createRoot(root).render(<React.StrictMode><MerchantApp/></React.StrictMode>);
