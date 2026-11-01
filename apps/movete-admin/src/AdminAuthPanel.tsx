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
 const [setupPending,setSetupPending]=useState(false);
 const [setupSecret,setSetupSecret]=useState('');
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
    setSetupSecret('');
    setSetupPending(result.code==='MFA_ENROLLMENT_REQUIRED');
    setMessage(result.code==='MFA_ENROLLMENT_REQUIRED'?
     'Contraseña verificada. Esta sesión AAL1 únicamente puede configurar el autenticador. No tiene acceso administrativo hasta aprobar MFA AAL2 y el rol G27.':
     'No se pudo validar la identidad o el rol administrativo.');
    return;
   }
   const session=await client.refreshSession();
   setPendingTotp(false);setSetupPending(false);setSetupSecret('');
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
 async function beginSetup(){
  if(!auth||busy||!setupPending||setupSecret!=='')return;
  setBusy(true);setMessage('');
  try{
   const outcome=await auth.beginTotpEnrollment();
   if(outcome.ok&&outcome.secret){
    setSetupSecret(outcome.secret);
    setMessage('Introducí esta clave en tu aplicación autenticadora y después confirmá el código de seis dígitos. La clave no se guarda en el navegador.');
   }else setMessage('No se pudo iniciar la configuración. Cerrá la sesión y comprobá los permisos del proveedor.');
  }catch{setMessage('No se pudo comunicar con el proveedor MFA.');}
  finally{setBusy(false);}
 }
 async function finishSetup(){
  if(!auth||busy||setupSecret===''||!/^[0-9]{6}$/.test(code))return;
  const input=code;setCode('');setBusy(true);setMessage('');
  try{
   const outcome=await auth.verifyEnrolledTotp(input);
   if(outcome.code==='MFA_DENIED'){
    setMessage('El código TOTP no coincide. Comprobá la hora del teléfono y volvé a intentarlo.');
    return;
   }
   // Destroy the displayed factor secret as soon as the enrollment is over.
   setSetupSecret('');setSetupPending(false);
   if(!outcome.ok){
    client.clear();
    setMessage(outcome.code==='BACKOFFICE_ROLE_NOT_APPROVED'?
     'MFA AAL2 configurado. Todavía falta un rol Owner/Admin aprobado en el registro independiente G27; esta sesión se cerró sin acceso.':
     'No se confirmó MFA o el rol. La sesión administrativa permanece cerrada.');
    return;
   }
   const session=await client.refreshSession();
   setMessage(session.ok?'MFA AAL2 y rol administrativo comprobados por el proveedor.':
    'El rol no fue certificado por el backend. No hay acceso privilegiado.');
  }catch{
   setSetupSecret('');setSetupPending(false);
   client.clear();
   setMessage('No se pudo completar MFA. Cerrá la sesión antes de reintentar.');
  }finally{setBusy(false);}
 }
 async function cancelSecondFactor(){
  if(busy)return;
  setPendingTotp(false);setSetupPending(false);setSetupSecret('');setCode('');setPassword('');
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
  setBusy(true);setPassword('');setCode('');setPendingTotp(false);setSetupPending(false);setSetupSecret('');
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
    </div>:setupPending?<div>
     <p>Registro TOTP limitado a STAGING. <strong>Configurar MFA no otorga permisos Owner ni Admin.</strong></p>
     {setupSecret===''?
      <button type="button" disabled={busy} onClick={()=>{void beginSetup();}}>
       Configurar autenticador TOTP
      </button>:<>
       <label htmlFor="admin-setup-secret">Clave de autenticación (privada)</label>
       <input id="admin-setup-secret" type="text" readOnly
        value={setupSecret} autoComplete="off" spellCheck={false}
        onFocus={event=>event.currentTarget.select()}/>
       <p className="training-disclaimer">En Android, abrí Google Authenticator, Microsoft Authenticator u otra app TOTP. Elegí añadir cuenta mediante clave manual e introducí la clave mostrada. No la compartas por chat, foto ni correo.</p>
       <label htmlFor="admin-setup-code">Código de seis dígitos de la aplicación</label>
       <input id="admin-setup-code" inputMode="numeric"
        autoComplete="one-time-code" type="text" maxLength={6}
        value={code} disabled={busy}
        onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,'').slice(0,6))}/>
       <button type="button" disabled={busy||code.length!==6}
        onClick={()=>{void finishSetup();}}>Verificar MFA AAL2</button>
      </>}
     <button type="button" disabled={busy} onClick={()=>{void cancelSecondFactor();}}>
      Cancelar registro y cerrar sesión
     </button>
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
