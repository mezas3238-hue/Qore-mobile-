import React,{useState} from 'react';
import {useAdminView,useWebAdminAuth} from './AdminRuntime';

/** Authentication only: no privileged Admin data, JWT, DOB, evidence or
 * payment information is stored or rendered in this component. */
export function AdminAuthPanel(){
 const auth=useWebAdminAuth();
 const {client,view}=useAdminView();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [code,setCode]=useState('');
 const [pendingTotp,setPendingTotp]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function login(){
  if(!auth||busy)return;
  const secret=password;setPassword('');setBusy(true);setMessage('');
  try{
   const result=await auth.signIn(email,secret);
   if(result.code==='MFA_REQUIRED'){
    setPendingTotp(true);setMessage('La contraseña fue aceptada por el proveedor. Ingresá el código TOTP para completar la autenticación. Ningún dato Admin está habilitado todavía.');
    return;
   }
   if(!result.ok){
    setPendingTotp(false);
    setMessage(result.code==='MFA_ENROLLMENT_REQUIRED'?
     'La cuenta requiere un segundo factor TOTP verificado previamente con el proveedor de identidad.':
     'No se pudo validar la identidad o el rol administrativo.');
    return;
   }
   const session=await client.refreshSession();
   setPendingTotp(false);
   setMessage(session.ok?'Identidad y segundo factor verificados. Los datos del servidor continúan sujetos al control del backend.':
    'No se confirmó la sesión administrativa.');
  }catch{setMessage('El servicio de identidad no está disponible.');}
  finally{setBusy(false);}
 }
 async function verify(){
  if(!auth||busy||!/^[0-9]{6}$/.test(code))return;
  const input=code;setCode('');setBusy(true);setMessage('');
  try{
   const result=await auth.verifyTotp(input);
   if(!result.ok){setMessage('Código no aceptado o cuenta sin permisos.');return;}
   const session=await client.refreshSession();
   setPendingTotp(!session.ok);
   setMessage(session.ok?'Segundo factor y rol verificados.':
    'La sesión administrativa sigue sin autorización.');
  }catch{setMessage('No se pudo confirmar el segundo factor.');}
  finally{setBusy(false);}
 }
 async function cancelSecondFactor(){
  if(busy)return;
  setPendingTotp(false);setCode('');setPassword('');
  client.clear();
  setBusy(true);
  try{
   await auth?.signOut();
   setMessage('Segundo factor cancelado y sesión temporal cerrada.');
  }catch{
   setMessage('Acceso administrativo oculto. No se confirmó revocación remota.');
  }finally{setBusy(false);}
 }
 async function logout(){
  if(busy)return;
  setBusy(true);setPassword('');setCode('');setPendingTotp(false);
  const result=await client.logout();
  setMessage(result.ok?'Sesión cerrada.':
   'Datos administrativos ocultos. No se confirmó la revocación remota.');
  setBusy(false);
 }
 return <section className="panel" aria-label="Autenticación administrativa">
  <h2>Acceso administrativo con verificación de dos factores</h2>
  {!auth?<p role="status">Sin proyecto STAGING autorizado. No se aceptan credenciales ni se activa ningún acceso.</p>:
   view.authenticated?<div>
    <p>Sesión {view.account?.role==='owner'?'propietario':'administrativa'} protegida. El servidor debe validar cada operación y el nivel AAL2.</p>
    <button type="button" disabled={busy} onClick={()=>{void logout();}}>
     Cerrar sesión y ocultar datos
    </button>
   </div>:<div className="auth-fields">
    {pendingTotp?<div>
     <label htmlFor="admin-totp">Código del autenticador (6 dígitos)</label>
     <input id="admin-totp" inputMode="numeric" autoComplete="one-time-code"
      type="text" maxLength={6} value={code} disabled={busy}
      onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,'').slice(0,6))}/>
     <button type="button" disabled={busy||code.length!==6}
      onClick={()=>{void verify();}}>Verificar segundo factor</button>
     <button type="button" disabled={busy} onClick={()=>{void cancelSecondFactor();}}>Cancelar MFA y cerrar sesión</button>
    </div>:<div>
     <label htmlFor="admin-login-email">Correo administrativo</label>
     <input id="admin-login-email" type="email" value={email}
      autoComplete="username" disabled={busy} maxLength={254}
      onChange={event=>setEmail(event.target.value)} />
     <label htmlFor="admin-login-password">Contraseña</label>
     <input id="admin-login-password" type="password" value={password}
      autoComplete="current-password" disabled={busy}
      onChange={event=>setPassword(event.target.value)}/>
     <button type="button" disabled={busy||email.trim()===''||password.length===0}
      onClick={()=>{void login();}}>Verificar identidad</button>
    </div>}
    <p className="training-disclaimer">Solo proyecto STAGING autorizado. No se conservan tokens en localStorage ni se confieren permisos de servidor desde el navegador.</p>
   </div>}
  {message!==''&&<p role="status" aria-live="polite">{message}</p>}
 </section>;
}
