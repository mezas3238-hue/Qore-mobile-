
# QORE Mobile / Movete Fácil — HANDOFF MAESTRO GLOBAL A+B
## Nuevo chat: terminar las aplicaciones y el primer viaje REAL, sin detenerse salvo bloqueo real
**Corte auditado:** 24 de octubre de 2026, Paraguay (GitHub Actions puede indicar 25/10 UTC). **Producto: NO_GO comercial; 0 viajes y 0 recorridos comerciales completos certificados con dispositivos reales.**

> **ORDEN PRIORITARIA DEL OWNER:** Terminar Movete Fácil en funcionamiento real. NO valorar trabajo por número de commits, archivos o módulos de QA. Entregar funciones completas entre apps, servidor y base duradera. Continuar sin detenerse a menos que exista bloqueo real; si una acción externa está bloqueada por proveedor, permisos, credenciales o autorización, documentar esa dependencia y avanzar inmediatamente en otra tarea segura. NO MERGE / NO LIVE / NO PRODUCCIÓN / NO VPS / NO SQL remoto / NO servicios facturables / NO PSP / NO datos personales reales / NO publicar binarios sin aprobación expresa.

## 0. PUNTOS DE REANUDACIÓN Y ESTADO EXACTO DE GITHUB

Repositorio soberano (incluye guion final): https://github.com/mezas3238-hue/Qore-mobile-

- **Arquitecto A:** PR #7 https://github.com/mezas3238-hue/Qore-mobile-/pull/7, rama feature/mobility-monorepo-isolated-20261016, DRAFT, sin merge. Último HEAD consultado: **420b898603da367c6d47a354db8710f8b92d5bb3**. Sus 4 CI tienen **SUCCESS sobre el mismo SHA**: [Node STAGING](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151364), [PostgreSQL16 desechable](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151378), [Expo aislado](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151384) y [apps separadas](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154151486).
- **Arquitecto B:** PR #8 https://github.com/mezas3238-hue/Qore-mobile-/pull/8, rama feature/mobility-cliente-admin-parallel-20261022, DRAFT, sin merge. Último HEAD consultado antes de publicar este handoff: **552b9a55d13f36bbdf421853437c72d8669a7244**. Sus 3 CI tienen **SUCCESS sobre el mismo SHA**: [Admin Web](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154456771), [Cliente+Driver](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154456787) y [frontera de propiedad A/B](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154456736).
- **Coordinación única:** issue #9 https://github.com/mezas3238-hue/Qore-mobile-/issues/9; última evidencia de integración B: https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6392458295.
- **ATENCIÓN:** este handoff añade un commit documental posterior al SHA B indicado. No atribuirle los 3 PASS del SHA anterior automáticamente. Al entrar en nuevo chat volver a consultar los HEAD/Actions; A y B trabajan en paralelo y avanzan sin aviso. El PR de B usa una revisión de A como base: verificar si está atrasada, pero NO forzar merge/rebase ni sobrescribir cambios sin permiso.

**PRIMERA ORDEN AL NUEVO ARQUITECTO:** abrir los PR y issue #9, inspeccionar servicios STAGING y el camino F1, tomar la primera tarea de implementación funcional P0. NO hacer otro handoff ni inventario de commits en lugar de avanzar.

## 1. CONTRATO DEL PRODUCTO Y QUÉ SIGNIFICA TERMINADO

Movete Fácil es movilidad/logística para Paraguay, con tarifa y comisión calculadas por el servidor en guaraníes (PYG), activación por municipio/zona y aspiración a superar la experiencia de Bolt/Uber. **Dos aplicaciones Expo nativas y totalmente independientes**: Cliente (pasajeros, remitentes, compradores) y Driver (conductores/repartidores). Adicionalmente, **Admin Web** y backend único Node + Supabase Auth + PostgreSQL persistente. Sin mezclar sesiones, navegación ni datos privados.

Servicios autorizados: viajes de personas en AUTO económico/confort/XL; envíos de carga por AUTO o MOTO; restaurantes, supermercados, farmacias de artículos legalmente permitidos y comercios varios. **No hay autorización para pasajeros en moto.** Clientes deben poder comunicarse con Driver/repartidor durante servicio válido. Zona cubierta NO significa Driver disponible. No limitar la plataforma a 50 registros (50 es aceptable como tamaño de página). Documentos KYC centralizados y protegidos por backend, no decisiones en el dispositivo. Lovable solamente interfaz final después de servicios funcionales.

