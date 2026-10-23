# Movete Fácil — Arquitecto A — G21/G22: sesión segura y pantallas de Driver

**Rama:** `feature/mobility-monorepo-isolated-20261016`, PR #7 **DRAFT**. **Proyecto:** QORE Mobile / Movete Fácil (Paraguay).

**Decisión soberana:** existen **dos aplicaciones completamente independientes**, `apps/movete-driver/` para conductores y repartidores y `apps/movete-cliente/` para pasajeros/clientes. Un backend compartido y un Admin web aparte. El Arquitecto B es el único propietario de Cliente/Admin.

**Prohibiciones:** sin merge, sin LIVE, sin VPS, sin pagos reales, sin usuarios reales, sin SQL remoto ni claves privadas en las apps.

## Motivación

G16–G20 estaban implementados en el backend y mediante adaptadores privados de Driver, pero las pantallas `app/documentos.tsx` y `app/ofertas.tsx` aún permanecían como placeholders desconectados. Tampoco existía un único dueño del estado de sesión capaz de invalidar en conjunto ofertas y documentos ante un logout, cambio de cuenta, pérdida de rol o respuesta retrasada de una consulta anterior.

## G21 — Estado compartido, privacidad y pantallas

`apps/movete-driver/src/domain/driver-workspace.mjs` implementa `createDriverWorkspaceController({authAdapter,apiOrigin,request,now,...})`:

- Requiere un adaptador externo de Auth con `getSession()` para cualquier consulta privada; **sin adaptador retorna `not-configured` y no llama a la red**.
- Usa las tres lecturas ya implementadas: `driver-inbox.mjs` (ofertas AUTO y envíos), `driver-documents.mjs` (estado documental sin objetos) y `driver-license-readiness.mjs` (última licencia revisada).
- Una actualización publica los tres resultados de manera atómica. Si uno falla o resulta incompatible, borra las tres vistas: no quedan datos privados parcialmente obsoletos.
- Rechaza roles distintos de `driver`, IDs y JWT de formato inválido, ofertas vencidas, estructuras adulteradas y cualquier promesa de LIVE.
- Protege la secuencia con una generación monotónica: la respuesta de la cuenta anterior **nunca puede sobreescribir** la sesión actual si hubo logout/cambio o un refresh más reciente.
- El token JWT solo vive en el resultado temporal de `getSession()` y en las peticiones HTTPS/HTTP local autorizadas; **nunca aparece en `current()`, eventos de UI, logs ni almacenamiento creado aquí**.
- `invalidate()` borra inmediatamente ofertas, estado documental y licencia antes de reconciliar con Auth.
- No presenta `driverEligible=true`: una licencia revisada es solo una de las condiciones.

`src/DriverWorkspaceProvider.tsx` es el proveedor React compartido que conecta estado y pantallas, se suscribe a cambios de sesión y limpia solicitudes pendientes al desmontarse.

Las pantallas Driver modificadas:
- `app/_layout.tsx`: un único proveedor compartido por todas las pantallas.
- `app/index.tsx`: estado real de autorización (sin configurar, sesión cerrada, cargando, sin conexión, sesión validada) y botón de revalidación únicamente cuando procede. El interruptor de disponibilidad **sigue siendo simulación local**, nunca habilita GPS.
- `app/documentos.tsx`: muestra último estado documental del backend STAGING, licencia revisada y bloqueos. El formulario de nombre/placa permanece **borrador local**, sin enviar PII ni archivos.
- `app/ofertas.tsx`: solo ofertas dirigidas a la sesión verificada, separa AUTO de envíos, actualiza la cuenta regresiva y oculta vencidas. **No habilita aceptar/rechazar viajes o envíos reales**.

## G22 — Puente de Auth verificado y opcional

`apps/movete-driver/src/domain/driver-staging-auth.mjs` implementa `createDriverStagingAuthAdapter({auth,apiOrigin,request,now})`, sin importar un SDK no instalado.

