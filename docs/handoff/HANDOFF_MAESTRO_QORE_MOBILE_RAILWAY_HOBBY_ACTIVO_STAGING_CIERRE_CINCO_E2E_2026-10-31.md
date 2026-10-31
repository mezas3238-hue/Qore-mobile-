# HANDOFF MAESTRO — QORE MOBILE / MOVETE FÁCIL
## Arquitecto Ejecutivo Principal e Integrador A+B+C+D · Corte auditado 31-10-2026

**MISIÓN ÚNICA DEL SUCESOR:** terminar la aplicación en código e infraestructura STAGING, ejecutar cinco recorridos reales de QA Cliente → Backend → Driver/Comercio → Admin → PostgreSQL conservando los identificadores de origen. No sustituir ejecución por nuevos handoffs, promesas, maquetas, simulaciones de respuesta ni cambios cosméticos. No se permite declarar que está funcionando externamente antes de evidencias persistentes por cada recorrido.

**Rigor sobre el estado:** este documento refleja inspección directa de GitHub, Railway y Supabase el 31-10-2026. Hay otros arquitectos editando PR y Supabase en paralelo: consultar HEAD/migrations/patch actuales al empezar; nunca tratar el corte temporal como un candado. No se ha probado ni autorizado transporte comercial o pagos reales.

### 1. Soberanía y reglas irreversibles del Owner