**Objetivo F1 AUTO obligatorio:** Cliente inicia sesión → origen/destino validados por geocerca legal/ruteo independiente → tarifa PYG oficial con versión y vigencia → cliente acepta → reserva persistida con requestKey idempotente y tripId → Driver con documentación vigente recibe oferta → UNA aceptación atómica → posición GPS/ETA basadas en evidencia, chat bidireccional, arriving/in_progress/completed → ledger/importe/comisión → Admin AAL2 consulta mismo tripId/routeId/quoteId/estado. Demostrar reintento por pérdida de ACK, cambios de cuenta, reinicio de móviles, negativa de permisos, carreras de dos Drivers, cancelación y revocación.

**Jerarquía de evidencia sin ambigüedad:** (1) código/contrato, (2) Node/TypeScript/PG16 descartable/export web QA_PASS, (3) STAGING_E2E_PASS sobre MISMO IdP y PostgreSQL real, (4) DEVICE_PASS con Android e iOS físicos, (5) autorización comercial Owner y legal. No llamar terminada a una función que solo tenga UI, contrato o CI.

## 2. FRONTERAS DE PROPIEDAD DE ARQUITECTOS A/B

- **A modifica:** apps/mobility-expo/** backend SQL/Node/OpenAPI/ingress; apps/movete-driver/** nativa Driver; docs/architecture/** y docs/handoff/**; workflows comunes solo coordinados.
- **B modifica:** apps/movete-cliente/**; apps/movete-admin/**; docs/architect-b/**. Este handoff está en carpeta B.
- GitHub issue #9 registra endpoints, migraciones, errores de contrato, bloqueos, SHAs y evidencia para cada arquitecto. Leer, comparar y coordinar SIN editar archivos ajenos. No usar demo apps/mobility-expo/app/conductor.tsx para medir Driver: la app final ya existe en apps/movete-driver.
- No desactivar controles legales G31/G38, KYC, antifraude, independencia de roles o verificación de MFA para hacer “funcionar” una demo. Toda credencial de servicio queda en servidor/gestor de secretos, no Expo, GitHub o navegador.
- Railway **descartado** por decisión Owner; arquitectura objetivo **Render** para Node/HTTPS STAGING y **Supabase** para Auth/PostgreSQL/Storage privada. No implica autorización de despliegue/gastos. Los PR siguen DRAFT.

## 3. HISTORIAL DE TRABAJO YA IMPLEMENTADO (NO REHACER PARA SUMAR COMMITS)

### 3A. Backend / infraestructura A: G0–G66 (contratos y QA, NO operación real)

- **G0–G22:** monorepo/CI/entornos, SQL PostgreSQL/RLS/Auth, roles, Driver+vehículo/licencias/seguros/inspección, viajes AUTO y despacho G3/G4, ofertas y aceptación atómica, envíos particulares/comerciales AUTO/MOTO G5/G10, comercios y catálogo G6, tarifas/ledger/comisiones QA G7, incidentes/SOS y gestión administrativa/comercios G8/G9, outbox/push/polling/disputa y carreras de Courier G10–G15, inbox privado Driver G16, documentos/enrolamiento y elegibilidad G17–G20, fronteras de seguridad G21/G22.
- **G23–G48:** historial privado y paginación keyset sin límite global, roles Admin/Owner/consultas y auditoría G27–G30, cobertura y zona legal G31, GPS consentido y antifraude/telemetría G32–G35, slot único compartido Driver AUTO/DELIVERY G36, fences DML y política legal comercial G37/G38, incidentes/soporte G39–G41, JWT/JWKS pinneado, revocación y MFA G42/G43, sucursales/stock/reserva catálogo G44/G45 y privilegio mínimo/documentos G46–G48.
- **G49–G66:** chat privado vinculado a asignación, Inbox/Send/Read y marcadores verificados G49–G58, idempotencia y recuperación de ACK o COMMIT incierto G59–G60D, 17 gates G61, runtime Driver opt-in G62, offer accept/decline/reconciliación G63/G64, lifecycle AUTO Driver (arriving/in_progress/completed) G65, custodia de entregas (pickup/delivered/return/dispute) G66.
- **G67–G70:** prueba de entrega G67 consumida atómicamente y antifalsificación, lectura privada de custodia G68, delegación SQL de mínimo privilegio G69, GET HTTP local JWT de laboratorio G70. NO prueba de entrega física en calle.
- **G71–G80:** KYC atómico de ocho evidencias + selfie/consentimiento/liveness, lectura privada de vencimientos/bloqueo/renovación, reserva F1 AUTO G72/G73 (route→quote→book→GET con mismo requestKey), seguimiento G74, recibo Admin G75 con MFA externo, Google Routes G77 opcional con TRAFFIC_AWARE/geocerca legal y prueba de peajes, G78 denegación de Driver sin KYC, G79 configuración de provider OFF por defecto, G80 rechazo legal incluso con KYC de fixtures. Ensayos PostgreSQL son desechables y NO certifican Driver real. Un rechazo G36/G38 es éxito de seguridad, NO oferta aceptada.

**Archivos backend A de uso inmediato:**
- apps/mobility-expo/server/g4-staging-runtime.mjs — composición de G73/G75/G4 y controles Auth/PG; providers de ruteo, KYC y MFA NO montados sin confianza externa.
- apps/mobility-expo/server/g73-f1-auto-gateway.mjs; g73-auto-f1-repository.mjs — ruta/quote/booking/idempotencia.
- apps/mobility-expo/server/g75-f1-admin-audit-gateway.mjs; g75-f1-admin-audit-repository.mjs — lectura Admin MFA y misma identidad de viaje.
- apps/mobility-expo/server/g77-f1-google-verified-route-resolver.mjs — proveedor facturable opcional, OFF.
- apps/mobility-expo/docs/backend/staging_only/G71_*, G73_*, G75_*, G78_*, G80_* — **SQL CI ONLY; PROHIBIDO correrlos ciegamente contra remoto**.
- apps/mobility-expo/server/g4-loopback-http-transport.mjs — bind deliberado a 127.0.0.1; NUNCA relajar a 0.0.0.0.
- docs/handoff/HANDOFF_MAESTRO_A_FUNCIONES_CERTIFICADAS_Y_CONTINUIDAD_2026-10-24.md y docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md — historia detallada, auditorías y riesgos.

### 3B. App Driver de A: existe, independiente, pero aún sin runtime operativo real

- El paquete definitivo es apps/movete-driver con login, ofertas, viaje, mensajes, documentos, KYC, ganancias y entregas. **NO se debe crear otra app** ni reutilizar la UI demo del directorio mobility-expo.
- apps/movete-driver/src/DriverApplicationProviders.tsx compone Auth, lectura de inbox/licencia/documentos, expiración KYC, uploads, ofertas, estado/lifecycle, chat y custodia.
- apps/movete-driver/src/domain/driver-staging-runtime.mjs compone adaptadores HTTPS opt-in, autenticación/rol, Driver Inbox, G65 y chat; **app/_layout.tsx no suministra runtime de red autorizado**. Por eso UI/botones aún no prueban ofertas o GPS reales.
- En los cortes recientes se implementó apps/movete-driver/src/domain/native-driver-auth.mjs + test/.d.mts y pantalla index para signIn/signOut remoto preparatorio; Auth getUser y un solo rol Driver RLS, rechazo a Passenger/Admin/Owner/dual, cuenta confirmada, sin service_role.
- apps/movete-driver/src/NativeDriverAuth.ts; apps/movete-driver/src/domain/encrypted-chunk-store.mjs/.d.mts/test: token/sesión nativa exclusivamente Driver en Keychain/Keystore, fragmentado cifrado para sesiones Supabase largas, manifiesto atómico, UUID aleatorio seguro, solo claves válidas para expo-secure-store, sin AsyncStorage fallback; pruebas de logout, rotación, pérdida de fragmento y write failure. Se corrigió defecto real: nombres con dos puntos no válidos para SecureStore y valor >1900.
- **NO probado con cuentas reales STAGING**, sin Driver elegible/validado/aceptando viaje real ni APK/IPA nativos.

### 3C. Render backend STAGING preparatorio de A (no desplegado)

- apps/mobility-expo/server/render-staging-ingress.mjs: ingreso separado del loopback, Render TLS host onrender.com fijado, x-forwarded-proto HTTPS, token Bearer obligatorio por operación, Admin Origin/CORS allowlist, sin cookies, body 2 KiB, reply 32 KiB, tiempo/rate limitado por proceso, respuestas JSON fail-closed.
- apps/mobility-expo/server/run-g4-render-staging.mjs: requiere variables explícitas QORE_RENDER_STAGING_APPROVED, QORE_RENDER_NO_COMMERCIAL_TRIPS, QORE_MOBILITY_ENV=staging, LIVE_TRIPS_ENABLED=false, host y Supabase/IdP/PG. Antes del listener verifica preflight, sin clientes sin secretos válidos.
- apps/mobility-expo/server/render-staging-ingress.test.mjs: intercambio HTTP/TCP real entre gateway de prueba e upstream SIMULADO, rechazo host/proto/CORS/cookie/rate/no JSON; NO ensaya PG real.
- render.yaml (raíz rama A): propuesta Render web Node autoDeployTrigger off, previews off, secrets sync:false, sin PG nuevo; **NO ha desplegado nada**.
- Reparado launcher G4 local para environment=staging en vez de valor antiguo isolated_staging; sigue loopback QA.

### 3D. Cliente B histórico R1–R66 + F1 previo

- apps/movete-cliente: rutas Inicio/Viaje/Envíos/Seguimiento/Historial/Cotización/Pagos/Comercios/Mensajes/Soporte/Cuenta; Editor de ruta, idempotencia UUID y privacidad por sesión, cancelación, recuperación de errores, entrega AUTO/MOTO solo carga, seguimiento y GPS con consentimiento, carrito/catálogos/sustituciones, paginación sin cupo global de 50, soporte/accesibilidad/modo simple.
- B R1–R5 comercio y catálogo; R6–R33 chat privado, mensajes e inbox, TTL/cursores/read markers y recuperación ante ACK; R34–R50 accesibilidad, edición segura de viaje, carrito/comercios, consultas Admin, incidentes; R51–R66 adaptadores HTTPS opt-in, booking/reconciliación, custodia remitente, revisión KYC Admin. NO son entregas comerciales operativas.
- F1 previo B: booking de pasajero propio y snapshot estricto antes de seguimiento; transiciones monotónicas, polling cada 12 s solo con pantalla enfocada, suspensión background, recuperación por historial autenticado tras reinicio, verificación de completed en estado más historial. Todo demostrado con fixtures hasta ahora, NO Driver físico.
- apps/movete-admin: panel Web separado con propietario, auditoría, zonas, incidentes, KYC, finanzas y lectura G75 por tripId preparada; no desplegado ni conectado a datos reales.
- Handoff histórico B completo: docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md (más entregas individuales R1–R66).

### 3E. Cambios reales hechos en esta conversación después de los handoffs históricos

**Cliente Auth nativa:**
- apps/movete-cliente/src/domain/native-passenger-auth.mjs/.d.mts/test — signIn con Supabase, getUser(token) desde IdP, rol exactamente passenger en tabla user_roles RLS, caducidad/confirmación, logout, invalidez si rol duplicado o JWT ajeno.
- apps/movete-cliente/src/NativePassengerAuth.ts — Expo SDK Supabase con host HTTPS ref.supabase.co y SOLO sb_publishable_, Keychain/Keystore; session storage propia Cliente; sin credenciales de servidor.
- apps/movete-cliente/src/domain/encrypted-chunk-store.mjs/.d.mts/test — tokens grandes particionados en SecretStore cifrado, serialización y manifiesto con write-last, rechazo a fragmentos corruptos/expiración/rotación.
- apps/movete-cliente/app/cuenta.tsx — formulario ingreso/cierre de sesión de Passenger con borrado de datos privados al cambiar cuenta.

**Admin Auth con MFA:** 
- apps/movete-admin/src/web-admin-auth.mjs/.d.mts/test y web-admin-config.mjs — Supabase getUser, nivel assurance AAL2 validado por proveedor, factor TOTP verificado, rol único admin u owner RLS, ni password sola ni doble rol dan acceso.
- apps/movete-admin/src/WebAdminClient.ts — JWT solo memoria en navegador, persistSession:false, sin service_role/localStorage.
- apps/movete-admin/src/AdminAuthPanel.tsx, AdminRuntime.tsx y main.tsx — UI login/password + desafío TOTP de seis dígitos, logout, cancelar MFA borra vista local y solicita revocación; montaje del proveedor IdP opt-in. **Admin G75 real sigue deshabilitado** hasta adapter A adminF1Trust y HTTPS remoto.

**Cliente hacia backend F1:**
- apps/movete-cliente/src/domain/f1-staging-connectivity.mjs/.d.mts/test — comprobación real de conexión HTTPS host Render pinneado con GET /_qore/liveness, sin token, PII o ubicación. El éxito demuestra **PROCESS_UP_ONLY**, NO DB, IdP, ruteo, Driver ni viaje.
- apps/movete-cliente/app/cuenta.tsx — botón visible “Comprobar conexión del servidor” solamente cuando hay origen/pin explícitos; no activa reservas.
- apps/movete-cliente/src/domain/f1-authorized-qa-http-options.mjs/.d.mts/test — crea opciones de G73 ÚNICAMENTE con cuatro atestaciones distintas: aprobación Owner STAGING, contrato backend, PG/IdP persistente y ruta/cobertura/peajes reales; mismo origen HTTPS pinneado. Por defecto retorna null, siempre NO LIVE/NO PSP.
- apps/movete-cliente/src/ClientRuntime.tsx — monta authProvider Cliente y, únicamente si hay autorización certificada, autoG73HttpOptions sobre createClientExperience.
- Contrato G73 canónico existente en B: POST /v1/staging/rider/auto/routes → POST /prequote → POST /book (accepted true), GET /bookings/{requestKey}, manteniendo mismo actor/routeId/quoteId/tripId y retry idempotente tras ACK perdido. **No se ha ejecutado contra Render/PG remoto**.
- apps/movete-cliente/.env.example — URLs public STAGING + flags de revisión independientes false por defecto. No subir secretos.

**Todos esos cambios están en PRs DRAFT, con la CI indicada al principio, NO certificados en teléfonos físicos ni servidor externo.**

## 4. BLOQUEO EXTERNO REAL DE INFRAESTRUCTURA — NO INVENTAR QUE ESTÁ RESUELTO

- Render: último diagnóstico documentado en issue #9 identificó workspace “My Workspace” sin servicios o base de datos desplegados/verificables. Blueprint no sustituye despliegue ni PG persistente.
- Supabase: conector accesible, pero lista de proyectos sin proyecto utilizable en la organización consultada. En proyecto Lovable “QORE Mobility STAGING” 9c677bb2-746b-419f-ad9c-dd6d26bab944, metadatos indicaron enabled/supabase, **pero SELECT 1 falló HTTP 400**. Base NO verificada accesible y esquema G73/G75 incierto.
- Son snapshots históricos del issue #9, NO garantía del estado de hoy: **siguiente arquitecto debe reconfirmar** conectores/cuenta/permisos antes de decidir. No crear una segunda DB por inercia, revisar si la base previa es recuperable.
- Para iniciar STAGING real: autorización explícita Owner del proveedor/plan/cargos, URL no secreta, IdP/Supabase y PG duradero, credenciales solo secret manager, migraciones revisadas/backup/rollback, HMAC/JWT/MFA, reglas legales G31/G38; Render HTTPS real y pruebas de disponibilidad/seguridad. No correr scripts SQL que digan CI_ONLY contra producción/STAGING sin revisar.
- Google Routes G77 sigue OFF sin cobertura autorizada, Place IDs verificables, peajes PYG externos, token y autorización de gasto. Liveness no acredita readiness.

## 5. TRABAJOS AÚN NO HECHOS — ORDEN ESTRICTO POR CIERRE FUNCIONAL

### P0.1. A: levantar un STAGING autorizado con la MISMA DB/Auth para las tres superficies
1. Inspeccionar conectores Render y Supabase actuales y recuperar STAGING PG previo si existe; documentar bloqueo concreto si faltan permisos.
2. Con aprobación Owner, crear SOLO STAGING Render/HTTPS + Supabase Auth/PG privado; secrets aislados, roles exclusivos, MFA AAL2 Admin, sesión revocada en DB; backup/restore validado y esquema compatible, despliegue sin LIVE.
3. Auditar ingress Render por headers/proxy TLS, CORS Admin, rate control por múltiples instancias, SSRF, observabilidad sin PII y fallos de red; G4 interno solo 127.0.0.1.
4. Probar realmente JWT y roles del IdP contra POST/GET de G73 y la MISMA PG duradera, lectura tras reinicio; no inventar endpoint que no exista.

### P0.2. A+B: ruta verificada → tarifa vinculante PYG → reserva idempotente
1. **A:** geocerca legal G31, verificadores externos de origin/destination, Google Routes y peajes en PYG solo con permiso de gasto; el proveedor debe acreditar ruta sin fallback/geocodificación facturable previa al control legal.
2. **A:** G73 route, quote, book y GET reconciliación persistidos con quoteId/routeId/tripId/owner/requestKey/revision/currency; previa aceptación de tarifa (NO cotizar después de reservar).
3. **B:** configurar Cliente con URL fija Render y aprobaciones verificadas solo cuando correspondan; hacer viaje de prueba en teléfono Passenger genuino, mostrar monto oficial, aceptación, POST y GET reconciliación tras ACK perdido, token revocado y cuenta ajena denegados. No sustituir respuesta G73 por G4 legado de campos incompatibles.

### P0.3. A: Driver que recibe y acepta la MISMA reserva
1. Montar el runtime ya construido apps/movete-driver/src/domain/driver-staging-runtime.mjs en app/_layout.tsx solo con IDP/host/permiso real. Sin compartir Cliente.
2. Conectar booking G73 → ofertas G3/G4/G63/G64/G65 sobre mismo tripId y PG, sin asumir que un INSERT envía push por sí mismo.
3. Enrolamiento Driver con KYC vigente + geocerca G38 + slot G36; 2 Drivers compiten, solo uno gana; aceptar/rechazar, llegar, iniciar, finalizar. Sin geocerca legal real, asignación NO permitida, mantener bloqueo.
4. Cliente, Driver y Admin deben reconciliar revisions y estados; no inventar Driver/ETA.

### P0.4. A+B: GPS, chat, finalización y recuperación real
1. Permisos GPS/cámara/background en Android e iOS físicos, consentimiento, expiración, exactitud, spoof detection y privacidad. ETA proveniente de ruta verificada y posición autorizada.
2. Conectar chat G49–G60 entre los dos móviles sobre asignación real, push real solo aprobado, SEND/READ idempotentes, bloqueo por revocación y reasignación, no ACK ficticio.
3. Comprobar transitions accepted→arriving→in_progress→completed, cancelación permitida, historial server authoritative y recuperación tras reiniciar/estar sin red; no dar por completado solo por una pantalla.
4. Tarifa/commission/ledger contable por tripId coherentes en base, distinguir saldo QA de cobro PSP real. PSP requiere aprobación independiente.

### P0.5. A+B: Admin real y KYC/expiraciones
1. A montar adminF1Trust: JWT, sesión no revocada y MFA real proveedor AAL2, rol Admin exclusivo G27/G75; configurar CORS host B. Owner no suplanta Admin si endpoint exige rol Admin.
2. B montar f1RideAuditOptions de Admin al mismo STAGING y mostrar tripId, routeId, quoteId, amountGs, currency, revision, status sin datos sensibles filtrados.
3. Driver exige ocho pruebas según vehículo/ley: licencia, cédula frente y dorso, cédula verde, habilitación, seguro, inspección y selfie con consentimiento. Backend decide autenticidad, virus, vigencia, liveness/face match con proveedor autorizado. Las fotos NO aprueban solas.
4. Documento vencido bloquea automáticamente elegibilidad/ofertas, Driver recibe aviso específico y reenvía fotos; nueva prueba invalida documento antiguo, reactivación solo tras comprobación auténtica y decisión auditada. Probar en dos dispositivos y bajo concurrencia.

### P1 tras cerrar F1
- Envíos de carga AUTO y MOTO con recogida/custodia/prueba legítima/entrega, cancelación/soporte/importe/comisión.
- Catálogos vivos, stock y checkout completo supermercados, restaurantes, farmacias OTC permitidas; pagos/reembolsos solo PSP autorizado; no falsificar entregas.
- SOS/emergencia con humanos, políticas de datos/retención/cifrado, monitoreo/on-call, accesibilidad y recuperación, operaciones por zona.
- Compilar y firmar aplicaciones independientes Android APK/AAB e iOS IPA, instalar/testear permisos de GPS/push/cámara/background/offline y recuperación con usuarios sintéticos; tiendas solo con autorización separada Owner.

## 6. MATRIZ DE LANZAMIENTO: 17 GATES + 20 RECORRIDOS, TODOS SIN E2E CERTIFICADO

Fuente oficial de 17 gates: docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json. Estado histórico: NO_GO, 15 BLOCKED + 2 QA_ONLY (Postgres/chat). Fuente de 20 recorridos: docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json; todos BLOCKED por falta de evidencia STAGING/device real.

**17 gates:** IDP_BACKEND_AUTH, HTTPS_BACKEND, POSTGRES_PERSISTENCE, DRIVER_ONBOARDING, DRIVER_LIVE_TRIPS, CLIENT_LIVE_BOOKINGS, PAYMENT_SETTLEMENT, PRIVACY_KYC, EMERGENCY_SAFETY, MAPS_GPS_DEVICE, DELIVERY_MERCHANTS, CHAT_PHYSICAL, ADMIN_OPERATIONS, NATIVE_RELEASES, LEGAL_COMPLIANCE, OPS_24_7_MONITORING, PROD_GO_NOGO.

**20 recorridos:** AUTH_PASSENGER, AUTH_DRIVER_KYC, FARE_QUOTE_GS, AUTO_BOOKING, DRIVER_DISPATCH, GPS_TRACKING, TRIP_COMPLETION_CANCELLATION, MOTO_CARGO_DELIVERY, AUTO_CARGO_DELIVERY, SUPERMARKET_ORDER, PHARMACY_OTC_ORDER, RESTAURANT_ORDER, CUSTOMER_DRIVER_CHAT, PAYMENTS_REFUNDS, COMMISSIONS_PAYOUTS, ADMIN_KYC_ZONES, EMERGENCY_RESPONSE, DATA_PRIVACY, SIGNED_NATIVE_RELEASES, ZONE_ACTIVATION_SUPPORT.

**Evidencia mínima PASS:** SHA/build, servidor/IdP/PG STAGING no secreto, datos sintéticos, actor y sesión revisados, mismo tripId/quoteId/requestKey, estado/revision al persistir y tras reiniciar, carrera 2 Drivers, timeout/retry sin duplicados, GPS/chat/push con Android+iOS físicos, Admin AAL2, cálculo monetario y documentación/rol/consentimiento. Legal, PSP, OPS y GO requieren sus respectivas firmas/pruebas externas. NO marcar PASS solo por CI o liveness.

## 7. REGRESIONES Y ERRORES YA DETECTADOS — NO REINTRODUCIR

- No confundir app Driver existente con demo legada apps/mobility-expo/app/conductor.tsx.
- No usar G4 POST genérico como prueba G73: B requiere owner/requestKey/routeId/quoteId/tripId/revision y serverPersisted.
- Orden económico correcto: ruta → precio PYG server-side → aceptación explícita → reserva; no cotizar sobre un trip creado.
- No inventar route tags a partir de direcciones humanas, ni pagar Google Routes antes del gate legal.
- No inferir oferta aceptada por push, ni disponibilidad por cobertura, ni pago por status completed.
- No reintentar POST mutador con un requestKey nuevo tras ACK incierto: GET owner-scoped y misma key.
- No aprobar Driver por upload sin documentos válidos, ni sortear G36/G38/KYC; bloqueo en QA es control exitoso.
- No usar AsyncStorage para JWT nativo; la sesión de Supabase supera límite de un solo valor. SecureStore debe usar claves válidas (sin dos puntos) y fragmentos cifrados.
- No admitir contraseña sola en Admin: AAL2 + TOTP verificado por IdP y rol exclusivo backend.
- No cambiar localhost-only G4 por escucha pública sin ingress separado.
- No convertir /_qore/liveness PROCESS_UP_ONLY en “PG listo / viaje operativo”.
- No declarar Android/iOS certificados por Expo Web export/TypeScript/Node.
- No fingir STAGING PG recuperado por un metadato enabled=true; SELECT 1 devolvió 400 en última inspección documentada.
- No rebase/merge destructivo en rama B mientras A avanza, ni tocar archivos de otro arquitecto.
- En G80, una denegación G36/G38 es correcta; nunca llamarla aceptación de Driver.
- No introducir servicios que cobren o operaciones comerciales sin aprobación expresa.

## 8. PLAN DE INICIO AUTÓNOMO PARA EL NUEVO ARQUITECTO

**PASO 1 — Inmediato:** comparar HEAD PR #7/#8, último CI de cada SHA y issue #9. Verificar estado Render/Supabase con conectores, sin crear recursos ni introducir secretos. Revisar integración real A G73↔G65 y dónde falta el vínculo de reserva→oferta.

**PASO 2 — Mientras haya bloqueo de infraestructura:** trabajar solo en P0 funcional: A construir integración persistente/atómica booking→oferta con rechazo KYC/legal y tests SQL del MISMO tripId, preparar (NO aplicar) migraciones/IdP MFA; B preparar montaje Admin G75 y estados de Cliente estrictos contra respuesta canónica. Registrar dependencia externa concreta, nunca desbloquear flags con mocks. No seguir creando documentos/etapas como sustituto de la app.

**PASO 3 — STAGING autorizado:** iniciar Node/Render + Supabase real con gestores de secretos y DB durable, verificar restart/backup/IdP/roles/MFA; ruta oficial, booking, Driver, GPS/chat y Admin mismo tripId, con dos teléfonos. No despliegue comercial ni PSP.

**PASO 4 — Certificación:** ensayos de red mala, cambio usuario, JWT revocado, documento vencido, carrera 2 Drivers, rechazo geocerca, reversión/cancelación, conciliación, importe/comisiones, privacidad y logs. Acompañar evidencia real a los 17/20 manifiestos, sin elevar el estado por inferencia.

**PASO 5 — Informe al Owner por FUNCIÓN:** para cada entrega indicar (i) qué puede hacer el usuario, (ii) app exacta, (iii) evidencia/versión y CI E2E reales, (iv) pendiente preciso y bloqueo, (v) GO/NO_GO. Evitar hablar principalmente de commits. Sin pausas salvo bloqueo real: si falta autorización Render o proveedor de mapas, proseguir con otra tarea segura no bloqueada.

## 9. LECTURA HISTÓRICA Y MENSAJE DE ARRANQUE PARA COPIAR

Fuentes exhaustivas:
- docs/handoff/HANDOFF_MAESTRO_A_FUNCIONES_CERTIFICADAS_Y_CONTINUIDAD_2026-10-24.md
- docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md
- docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md
- docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json
- docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json
- GitHub PR #7, PR #8, issue #9 y Actions del último HEAD.

**MENSAJE NUEVO CHAT — COPIAR:**

“Soy el siguiente arquitecto de QORE Mobile / Movete Fácil. Leo el Handoff Maestro Global A+B de docs/architect-b/HANDOFF_MAESTRO_GLOBAL_A_B_F1_OPERATIVO_CONTINUIDAD_2026-10-24.md y los handoffs históricos. Reviso los HEAD/CI actuales de PR #7 y #8 e issue #9. Mi prioridad absoluta es cerrar el primer viaje AUTO íntegro y verificable entre Cliente, Driver, Admin Web y un mismo backend/PostgreSQL persistente, con PYG, GPS, mensajería, finalización y comisión; luego los 17 gates y 20 circuitos. Trabajo funcional y pruebas auténticas, NO volumen de commits. No edito archivos del otro arquitecto ni hago MERGE/LIVE/PROD/deploy/pagos/PII sin aprobación. No vuelvo a pedir respuestas dadas; avanzo sin detenerme salvo bloqueo real, documento solo la dependencia bloqueada y sigo con el siguiente trabajo seguro. Nunca llamo terminada una función demostrada únicamente por mock/CI.”

**ESTADO DE ENTREGA:** Auth Cliente y Driver + Admin MFA, ingress Render y puente HTTP G73 de Cliente están IMPLEMENTADOS y CI PASS. **Sin acceso autorizado a STAGING PG/IdP externo ni móviles físicos comprobados: F1 real sigue NO_GO.** Continuar ejecutando P0 sin nuevas pausas documentales.

## 10. ADDENDUM POST-CORTE: NUEVO HANDOFF A VERIFICADO SIN MODIFICAR FUNCIONES

Después del corte A de la sección 0, **Arquitecto A avanzó un solo commit documental** a **cbb3f39321cdad159a3c9f33014bfed6ffdaebba**, sin modificar código (comparación GitHub 420b898...→cbb3f...: un único archivo agregado). El nuevo documento es:

docs/handoff/HANDOFF_MAESTRO_A_RENDER_SUPABASE_F1_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md

**CI A nuevo SHA: 4/4 SUCCESS:** [Node](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154922468), [PostgreSQL](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154922447), [apps separadas](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154922451), [Expo](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40154922537). Este addendum actualiza el punto de partida A; el codebase funcional es el mismo del corte anterior.

**Conclusión no cambia:** infraestructura/IdP/DB remotos no certificados en dispositivos, **0 viajes E2E reales**, PRs DRAFT y prohibiciones vigentes. El sucesor debe revisar *ambos handoffs* y luego los HEAD/Actions del momento.