Para activarlo en un STAGING expresamente autorizado:
1. Inyectar un SDK público de Auth configurado con **credenciales publicables solamente**; ningún token/clave de servicio en el bundle.
2. El adaptador consulta `auth.getSession()`; requiere UUID de usuario, bearer válido y vencimiento mayor a 30 segundos.
3. Consulta `auth.getUser(token)` para corroborar la identidad con el servidor del proveedor, no confiar exclusivamente en el usuario almacenado en el dispositivo.
4. Requiere cuenta confirmada y no anónima, misma identidad verificada en ambos pasos.
5. Consulta `GET /v1/staging/driver/license-readiness` contra el servidor aislado, que valida JWT y rol `driver` en su base; no confía en `app_metadata`, parámetro de URL ni toggles del cliente.
6. `onAuthStateChange` avisa de cambios sin enviar sesión ni credenciales al árbol de UI; el proveedor G21 invalida inmediatamente estado anterior.
7. El adaptador devuelve solo el registro necesario para la sesión efímera interna. Los otros componentes reciben únicamente estado saneado.

**ATENCIÓN:** el adaptador STAGING actual solo acepta `http://127.0.0.1:puerto`, exactamente como G16–G20. En dispositivos Android/iOS físicos, `127.0.0.1` es **el teléfono**, no el PC de desarrollo; por eso esta versión es de QA local y no supone conexión real desde celulares. Se necesita un endpoint seguro de STAGING con TLS, certificados válidos y configuración explícita posterior, con revisión de seguridad y autorización Owner, antes de pruebas con teléfonos.

El layout principal **NO instala el adaptador G22 ni inserta credenciales**. Arranca con `authAdapter=null,apiOrigin=null` y muestra `not-configured`. Es intencional: no fingir Auth real ni inventar una cuenta. En una siguiente fase debe crearse un composition root seguro, revisar caché/revocación de tokens del SDK móvil y conectar el proveedor solo después de la aprobación correspondiente.

## Pruebas incorporadas

- `src/domain/driver-workspace.test.mjs`: ausencia de credenciales, fallo cerrado, mutaciones rechazadas, JWT no visible, expiración, logout mientras se consulta, cambio de A a B, respuestas tardías, refresh solapados y ausencia de PII.
- `src/domain/driver-staging-auth.test.mjs`: identidad confirmada, servidor Auth, coincidencia de IDs, vencimiento, rol verificado por backend, cancelación de suscripción, ausencia de tokens en callbacks y rechazo de destinos remotos.
- App aislada: `npm run check` y `expo export --platform web` en CI, **no APK/IPA nativa ni certificación de tienda**.
- No se tocaron carpetas de Cliente ni panel Admin del Arquitecto B.

## Pendientes antes de operación real

1. Conectar la sesión Auth real y almacenamiento seguro de tokens en STAGING autorizado. Los adaptadores actuales se ejecutan únicamente con inyección explícita, no desde el layout por defecto.
2. Elegir y asegurar un endpoint STAGING con TLS y política de identidad independiente; validar CORS, VPN/redes de prueba y revocación en dispositivos. Nunca usar service_role ni un proxy público inseguro.
3. Instalar backend G17–G20 bajo control de cambios en un entorno QA autorizado y comprobar RLS, datos privados sintéticos y carreras bajo múltiples sesiones.
4. Completar G19 con Storage privado, versiones de objeto y escaneo antimalware **reales**. Sin ello no subir documentos.
5. Revisión legal y municipal de vehículos, seguros, restricciones por zonas y pasajeros MOTO.
6. Validar manualmente la interfaz y flujos en Android/iOS, terminar acceso, ofertas y decisiones en STAGING, con autorización de pruebas comerciales posterior.
7. No tocar archivos del Arquitecto B; intercambiar contratos publicados, nunca copiar el código de Cliente dentro de Driver.

**Estado:** G21 y G22 preparan la integración real. No afirman que los usuarios pueden registrarse o realizar viajes hoy.
