# Movete Fácil Admin Web — backoffice independiente (Arquitecto B)

React + Vite solo web, sin compartir bundle ni sesión con Cliente ni Driver.

**Acceso:** la pantalla administrativa ofrece login de cuentas ya autorizadas de STAGING con Supabase Auth y TOTP. El proveedor verifica remotamente identidad (getUser), exige nivel de autenticación **aal2**, un único factor TOTP `verified` y un único rol `admin` u `owner` leído bajo RLS. Los roles son exclusivos: Owner no hereda permisos de Admin F1. La contraseña por sí sola no habilita la UI. No admite `service_role`, `sb_secret_*`, HTTP, credenciales embebidas ni proyectos ajenos a Supabase. Autenticación de Admin opera **solo en memoria de la pestaña** (`persistSession:false`): al cerrar/recargar se requiere nueva sesión; sin localStorage de tokens. Se desconecta ante logout, expiración o autorización fallida.

La autenticación del navegador **NO constituye autorización del servidor**: cada lectura G75 debe validar por separado JWT, sesión no revocada, exclusividad del rol de Admin, proveedor MFA AAL2, RLS y propiedad del viaje.

**Todavía no es un Admin operativo conectado:** por defecto `AdminRuntimeProvider` NO monta G75 ni ninguna API; backend HTTPS persistente de A/IdP y cuentas de STAGING no están autorizadas ni probadas en el presente corte. Los indicadores permanecen `Sin conexión`, no se aprueban KYC ni se ejecuta despacho o cobros. Inicio de sesión implementado con prueba automatizada, NO se verificó todavía con un usuario real del IdP.

`npm install && npm run check && npm run build` valida TypeScript, tests e interfaz exportada **solo local/QA**, sin deploy. Variables públicas de `.env.example` solo con STAGING autorizado; nunca compartir credenciales en Git.

PR #8 DRAFT · no merge/live/producción · coordinación funcional con A en issue #9.