1. Repositorio oficial: https://github.com/mezas3238-hue/Qore-mobile-
2. Rama de integración: \`integration/qore-mobile-e2e-four-apps-20261027\` — HEAD comprobado \`3c823c46928ed4618fe04dcb73d7efb04c079a3f\` (31-10-2026). Refrescar antes de escribir.
3. Todo desarrollo primero GitHub, compilación + PostgreSQL 16 CI y contratos E2E. Después Supabase/Railway STAGING, nunca producción por defecto. **NO FORCE-PUSH, NO MERGE sin orden expresa, NO tocar LIVE/PROD**, preservar progreso ajeno, trabajar con ramas y PR DRAFT.
4. Cuatro frentes existentes: **A Backend/dispatcher/infra**, **B Cliente**, **C Driver y Comercio**, **D Admin Web, auditoría e integrador**. No reescribir servicios existentes ni generar un prototipo.
5. **Despacho totalmente automático.** Cuando Cliente solicita AUTO/MOTO/carga/comercio, backend busca candidatos, cotiza, emite ofertas privadas y coordina rechazo/vencimiento/reintento sin aprobación rutinaria Admin. Admin solo entra en reclamos, denuncias, aprobaciones excepcionales, documentos vencidos, suspensiones y apelaciones.
6. No APK como entrega final: Play Store y App Store después de QA y permisos legales. Estado actual solo pruebas NO LIVE.
7. Propósito de producto: más elegante, seguro, escalable y práctico que Bolt/Uber y apps de pedidos; Figma QORE Signature conectado; UX propia y comparable AUTO/MOTO.
8. Negocio: comisiones % configurables por Owner en Admin, cotización previa, rutas reales, Driver controla por servicio el radio máximo de recogida, mensajería Cliente↔Driver por objetos olvidados, historial, seguimiento, calificaciones, reputación antifraude, Comercio con pedido/preparación/ventas, detección automática de vencimiento de documentos.
9. Mapas: Geoapify/alternativas costo bajo en laboratorios; secretos de mapas previamente referidos en GitHub pero hay que verificar cuota, ruta real y uso. NO exponer llaves de servidor a Cliente. AUTO/MOTO siguen mismas carreteras físicas, políticas de vehículo distintas.
10. Escala futura: 1M+ clientes objetivo de arquitectura, **NO capacidad certificada**. Ni 64 ni 10.000 requests bastan para demostrarla; construir pruebas de carga, observabilidad y consistencia sin exagerar resultados.

### 2. Verdad base: QA GitHub ≠ externo

Cinco recorridos obligatorios, mismo tripId/orderId/deliveryId, request key, Admin y ledger sin inventar registros:
1. AUTO pasajeros: Cliente crea cotización/reserva → dispatcher ofrece → Driver AUTO acepta o declina por canal privado → llegada → inicio → término → Admin ve exactamente el viaje original y finanzas SIMULADAS.
2. MOTO pasajeros: mismo flujo con permisos de MOTO diferenciados; no levantar gate legal G118.
3. Envío AUTO: cotización previa/consentimiento → pickup/custodia → Courier AUTO → destinatario confirma → Admin verifica ID y eventos.
4. Envío MOTO: paquete compatible con MOTO, cotización y confirmación independiente del destinatario.
5. Comercio: Cliente crea orden original → Comercio confirma/prepara/lista → envío vinculado a MISMA orden → Courier recibe/entrega → destinatario confirma → Admin inspecciona orden/entrega/ledger.

**Evidencia CI:** PR #35–#36 (G220/G221) 5/5 escenarios G221 sobre PostgreSQL16 DESECHABLE, con ROLLBACK; PR #38 (G223) preserva 5 fuentes originales y trazabilidad Admin; PR #39 (G224) cierra 2 nuevas reservas AUTO/MOTO vía COMMIT QA desechable; PR #40 (G225) completa 3 fuentes de carga/Comercio bajo COMMIT QA; PR #41 (G226) verifica **3/5 ID históricos antiguos**, pues 2 viajes históricos cancelados **NO** se reactivaron; los 2 pasajeros nuevos del G224 son otros ID. NO confundir poblaciones ni elevar 3/5 históricos a 5/5. PR #42 (G227) antiguo handoff.
**RESULTADO EXTERNO PRESENTE: 0/5** en Supabase STAGING con Railway HTTP + 8 Auth QA + 4 apps conectadas. Aún no se generó prueba de persistencia externa. Los asserts sintéticos/no LIVE no acreditan despacho comercial.

### 3. GitHub — recursos concretos a integrar y revalidar

| Área | PR/archivo | Estado de referencia |
| --- | --- | --- |
| Recorridos G220/G221 | #35, #36 | CI QA PostgreSQL, sin LIVE |
| Persistencia QA/conciliación | #38, #39, #40, #41 | Pruebas de IDs originales, poblaciones distintas |
| Comportamiento Driver OFF por vertical | #43 (G228) | radio por carretera y OFF por servicio; rama precursora del #47 |
| Comercio web independiente | #45 (G230) | código UI/CI; verificar integración real |
| Guardas Railway | #46 | HTTPS/STAGING fail-closed |
| Backend Railway G4 | #47 | PR DRAFT en rama \`agent/qore-g229-railway-supabase-staging-20261030\`, se actualiza concurrentemente |
| Driver GPS/vehículo | #50 (G244) | consentimiento y preflight privados |
| AUTO ofertas | #51 (G246) | 5 RPC privadas; aceptación solo por oferta |
| Entregas + ledger simulado | #52 (G247/G248) | 9 RPC de entrega/finanzas simulado |
| KYC documento caducado | #53 (G247...), cambia de HEAD | outbox/scanner/avisos; revisar estado desplegado |
| Comercios | #54 | 7 RPC públicas SECURITY INVOKER + 7 implementaciones en esquema interno; sin GRANT de escritura directa en tablas |
| Auth QA 8 actores | #55 (G251) | bootstrap de operadores en GitHub; CI 3/3 GREEN; NO ejecutado con usuarios reales |

**ATENCIÓN**: PR #47 tiene base distinta (\`agent/qore-g228-pickup-off-per-vertical-20261030\`), HEAD evoluciona con otros arquitectos y puede diferir de integración. **Railway fue fijado a SHA \`932d3627caff5998cacda932532e81420664f9cc\`**, cuyo conjunto de 6 workflows reportó SUCCESS al prepararse. No asumir que SHA fijado incorpora HEAD más reciente de #47, #53, #55, ni código de #50–#54. NO fusionar a ciegas SQL instaladas en Supabase desde ramas independientes. Primero comparar diffs, dependencia, tests y contratos.

Archivo runtime Railway en PR #47: \`apps/mobility-expo/server/run-g4-railway-staging.mjs\`. Importa \`prepareQoreG4StagingRuntime\` de \`server/g4-staging-runtime.mjs\`, reutiliza el transporte G4 y exige STAGING, NO LIVE, hostname, secretos y aprobación específica. Root Railway \`/apps/mobility-expo\`; start \`node server/run-g4-railway-staging.mjs\`. Compilar el árbol exacto que se pretenda desplegar.

### 4. Railway Hobby — prueba de plataforma real, NO despliegue

**Cuenta Railway activa:** tras el bloqueo de trial expirado, Railway permitió crear un proyecto; el usuario reporta plan de USD5 Hobby activo. No afirmar facturación total/cargo si no se ha auditado.

Proyecto NUEVO separado: \`qore-mobile-staging\`
- ID: \`f0afe535-a398-41bf-b8cc-918dcf108667\`
- Dashboard: https://railway.com/project/f0afe535-a398-41bf-b8cc-918dcf108667
- Solo ambiente \`staging\`: \`19682286-3b2f-40ec-8768-65faeefe6cc8\`
- Servicio **CANÓNICO A MANTENER**: \`qore-mobile-backend-staging\`, ID \`c00a1f8a-4b03-4e39-9264-9aad74d0bb10\`
- Dominio asignado (NO indica servicio levantado): \`qore-mobile-backend-staging-staging.up.railway.app\` — destino \`:3000\`.
- GitHub source STAGED: \`mezas3238-hue/Qore-mobile-\`, rama G229 de PR #47, PIN \`932d3627caff5998cacda932532e81420664f9cc\`; Root \`/apps/mobility-expo\`; Start \`node server/run-g4-railway-staging.mjs\`; builder RAILPACK.
- Proyecto antiguo \`qore-mobile-gateway\` ID \`77a7a359-1045-4e15-8a8b-fb473ffd56dd\` es distinto: **NO TOCAR**.

**Corte de Railway API:** lista de DEPLOYMENTS = vacía; último despliegue canónico = null; NO HTTPS backend funcional ni evidencia tráfico. La configuración existe SOLO como STAGED patch \`20f3ba98-3351-4095-b247-ec1f883d8f6e\`. La auditoría \`get_staged_changes\` detecta \`destructive=true\` porque contiene eliminación del servicio redundante \`qore-mobile-g4-staging-backend-a67e0bde-7c59-4471-bbc2-80cbb5b1ab81\` ID \`57ff062d-72db-4f40-88f7-facd38b3a3ec\`. Ese duplicado se creó y borró sin DEPLOY ni volúmenes en otra sesión, pero su \`staged-delete\` residual sigue presente. **NO ejecutar \`accept_deploy\` sin comparar PATCH/servicios otra vez, consolidar únicamente servicio canónico y aprobar explícitamente la aplicación; no lanzar dos servicios por accidente.** Otros arquitectos editaron el mismo patch.

Variables no sensibles STAGED: \`QORE_MOBILITY_ENV=staging\`, \`LIVE_TRIPS_ENABLED=false\`, \`QORE_RAILWAY_NO_COMMERCIAL_TRIPS=true\`, \`QORE_RAILWAY_STAGING_APPROVED=false\` (NO levantar antes de gates), \`QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids\`, \`QORE_STAGING_PUBLISHABLE_KEY\` pública, \`QORE_RAILWAY_HOSTNAME\` igual al dominio canónico, \`PORT=3000\`, \`QORE_G247_RECIPIENT_AUTH_APPROVED=false\`, \`QORE_G252_MERCHANT_INBOX_APPROVED=false\`; presupuestos edge reads/writes/identidades. Revisar \`RAILWAY_ENVIRONMENT_NAME=staging\` nativo.

**Secretos pendientes** (solo introducir desde entorno protegido Railway/dashboard, NO chat, GH, móviles ni logs): \`QORE_STAGING_SERVICE_ROLE_KEY\` del proyecto Supabase AISLADO, \`QORE_HISTORY_CURSOR_SIGNING_KEY\` alta entropía; revisar otras claves/URL reales exigidas por \`g4-staging-runtime.mjs\`. No usar claves heredadas de producción. Añadir como sealed cuando sea posible.

Siguientes acciones Railway:
1. Ver \`describe_environment\`, \`get_staged_changes\`, \`list_deployments\`, nombre de dominio y variables sin imprimir valores de secretos.
2. Reconciliar patch concurrente/destructivo; prevenir 2 réplicas/servicios innecesarios con Hobby.
3. Corregir runtime/config según SHA exacto; gates Auth y SQL/roles reales.
4. Preparar secretos protegidos, hostname pin, CORS HTTPS y healthcheck **existente y real** (no inventar /health), cuotas y límites de gasto.
5. Solo después de gates + orden Owner, aplicar STAGING y verificar estado SUCCESS, logs sin secretos, endpoint HTTPS y round-trip. No deploy a antiguo proyecto ni producción.

### 5. Supabase STAGING — estado actual real

Proyecto \`qore-mobile-staging\`, ref \`mrjzxftsdxzepzbcuids\`; Dashboard:
https://supabase.com/dashboard/project/mrjzxftsdxzepzbcuids

PostgreSQL 17, región São Paulo. En auditoría 31-10-2026:
- 27 entradas de migración instaladas.
- 41 tablas públicas, **41/41 con RLS**.
- 0 cuentas en \`auth.users\`.
- 0 comercios, 0 órdenes Comercio, 0 entregas, 0 filas de ledger.
- 0 scripts E2E externo realizados.
- Safety advisor: 1 INFO \`rls_enabled_no_policy\` en \`public.mobility_location_consents\`, tabla privada intencional sin policy; no abrir sin evaluación.
- Comercios: siete wrappers \`public.mobility_stage_merchant_*\` \`SECURITY INVOKER\` solo \`service_role\`, siete implementaciones \`SECURITY DEFINER\` en \`qore_stage_internal\` con esquema no accesible a \`anon/authenticated\`. Cero tablas Comercio con escritura directa \`service_role\` (preservar lockdown G244). Ninguna función \`public.mobility_stage_*\` ejecutable por \`anon\` o \`authenticated\` en auditoría.
- G246 AUTO private offers; G247 entrega/courier; G248 quote/payment/ledger **SIMULATED**; G247 session G42; G250–G254 KYC expiraciones/outbox, merchant inbox, admin alert, notification ack. Revisar funciones y su wiring API: tener funciones SQL no significa que las 4 apps funcionen.

Migraciones notables recientes (ejecución directa en STAGING ya registrada):
\`qore_private_driver_consent_preflight_20261031\`;
\`qore_private_auto_request_offer_rpcs_20261031\`;
\`g247_private_courier_offer_lifecycle_20261031\`;
\`g248_simulated_fare_ledger_rpcs_20261031\`;
\`g247_supabase_g42_provider_session_lock\`;
\`g250_private_document_expiry_alert_structure\`;
\`qore_staging_merchant_private_authorized_ops_20261031\`;
\`g251_private_verified_document_source_and_expiry_scanner\`;
\`g252_private_merchant_inbox_provider_session\`;
\`g253_private_admin_document_alert_read\`;
\`g253_merchant_inbox_keyset_covering_indexes\`;
\`g254_private_kyc_notification_claim_and_ack\`.

**NO aplicar** archivos \`apps/mobility-expo/docs/backend/staging_only/*POSTGRES_CI_ONLY.sql\` directamente a STAGING; contienen fixtures/DDL QA, no contratos remotos autorizados. Comparar lo desplegado con funciones de código, usar migraciones aisladas y grants mínimos.

### 6. P0 — Autenticación real QA, bloqueo objetivo más cercano

Hasta el corte no se ha certificado \`disable_signup=true\` en el **nuevo** Supabase \`mrjzxftsdxzepzbcuids\`. La referencia antigua \`hylgkfgkcyrddokloljm\` de Lovable STAGING de octubre NO corresponde al proyecto nuevo: una verificación anterior en otro proyecto jamás habilita este.

Orden obligatorio:
1. Verificar en Auth Providers el ajuste **Disable public signup** en proyecto correcto; inspeccionar realmente \`GET /auth/v1/settings\` con clave PUBLISHABLE segura y exigir \`disable_signup:true\`. Si no está, cerrarlo con intervención autorizada y repetir comprobación. No imprimir claves ni configurar Auth a ciegas.
2. Usar el script nuevo en PR #55: \`apps/mobility-expo/scripts/qore-staging-qa-identity-bootstrap.mjs\`, documentación \`docs/deployment/QORE_SUPABASE_STAGING_EIGHT_QA_ACTORS.md\`. GitHub CI último HEAD \`aeba19e2870ccbf82433fa30d135aa2eff8fa0fd\` 3/3 SUCCESS. **Script NO ejecutado todavía** contra Auth real.
3. OCHO cuentas diferentes, cada una \`.invalid\`, contraseña fuerte independiente y nunca en repositorio/chat:
   \`owner_admin\` (app_role admin QA, no permiso comercial Owner);
   \`passenger\` (passenger);
   \`driver_auto\` (driver);
   \`driver_moto\` (driver);
   \`parcel_sender\` (passenger);
   \`courier_auto\` (driver);
   \`courier_moto\` (driver);
   \`merchant_owner\` (passenger, posteriormente onboarding staff).
4. Solo Auth Admin backend \`createUser\`/REST o panel Supabase. **NUNCA INSERT directo en \`auth.users\`**. Trigger actual \`mobility_staging_handle_signup()\` crea profile y rol passenger por defecto. Validar conversión exacta a único driver/admin solo vía ámbito privilegiado QA y auditoría; no conferir privilegios Owner/seguro falso ni aprobación de vehículo/MOTO.
5. PR #55 bootstrap exige 0 Auth users al inicio, \`--apply\` explícito, gates STAGING, NO LIVE, secreto por entorno privado, aborta sin borrar ni autorreintentar después de fallos parciales. Manejar reintentos por audit manual.
6. Ejecutar QA de JWT independent sessions + RLS/IDOR y checks de perfiles/roles y acceso a otros usuarios. Existe script \`staging-three-actors-readonly.mjs\` **PERO estaba PINNED al proyecto antiguo**: adaptarlo correctamente a nuevo ref sin debilitar gates; preferir actualizar/reutilizar contrato G254 de PR #47 si prueba 8 actores. No usar simple decode JWT sin verificación del servidor.
7. Probar inhabilitación de signup con petición negativa controlada sin crear registros públicos reales. Verificar aislamiento de Storage, ubicación, documentos y roles por cada actor.

### 7. P1 — Compatibilidad transaccional G4 con PG17 real

El backend del PR #47 es una extensión de G4 existente. Verificar función por función que sus repositorios \`g4-supabase-dispatch-repository\`, \`g5-supabase-delivery-repository\`, \`g6-supabase-merchant-repository\`, \`g7-supabase-finance-repository\`, G9/G10/G42 y Admin leen/escriben por **RPC instaladas** y no por grants directos bloqueados. Algunos RPC privados ya están instalados, pero NO todos los módulos avanzados G73/G101/G112/G113/G138–G146/G155/G157/G173/G197–G221 tienen necesariamente equivalentes remotos. Preparar lista llamada→SQL remoto→identidad autorizada→prueba PG17; cualquier llamada inexistente es bloqueo, no simular éxito.

- Mantener \`SECURITY INVOKER\` y grants mínimos en wrappers; \`SECURITY DEFINER\` solo esquema interno protegido cuando realmente necesario.
- Probar conflictos de \`request_key\` repetido, idempotencia, concurrencia 1 ganador, expiración de oferta, locks, CAS, G42 revocación de sesiones.
- Driver KYC real QA: documentos/vehículos aprobados por revisión autorizada según política, nunca inventados; consentimiento GPS explícito revocable, MOTO pasajeros aprobación independiente. Pruebas de negación mientras falta compliance.
- Merchant: onboarding pending → revisión Admin QA autorizada → sucursal/catálogo → pedido → delivery linked, sin dar GRANT universal.
- Finanzas: método SIMULATED_CASH/SIMULATED_CARD solamente, ledger balanceado 3 cuentas; NO PSP ni tarjetas reales.

### 8. P2 — Desplegar 1 SOLO backend STAGING y conectar aplicaciones A+B+C+D

Con CI, Auth, secretos y pg17 readiness en verde:
- Revisar PATCH Railway \`destructive=true\` por duplicado residual; preservar solo servicio canónico. Preparar \`QORE_RAILWAY_STAGING_APPROVED\` según gates; NO \`LIVE_TRIPS_ENABLED=true\`.
- Obtener autorización de despliegue STAGING, ejecutar PATCH/apply una sola vez, vigilar logs/redes/errores 401, 403, 42501, 404 RPC, 5xx, secretos ocultos, TLS y host pin.
- Verificar que 4 frontends **realmente** configuran exclusivamente el dominio staging (sin valor hardcodeado \`onrender.com\`, sin URLs LIVE) y rol correcto; Cliente reserva, Driver responde, Comercio maneja orden, Admin consulta. Admin NO enruta ofertas manualmente.
- Confirmar eventos reales request/response con ID original, no mocks de frontend. Web/Expo builds por SHA real desplegada y tests en dispositivos/hosts QA.
- Despliegue STAGING no certifica automáticamente funcionalidad comercial ni 5 E2E.

### 9. P3 — Cerrar LOS CINCO recorridos persistentes externos

Para cada escenario: confirmar **ID de origen** recibido por Cliente y persistido por Supabase, eventos privados ordenados, oferta real al Driver/Courier con sesión Auth independiente, aceptación única con lock y KYC, avance de estados, proof de destinatario si aplica, Admin consulta del MISMO ID, ledger simulado reconciliado. Releer datos en OTRA conexión sin rollback y guardar evidencia safe-hash y timestamps (sin exponer PII/JWT).

| Recorrido | Cierre QA externo |
| --- | --- |
| AUTO pasajeros | Cotizar, reservar, ofertar automáticamente, aceptar, llegada/inicio/fin, Admin/ledger mismo trip |
| MOTO pasajeros | Lo anterior, con KYC MOTO específico y prohibición comercial respetada |
| Envío AUTO | Quote previa, oferta courier, recogida/custodia, entrega/ACK receptor, Admin mismo delivery |
| Envío MOTO | Lo anterior, validación dimensiones/restricción de artículos y MOTO independiente |
| Comercios | Orden original, staff autenticado, inventario/catálogo, etapas preparar/listo, enlace único a entrega, courier y ACK, Admin ve orderId+deliveryId originales |

Repetir negativos transversales: cliente A no ve ID de cliente B, Driver deshabilitado/OFF/radio fuera de carretera no recibe ofertas, reintentos no duplican, dos candidatos no ganan, expiran correctamente, pasajero cancelado no reaparece, refund/reservas y stock no se desbalancean, documentos vencidos bloquean. Automatizar evidencia GitHub CI contra STAGING solo bajo autorización y sin secretos en logs; limpiar fixtures bajo control sin borrar trazabilidad obligatoria.

**Solo declarar 5/5** si 5 IDs de las solicitudes originales y Admin + ledger coinciden tras persistencia de verdadero backend STAGING.

### 10. P4 — Funciones producto todavía por verificar/cerrar realmente en cuatro apps

**A Backend:** dispatcher autónomo multi-servicio; radio carretera por vertical con OFF real; Geoapify/Google road routing no rutas rectas; capacidad y backpressure; terminalización consistente; costo/comisiones Owner bps y conciliación; antifraude/detección anomalías, riesgo de documento caducado (alertas automáticas y suspensión), logs privacidad y auditoría; chat lost-items posviaje con bloqueo y vencimiento; push/reconexión y caducidad.

**B Cliente:** home elegante con comparación AUTO/MOTO antes del pedido (tipo Bolt/Uber sin copiar), precios/ETA reales, elección vehículo; envíos con categoría/peso/volumen/tarifa previa y confirmación; Comercios catálogo/carrito/preparación, seguimiento de pedido; estado real trip ID; historial/reembolsos y soporte, chat posterior para objetos perdidos, valorar Driver/Comercio/Courier; manejo desconexión/error sin éxito ficticio.

**C Driver:** registro, revisión legal, documentos con alertas vencimiento, vehículos por servicio, ofertas privadas y sesión G42, aceptación única, cambio estados, MOTO separada, preferencia rango máximo por servicios incluyendo OFF, carretera y consent GPS, push/reconexión, chat lost-items, calificación/respuestas. **C Comercio** independiente: personal/roles owner-manager-picker, lista de solicitudes, inventario/precios, confirmar/preparar/listo/entregar, ventas, historial, rechazo/horarios y courier enlazado. Ver PR #45 para bundle independiente.

**D Admin/Owner:** dashboard operaciones multi-servicio, métricas, revenue/fees/ledger simulados, Owner modifica comisiones por servicio con auditoría y validación; aprobaciones excepcionales KYC/vehículo/comercio, vencimientos automáticos, reclamos/denuncias/antifraude, suspender/revocar, ver ID original y cadena. **No** intervención en búsqueda ni aceptación ordinaria. RLS/Admin Auth verdadero; no roles otorgados por metadata editable.

**UX/Figma:** comprobar biblioteca QORE Signature existente conectada (12 colores, 5 tipografías reportados en proyecto), unificar 4 experiencias, accesibilidad, traducción/región Paraguay, pasarelas no activadas. Evitar reescribir UI de cero; probar fidelidad y navegación real.

### 11. P5 — Escalabilidad, observabilidad, seguridad y lanzamiento

**Primero** cinco E2E persistentes y presupuesto controlado. **Luego** laboratorio determinista desde GitHub con métricas p50/p95/p99, throughput, colas, cancelaciones, errores, escrituras/lecturas, conflictos y memoria; escalones 64→1k→10k→100k y perfiles hacia 1M+ usuarios/solicitudes según entorno de prueba realista. **1M usuarios registrados NO equivale a 1M solicitudes concurrentes**: definir SLO, volumen/tiempo y costos antes de afirmar certificado. No someter plan Railway Hobby USD5 ni Supabase Free a 1M de solicitudes reales sin autorización/cota.

Implementar/validar cola durable y DLQ, particionado de trabajo, delivery idempotency, transactional outbox, advisory/row locks, expiración de ofertas, quotas Geoapify, retries/backoff, índices PG17, RLS cost, pool de conexiones, circuit breakers, tracing, alertas y test de fallos de red/cierre servidor y reinicios. Medir y documentar cuellos, no presentar un script que genera 1M loops como infraestructura de 1M.

Antes de **LIVE**: revisión de normas municipales/transporte/seguros, autorización pasajero MOTO, contratos Courier/Comercios, KYC real y privacidad, términos, protección de datos, facturación y pagos PSP verificables, store reviews, notificaciones APNs/FCM, monitoreo/backup/disaster recovery, política incidentes, beta de dispositivos iOS/Android. **No activar** transporte comercial, pagos, importes reales ni publicación Play Store/App Store hasta aprobación Owner.

### 12. Checklist de bloqueo y decisión del siguiente Arquitecto

**GATE P0 (AHORA, ejecutar sin vueltas):**
- [ ] Leer HEAD de integración y ramas/PR #43/#45/#47/#50–#55; revisar cambios desde SHA fijado Railway.
- [ ] Inspeccionar Railway STAGING PATCH y resolver duplicado residual \`destructive=true\`; conservar canónico.
- [ ] Confirmar exactamente variables y secretos STAGING pendientes (sin leer/imprimir valores).
- [ ] Verificar/deshabilitar Auth \`disable_signup\` en el proyecto **mrjzxftsdxzepzbcuids**.
- [ ] Provisionar 8 cuentas QA mediante Auth Admin desde operador seguro; nunca SQL directo.
- [ ] Cerrar aislamiento JWT/RLS, roles exactos y G42, revisar KYC/approval.
- [ ] Inventariar RPC que runtime G4 llama vs SQL PG17 realmente instalado; reparar con PR/CI y migraciones auditadas.

**GATE P1:**
- [ ] Una sola imagen/build/backend G4 en Railway STAGING con commit fijo (no deploy automático).
- [ ] HTTPS responde, Auth real valida/deniega, sin LIVE, sin PSP, logs sin secretos.
- [ ] Cuatro apps apuntan a esta STAGING, respetan CORS/host/gates y roles.
- [ ] Despacho automático y notificaciones privadas, sin Admin cotidiano.

**GATE P2:**
- [ ] Cinco E2E externos cada uno mismo ID original + pruebas negativas y ledger simulado.
- [ ] CI y evidencias persistentes auditables; 5/5 EXTERNO verdadero.
- [ ] Sin leaks, sin corrupción por carreras, sin pagos reales, sin bypass de KYC.
- [ ] Owner revisa demo end-to-end; NO fusionar ni desplegar LIVE por inercia.

**GATE P3:**
- [ ] Comisiones Owner, calificaciones, antifraude, documentos vencidos, radio carretera, chat objetos, UX cuatro apps verificados a través de flujos completos.
- [ ] Stress/soak/1M+ objetivo con pruebas realistas y presupuesto aprobado.
- [ ] Preparación tienda/legales de acuerdo con región y owner, no APK provisional.

### 13. Instrucción de arranque en el siguiente chat

Actuar como **Arquitecto Ejecutivo Principal e Integrador A+B+C+D de QORE Mobile / Movete Fácil**. No redactar otro handoff; este es la fuente de continuidad. Leer íntegro este archivo GitHub y los PR citados; refrescar heads/migraciones/staged patch y ejecutar las tareas P0→P1→P2→P3 con acciones reales en herramientas GitHub, Supabase y Railway. Cada mensaje debe comunicar cambios verificables (ruta+commit+CI, migración+SQL verificación, URL HTTPS+Auth+misma ID), bloqueos reales y siguiente acción técnica, no solo planes o porcentajes sin sustento.

**Prohibiciones:** perder progreso, hacer force-push, merge sin orden, tocar producción/servicios heredados, copiar service-role a cliente, crear usuario directo en auth.users, habilitar signup público, declararse 5/5 externo sin pruebas, usar dinero real/PSP, subir documentos personales inventados o eludir permisos MOTO.

**Estado terminal al corte:** Railway Hobby permite crear proyectos pero backend STAGING no desplegado; Supabase PG17 estructurado con 27 migraciones/41 de 41 RLS y cero usuarios/solicitudes reales; GitHub laboratorios 5/5 en muestras delimitadas; 0/5 externo. La prioridad absoluta es **hacer funcionar el sistema completo bajo QA externo autenticado y persistente.**

Documentación y pruebas ya hechas: PR #47 para Railway; #50–#55 para SQL/Auth. Cualquier cambio nuevo del sucesor debe integrarse por PR sin sobrescribir HEAD de otros arquitectos.

---
Documento de continuidad operacional, no certificación comercial ni autorización de producción.