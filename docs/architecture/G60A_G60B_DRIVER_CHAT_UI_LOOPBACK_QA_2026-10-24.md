# QORE Mobile — G60A/G60B — Driver chat UI + localhost SEND/reconcile QA
**Arquitecto A · 24 octubre 2026 · PR #7 DRAFT · Solo entorno local, NO LIVE, NO deploy, NO merge.**

## Estado y alcance
Las etapas G59/G59B demostraron reconciliación PostgreSQL de ACK original por `requestKey`, rol/sesión G42, revisión inmutable y cierre de permisos. G60A monta ahora el recorrido **UI Driver** sobre contratos autenticados inyectables; G60B implementa **transporte local loopback de SEND + RECONCILE** para ensayos de contratos sin abrir puertos remotos. Nada está conectado a un proveedor Auth remoto de producción ni a un smartphone físico. En la composición normal `app/_layout.tsx`, `DriverMessagesProvider` no recibe adapters y su pantalla queda explícitamente bloqueada; no se simulan mensajes ni se habilita LIVE.

## Cambios en la aplicación Driver (propiedad exclusiva A)
- `apps/movete-driver/src/domain/driver-messaging.mjs` + `.d.mts`: controlador Driver privado QA que compone el G56C inbox paginado existente con G57B historial protegido y ACK de lectura por mensaje visible, G56 send y G59B reconcile. `Bearer`, identidad, cursor firmado, marker, `requestKey` y texto pendiente no aparecen en los snapshots serializables ni en los componentes de pantalla.
- `src/DriverMessagesProvider.tsx`: suscribe cambios de Auth; borra inmediatamente la información privada anterior en cambio de sesión, logout o desmontaje. Una consulta de sesión anterior que responde tarde no puede restaurar datos de otro usuario (epoch guard).
- `app/mensajes.tsx`: bandeja, páginas posteriores sin límite global, lectura de conversación paginada, campo de texto accesible, estados `sending / uncertain / confirmed / blocked`, consulta manual del ACK y acción de confirmación de lectura manual por mensaje. **Cargar/mostrar mensajes no emite un ACK de leído.**
- `app/_layout.tsx`: aplicación Driver, no la de Cliente, aloja el provider de mensajería separado y desactivado por defecto.
- Conductor en movimiento: `sendMessage` exige una atestación fresca `vehicleStopped:true, source:'trusted_navigation'` emitida por adaptador confiable. Si falla, no llama al transport de envío; el toggle UI nunca habilita escribir por sí mismo.
- POST incierto: conserva internamente la clave y cuerpo exactos; **no repite SEND automáticamente**, solo permite solicitar reconciliación de `G59B`. Un ACK `COMMITTED` se acepta únicamente al coincidir identidad del hilo, servicio, clave, cuerpo, revisión y `serverStored:true`. Una respuesta corrupta o 503 no hace creer que hubo rollback.
- Un cierre de sesión durante generación asíncrona de `requestKey` o HTTP invalida las operaciones por `epoch`. El proveedor/módulo no expone claves para recuperar conversaciones anteriores.
- `driver-messaging.test.mjs`: tests de datos filtrados, in-flight logout, páginas, mensajes, server receipts, bloqueo de conducción, lectura explícita, snapshots sin JWT ni marcadores.

## Backend G60B — prueba local sin infraestructura pública
- `apps/mobility-expo/server/g60b-driver-write-loopback-qa.mjs`: módulo **independiente** de G58, solo constructor QA explícito, `listen()` exclusivo a `127.0.0.1`, límites de tamaño/headers/concurrencia, rechazo de navegador/Origin/Cookie/host remoto.
- Dos rutas POST localhost con `serviceKind`, `serviceId` y `conversationId` en URL y un body **exacto** `{requestKey,body}`:
  - `/v1/staging/driver/chat/services/{kind}/{serviceId}/conversations/{conversationId}/send`
  - `/v1/staging/driver/chat/services/{kind}/{serviceId}/conversations/{conversationId}/reconcile`
  Estas rutas **NO** están montadas en servidor remoto ni constituyen una API HTTPS disponible para la app. El transporte recibe solo Bearer y campos acotados; no acepta `actorId`, `role`, `sessionId`, `iat`, secuencia o secretos aportados por usuario.
- Para SEND el servidor requiere un callback `verifyStopped` confiable e independiente **antes** de llamar al handler de envío; no confía en un toggle del teléfono. El callback debe estar respaldado por Auth/telemetría verificadas y aún es sintético en CI.
- Los handlers `driverSendHandler` y `driverReconcileHandler` son obligatorios y autenticados por inyección, sin emisor SQL-owner público. El transporte inspecciona estructura y contenido de un ACK G56 y un recibo G59B. La revisión original no se reemplaza con `latestRevision`.
- Timeout de 2400ms: responde `503 G60B_OUTCOME_UNKNOWN` con `retrySafe:false` y nunca `serverStored:true` deducido. No se reintenta automáticamente, no se confunde timeout con rollback.
- `g60b-driver-write-loopback-qa.test.mjs`: adversarios HTTP de PII, URL malformada, identidades/roles forjados, stopped provider falso, ACK no autoritativo, historial G52 más nuevo y resultado incierto. G58 sigue sin modificar.

## Matriz de seguridad y evidencia exigida
1. `npm run check` de **movete-driver** — Node domain, TSC y export Expo web aislados.
2. `node --test *.test.mjs` de **mobility-expo/server** — G60B y toda regresión de G42–G59B.
3. PostgreSQL16 chain disposable — g59/g59b sigue aprobado, sin alterar grants ni SQL.
4. `movete-apps-isolation` — Cliente/Driver siguen siendo binarios y raíces de código independientes, sin editar B.
5. Confirmar 4/4 **mismo SHA**. Un success de commit anterior no certifica el documental más reciente.

## Para Arquitecto B — coordinación issue #9
B conserva exclusivamente `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. B no debe asumir que los endpoints localhost existen como servicio real. Para producto en calle: Auth Passenger/Driver real con revocación y MFA de backoffice; permisos exactos por servicio y asignación; API HTTPS STAGING bajo contrato OpenAPI; push que no envíe texto privado; viewport físico y confirmación de leído estrictamente tras visualización; Android/iOS E2E; seguridad vial del composer en conducción. El Arquitecto A publicará contratos tipados antes de que B conecte su interfaz definitiva.

## Próximos gates recomendados
- **G60C:** coordinación de `GET/POST` sobre un gateway HTTPS STAGING autorizado, JWT real pinneado, pooling SQL de privilegios mínimos; si no existen credenciales/aprobación, seguir fortaleciendo contratos locales.
- **G61+:** GPS/zonas/dispatch/tarifas reales, KYC cifrado, comercios, operador SOS, pagos solo con autorización, pruebas de operación por municipios y GO/NO-GO.
- **No** merge, LIVE, secretos, VPS, SQL remoto, PSP, datos personales auténticos ni distribución de APK/IPA sin orden Owner.

QA no equivale a disponibilidad comercial; el Driver no tiene un canal operativo de mensajería con pasajeros reales todavía.
