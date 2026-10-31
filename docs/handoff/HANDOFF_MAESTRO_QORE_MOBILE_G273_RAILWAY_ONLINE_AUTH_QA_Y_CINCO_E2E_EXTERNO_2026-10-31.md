# HANDOFF MAESTRO G273 — QORE MOBILE / MOVETE FÁCIL
## Arquitecto Ejecutivo Principal · Integrador A+B+C+D · Certificación operativa STAGING
**Corte verificado:** 31 de octubre de 2026. **Única misión:** terminar la app EXISTENTE con código y pruebas reales, conectar los cuatro clientes funcionales al backend, y cerrar **CINCO recorridos E2E externos persistentes**. No producir otro handoff ni maqueta en lugar de ejecutar.

> **DIFERENCIA ESENCIAL**: GitHub/PostgreSQL 16/17 CI validó laboratorios de cinco recorridos, pero **0/5 recorridos en infraestructura STAGING externa** han sido certificados. Railway ahora **sí está ONLINE**. No retroceder a la información antigua de «Railway no desplegado». Tampoco afirmar que ya está lista la app.

---

## 0. Ordenes permanentes del Owner: NO DISCUTIR, CUMPLIR

- Repo oficial y única fuente de código: https://github.com/mezas3238-hue/Qore-mobile- ; rama integradora \`integration/qore-mobile-e2e-four-apps-20261027\`. Siempre recuperar HEAD actual, PRs, migraciones y SHA desplegado antes de tocar nada: hay arquitectos en paralelo.
- **GitHub primero**: commits de código, CI Node/Expo/PostgreSQL y E2E sintéticos; luego migraciones auditadas PG17 STAGING, Railway STAGING y cinco recorridos persistentes con las cuatro aplicaciones.
- **NO merge sin autorización expresa, NO force push, NO borrar trabajo ni sobrescribir commits de otros agentes, NO LIVE/PROD, NO activar pagos reales ni PSP, NO inventar KYC ni aprobación legal de MOTO.** Trabajar en ramas propias y PR DRAFT. Revisar antes de aplicar cambios de infraestructura.
- Prioridad humana reiterada: «terminar ya», «sin cientos de commits que no se conectan», «no más handoffs/prototipos». Cada intervención debe entregar evidencia operativa comprobable.
- Despacho automático por backend para AUTO pasajeros, MOTO pasajeros, envíos AUTO, envíos MOTO y Comercios. **Admin no acepta, busca ni asigna rutinariamente ofertas**; solo aprueba casos excepcionalmente, controla KYC/comercios, reclama/denuncia, finanzas, suspensiones, antifraude y documentos vencidos.
- Cuatro frentes A Backend/infra, B Cliente, C Driver + Comercio independiente, D Admin/Owner + auditoría. Productos de usuario: Cliente, Driver, Comercio y Admin, apoyados por un backend compartido, NO cinco prototipos.
- Objetivo UX QORE Signature: moderno, elegante, versátil, comparable AUTO/MOTO estilo Uber/Bolt sin copiar diseño; Figma existente, no rehacer desde cero. Distribución futura Play Store/App Store, NO APK final.
- Meta arquitectura de alta escala: >1M usuarios, **no certificado** y no probar sobre Hobby STAGING sin límite de costos.

## 1. Tabla de verdad, verificaciones de esta conversación

| Hecho | Resultado auditado |
|---|---|
| Railway STAGING backend canónico | **ONLINE**, 1/1 réplica, última deployment SUCCESS, 0 réplica caída |
| Railway HTTPS | \`GET /_qore/liveness\` 200, \`GET /v1/staging/driver/inbox\` anónimo 401, verificados con proxy y GitHub Actions G270 SUCCESS |
| PostgreSQL Supabase STAGING | PG17 São Paulo, **44/44 tablas públicas RLS**, último inventario sin Auth users |
| Registro Auth público | \`disable_signup=true\` certificado con G259 real provider workflow 41221015071 SUCCESS, tras cambio del Owner en consola |
| Cuentas de ocho actores QA | **0 de 8**, ni sesiones; ninguna operación de alta real autorizada/ejecutada |
| Aprobaciones reales Owner/Admin en backoffice | **0** |
| Viajes, ofertas AUTO, entregas, pedidos Comercios, ledger | **0 filas** en las fuentes verificadas |
| Tarifas AUTO activas de Owner | **0**, por tanto G262 cotización real no se puede completar todavía |
| Supabase G262 ruta/prequote/book | 6/6 RPC instaladas, \`service_role\` permitido, anon/authenticated denegados |
| Supabase G265 tarifa AUTO editable por Owner | RPC instalada, solo servidor, MFA AAL2/G27 requerido, sin tarifa publicada |
| G263 radio Driver por vertical | migración \`20261031173255\` instalada |
| G269 cola despacho G112 + estado pasajero G90 | **NO INSTALADOS**; PR #69 DRAFT, contrato Node verde, falta E2E transaccional/final |
| Comprobación 5 recorridos en laboratorio | Realizada previamente en GitHub QA PG16, **no equivale a STAGING externo** |
| E2E externos de extremo a extremo con mismo identificador | **0/5** |

**Atención a fecha/HEAD:** otros arquitectos modifican #47. SHA HEAD consultado del PR #47: \`66f88779f9ea3fc2783475286bf3398cfbd66596\`; pero **SHA de código realmente desplegado en Railway** \`bd7ac7af4c27b8b3cc4a4d20b6cd25664cac153b\`. NO SUPONER que nuevos PRs #63/#64/#65/#66/#67/#69 están incluidos en deployment, aunque sus SQL existan en la base real. Reconciliar mediante diff/CI, NUNCA merge a ciegas.

## 2. Recursos y enlaces operativos (no secretos)

**GitHub**
- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- Integración: \`integration/qore-mobile-e2e-four-apps-20261027\` (consultar HEAD fresco).
- Backend Railway: [PR #47](https://github.com/mezas3238-hue/Qore-mobile-/pull/47) — rama \`agent/qore-g229-railway-supabase-staging-20261030\`, DRAFT; base distinta de integración.
- Bug arranque PG17 con tablas sin columna id: [PR #68](https://github.com/mezas3238-hue/Qore-mobile-/pull/68), G272. Solucionó \`select('id')\` incorrecto cambiando a HEAD \`select('*').limit(0)\`. NO revertir.
- Auth QA original: [PR #55](https://github.com/mezas3238-hue/Qore-mobile-/pull/55), fix \`sb_secret_*\` de encabezado [PR #58](https://github.com/mezas3238-hue/Qore-mobile-/pull/58), auditor [PR #60](https://github.com/mezas3238-hue/Qore-mobile-/pull/60), sesiones Auth [PR #61](https://github.com/mezas3238-hue/Qore-mobile-/pull/61), y consolidación **más segura** [PR #64](https://github.com/mezas3238-hue/Qore-mobile-/pull/64).
- Read-only backoffice: [PR #62](https://github.com/mezas3238-hue/Qore-mobile-/pull/62); otra implementación G262 nativa Admin ya en #47.
- G262 ruta, cotización y reserva privada: [PR #63](https://github.com/mezas3238-hue/Qore-mobile-/pull/63), PG16/17 SUCCESS, migrado a Supabase STAGING.
- Driver radio de recogida: [PR #65](https://github.com/mezas3238-hue/Qore-mobile-/pull/65), migración PG17 aplicada.
- Tarifa Owner y comisión configurable: [PR #66](https://github.com/mezas3238-hue/Qore-mobile-/pull/66), PostgreSQL16/17 SUCCESS; migración G265 aplicada.
- Puente Owner G265 HTTP backend: [PR #67](https://github.com/mezas3238-hue/Qore-mobile-/pull/67), G268. Prueba HTTP detectó y corrigió 404 allowlist, workflow G268 y Expo SUCCESS; DRAFT, NO desplegado.
- Cola despacho y radio: [PR #69](https://github.com/mezas3238-hue/Qore-mobile-/pull/69), G269; código y un smoke reversible PG17, NO instalado.
- QA recorridos previos: #35–#36 G220/G221; #38–#41 G223–G226; #45 Comercio build; #50 GPS/legal; #51 AUTO ofertas; #52 entregas+ledger; #53 expiración documentos; #54 Comercio RPC; #56 handoff antiguo; revisar estado y dependencias, no reconstruir.
- CI G270 exterior: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41245174515 **SUCCESS** desde runner externo, sin JWT ni escritura.
- CI G269: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41245174449 **SUCCESS** unitario; CI STAGING Node/Expo en mismo SHA ya **SUCCESS** también.
- CI G265 PG16/17: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41229269910, 2/2 SUCCESS.
- CI G263 bootstrap y Admin: workflows ligados al commit \`027a8c5e93ff2c78eb1b671f4322f0bc7711d792\`, cinco SUCCESS.

**Railway**
- Proyecto \`qore-mobile-staging\`: https://railway.com/project/f0afe535-a398-41bf-b8cc-918dcf108667
- Project ID \`f0afe535-a398-41bf-b8cc-918dcf108667\`; environment \`staging\` ID \`19682286-3b2f-40ec-8768-65faeefe6cc8\`.
- **Único servicio canónico** \`qore-mobile-backend-staging\` ID \`c00a1f8a-4b03-4e39-9264-9aad74d0bb10\`.
- HTTPS: https://qore-mobile-backend-staging-staging.up.railway.app; puerto 3000; root \`/apps/mobility-expo\`, start \`node server/run-g4-railway-staging.mjs\`.
- Deployment \`74ef0709-b1f5-4a08-bbfe-f091246225b0\` **SUCCESS** desde 2026-10-31 21:42 UTC, 1 réplica online; logs \`QORE Railway STAGING transport ready; no LIVE or commercial authorization\`. Hubo dos deployments fallidos ANTERIORES (código G256 y esquema id inexistente) pero el activo es sano.
- Última inspección \`staged=null\`, \`pendingWork=[]\`. NO ejecutar \`accept_deploy\` basándose en handoffs viejos que decían «parche destructivo»; revisar estado actual.
- Variables NOMBRES presentes (valores privados NO consultados): \`QORE_STAGING_PROJECT_REF\`, \`QORE_STAGING_PUBLISHABLE_KEY\`, \`QORE_STAGING_SERVICE_ROLE_KEY\`, \`QORE_HISTORY_CURSOR_SIGNING_KEY\`, \`QORE_RAILWAY_STAGING_APPROVED\`, \`QORE_RAILWAY_NO_COMMERCIAL_TRIPS\`, \`LIVE_TRIPS_ENABLED\`, \`QORE_MOBILITY_ENV\`, \`QORE_G247_RECIPIENT_AUTH_APPROVED\`, \`QORE_G252_MERCHANT_INBOX_APPROVED\`, \`QORE_G260_ADMIN_AAL2_APPROVED\`, \`QORE_RAILWAY_HOSTNAME\`, PORT y límites edge. No exponer valores ni asumir que gates especiales están ON.
- No eliminar ni tocar proyecto Railway antiguo \`qore-mobile-gateway\`, que es diferente.

**Supabase**
- Dashboard https://supabase.com/dashboard/project/mrjzxftsdxzepzbcuids
- Ref \`mrjzxftsdxzepzbcuids\`, STAGING PG17. No confundir con proyecto Lovable antiguo.
- Migración G262: \`20261031181701_g262_private_auto_route_quote_book_pg17\`; crea \`mobility_stage_g73_auto_routes\`, \`mobility_stage_g262_auto_prequotes\` y seis RPC G73.
- Migración radio \`20261031173255_g263_driver_pickup_preferences_private_pg17\`; tabla privada \`mobility_stage_g263_pickup_preferences\`.
- Migración Owner \`20261031182524_g265_private_owner_auto_fare_rules_pg17\`.
- Migraciones previas G244–G254 de ofertas, entrega, Comercio, ledger **simulado**, G42, documentos caducados, merchant inbox y Admin; consultar inventario exacto con \`list_migrations\`.
- Security Advisor: **4 avisos INFO, no alertas de severidad superior reportadas**: RLS habilitado sin policy en \`mobility_location_consents\`, \`mobility_stage_g262_auto_prequotes\`, \`mobility_stage_g263_pickup_preferences\` y \`mobility_stage_g73_auto_routes\`; tablas deliberadamente privadas sin acceso directo. No «resolver» añadiendo SELECT público.
- G257 auditó 12/12 RPC de capa básica. G261 auditó 45 referencias de llamadas avanzadas con solo 7 presentes EN AQUEL CORTE. Ese conteo quedó histórico, hoy deben recalcularse las funciones una a una tras migraciones G262/G265; no repetir 38 faltantes como si fuera la cifra actual.
- Prohibido ejecutar en Supabase los archivos \`apps/mobility-expo/docs/backend/staging_only/*POSTGRES_CI_ONLY.sql\`: son exclusivos de PostgreSQL efímero e incluyen datos ficticios/gates de laboratorio.

## 3. Brecha objetiva P0: ocho identidades Auth reales con control de privilegios

**Situación real:** Auth users 0, sesiones 0, roles nativos 0, backoffice Owner/Admin 0, a pesar de G259 \`REAL_PROVIDER_SIGNUP_DISABLED\` en verde.

La identidad QA se genera desde entorno PRIVADO del operador, no con archivos adjuntos al chat:
- Reutilizar [PR #64](https://github.com/mezas3238-hue/Qore-mobile-/pull/64), no el bootstrap inicial #55 sin corregir, porque G27 exige **cero** roles nativos para identidad Owner/Admin.
- Archivo generador \`apps/mobility-expo/scripts/g263-private-qa-manifest.mjs\` produce 8 cuentas independientes \`.invalid\`, contraseñas fuertes, directorio 0700 y \`actors.json\` modo 0600. Se mantiene en máquina segura del operador; nada en repo/Actions/chat.
- G251 bootstrap \`apps/mobility-expo/scripts/qore-staging-qa-identity-bootstrap.mjs\` acepta \`QORE_QA_MANIFEST_FILE\`, \`--apply\`, \`QORE_QA_EXPLICIT_APPLY=CONFIRM_STAGING_ONLY\`, ref STAGING, clave de servicio local. No insertar manualmente \`auth.users\`.
- OCHO slots (roles previstos): \`owner_admin\` (**sin rol nativo, PENDING G27**, nunca Owner automático); \`passenger\` (passenger); \`driver_auto\` (driver); \`driver_moto\` (driver); \`parcel_sender\` (passenger); \`courier_auto\` (driver); \`courier_moto\` (driver); \`merchant_owner\` (passenger, alta merchant staff por separado).
- G254 auditor: **8 cuentas Auth + 7 roles nativos exclusivos = 4 Driver + 3 Passenger; 1 backoffice pending sin rol nativo**. G261 prueba ocho sesiones reales y revocación G42. G263 verifica aprobación G27 independiente ACTIVE con \`approved_by != owner_admin\`, coincidencia RPC y MFA AAL2.
- **IMPEDIMENTO REAL**: proveedor Auth y credenciales de ocho actores NO están disponibles en herramientas de chat como secreto de operador, y la aprobación Owner por otro aprobador legítimo no existe todavía. NO pedir contraseñas/secret key al usuario por chat. El sucesor deberá buscar herramienta conectada autorizada capaz de crear Auth users desde contexto protegido o proponer ejecución local aprobada en dashboard/operador, sin fingir cumplimiento. **Crear Auth users no equivale a aprobar legalmente Driver/MOTO, merchant ni backoffice**.
- Actualizar GH HEAD y traer PR #64/#60/#61 deliberadamente antes de operar; si una creación parcial falla, reconciliar manualmente, nunca autocrear cuentas duplicadas.

## 4. Brecha P0: fuente única del backend y migraciones ya aplicadas desde PRs DRAFT

El servicio Railway actual usa SHA \`bd7ac7af...\`, PR #47 HEAD ahora \`66f88779...\`, mientras G262/G265 SQL vive en PR #63/#66 y el nuevo puente Owner HTTP en PR #67. Debe existir **UN plan de integración SHA por SHA** antes de siguiente deployment:
1. Extraer HEAD actuales de integración, #47, #62/#63/#64/#65/#66/#67/#68/#69 y lista de migraciones de Supabase.
2. Construir dependencia/revisión de todos los PRs, **NO reejecutar CREATE TABLE de migraciones que YA existen**. PRs DRAFT con SQL aplicado todavía no forman necesariamente el tree desplegado.
3. Integrar/portar vía commits incrementales de rama de integración autorizada; comprobar Node 22 + Expo + TS + PostgreSQL 16/17, G4 read-only startup, G42, G27, G262, G263, G265, G269, y 5 recorridos QA.
4. Mantener el parche G272 que solucionó falso fallo de \`select('id')\` para tablas de clave compuesta, y el bloqueo G256 durante start/predeploy.
5. Desplegar únicamente STAGING con SHA fijado, sin accionar por sorpresa despliegues que toquen producción. Validar que hostname/port/rutas/HTTPS correspondan al commit recién fijado.
6. Permitir \`service_role\` solo en backend seguro, sin publicarlo a móviles, CORS universal o frontend. \`sb_secret_*\` modernas van como \`apikey\` y no Bearer con opaque secret; los JWT legacy service role sí llevan Bearer; proteger el rechazo de Auth si abre signup público.

## 5. Brecha P0: ruta AUTO → tarifa Owner → booking → despacho G269

### A) Tarifa y ruta
- El Cliente selecciona \`economico\`/\`confort\`/\`xl\`, origen/destino, solicita ruta HASTA el backend y confirma cotización previa. No inventar kilómetros con haversine ni simular provider. Resolver Geoapify o Maps confiable, cuotas y tráfico si contrato exige \`trafficAware\`; \`fallbackUsed=false\`.
- G262 instalado: RPC \`mobility_stage_g73_route\`, \`route_receipt\`, \`quote\`, \`quote_receipt\`, \`book\`, \`booking_receipt\`; mantiene \`bookingKey\`, \`routeId\`, \`quoteId\`, \`tripId\` vinculados.
- G265 instalado: Owner publica reglas AUTO por zona con sesión G42 real, MFA AAL2 y aprobación G27; base/km/min/mínimo/comisión editable en bps, versión vieja inmutable. **0 tarifas activas**; no emitir tarifa ficticia ni asumir los porcentajes 18% y 10% que se usaron en PG desechable.
- G268 [PR #67] puente HTTP \`POST /v1/staging/owner/auto-fares/{ZONE}\` seguro, integrado al backend G4 solo cuando G260 Admin/Owner AAL2 está habilitado; PR DRAFT, NO demostrado en deployment actual.
- Contrastar API real: backend G73 podría exigir \`trafficAware=true\` y proveedor configurado. PR #47 usa G134 Geoapify/G77 o devuelve 503 sin él; no usar un smoke HTTP 200 como prueba de cotización.

### B) Despacho automático
- G3/G4 oferta base y aceptación existen en PG17: \`mobility_stage_auto_demo_offer\`, \`accept_offer\`, \`decline_offer\`, transición trip y outbox. Estas RPC **no eligen automáticamente al conductor**.
- G111 se llama después del booking y exige RPC \`mobility_stage_g90_passenger_dispatch_status_qa\` y \`mobility_stage_g112_run_booked_auto_dispatch_qa\`. **Ambas estaban ausentes en PG17 al último SQL**. Sin ellas NO existe flujo AUTO externo completo.
- G269 [PR #69] propone cola \`mobility_stage_g269_auto_dispatch_jobs\`, trigger tras booking G262, road proofs, radio RIDE G263, status G90 owner-scoped y G112 worker 12 intentos/5 ofertas/30 s. Código SHA \`b0451ccc...\`, DRAFT, **NO MIGRADO**.
- El G269 real **solo se comprobó en un dry-run BEGIN/ROLLBACK PG17 con las 3 RPC definidas** y un contrato Node de proveedor de distancia en workflow G269. Una segunda auditoría de negativos fue bloqueada por herramientas; no afirmar pruebas SQL positivas completas ni migrar a ciegas. Necesita fixture aislado y tests PG16/17 con Driver elegible real o equivalente no comercial y revisión de locks/duplicados.
- **Riesgo de confianza a cerrar**: una cifra \`_pickup_road_meters\` enviada a SQL no constituye por sí sola prueba de ruta; establecer origen servidor, provider, coordenadas de pickup verificadas, age/TTL, firma/hashes o atestación no falsificable según arquitectura, exact trip/Driver y rechazo de evidencia reciclada. Nunca confiar en metros enviados por app Cliente/Driver. Revalidar legalidad y GPS/consentimiento/radio al OFRECER y al ACEPTAR.
- El reintento global G113 \`mobility_stage_g113_run_due_auto_batch_qa\` también faltaba; el scheduler opcional del runtime NO está activado por defecto. Implementar con backpressure, locks, idempotencia y métricas, sin scan sin scope que ofrezca viajes de otro pasajero.
- Driver tiene ajuste voluntario de radio y OFF por servicio, incluidas recogidas de personas y envíos/comercios. Ver PR #43 y #65. No enviar ofertas a Driver fuera de radio por carretera, ocupado, sin consent GPS o documento vencido.
- Admin solo observa y excepcionalmente resuelve; **jamás pulse «asignar conductor» en el flujo normal**.

## 6. Brecha P0: MOTO, ENVÍOS, COMERCIO y FINANZAS

**MOTO pasajeros**: recuperar módulos G100/G101/G118/G169, verificar cada RPC remota y contrato de permisos MOTO diferente del AUTO. No aceptar vehículo AUTO como licencia MOTO ni simular casco/chaleco/ruta autorizada. Router físico igual carretera, pero distinta elegibilidad, tarifas, seguridad, zona y actos KYC. Cerrar creación→quote→offer→Driver MOTO→estados→Admin/ledger bajo autenticación real.

**Envíos AUTO/MOTO**: recuperar G5/G6/G7, G247 private courier, G248 ledger SIMULATED, G175/G176 custodia, G197...; rutas/dimensiones/peso/capacidad, cotización previa, contrato recibido/aceptación courier, recogida, outbox, entrega, confirmación del destinatario, fraude/expiry e IDs únicos. Diferenciar moto/auto sin excepción de seguros ni mercancías prohibidas.

**Comercio**: PR #45 bundle web independiente, #54 RPC private merchant; merchant_owner QA no equivale a comercio aprobado. Onboarding legítimo → staff/permisos → catálogo/sucursal → orden → confirmar → preparar → listo → courier auto/moto → entrega → ack → Admin ve orderId+deliveryId y ledger. Revisar G252 merchant inbox auth y CORS/domino Railway, no permitir UI sólo \`onrender.com\`; no añadir grants directos a tablas de Comercios.

**Admin/Owner**: G27 backoffice independiente, G42 sesiones reales, G260 MFA AAL2, G264/G267 G27 self-only, scopes Admin/Owner, navegador HTTPS CORS específico, no roles por metadata o claims editables. Solo reclamos/denuncias/aprobaciones/documentos/suspensiones/antifraude/finanzas. Comisiones Owner por servicio, no valores de laboratorio.

**Finanzas**: reserva/aceptación/origen de cotización/ledger atados al mismo ID. Solo \`SIMULATED_CASH\`/\`SIMULATED_CARD\`, montos PYG redondeados/ledger balanceado, settlement QA, idempotencia. No pagos PSP, no cobrar, no prometer reembolsos bancarios. Confirmar que cerrar viaje no inventa transacción real.

## 7. Los CINCO E2E externos obligatorios: definición de «terminado»

Cada recorrido debe comenzar en la **aplicación de Cliente realmente conectada al hostname Railway**, ejecutar transacciones PG17 reales por HTTPS y roles Auth diferentes, no test con objetos sintéticos en memoria. Releer el registro tras reconexión y comparar Admin + ledger con IDENTIFICADORES originales, guardando evidencia de CI/QA segura sin PII, JWT ni claves:

1. **AUTO pasajero:** Cliente cotiza/cuenta autorización → reserva \`tripId\` original → backend busca Driver automáticamente → una oferta privada en Driver AUTO (sin Admin) → Driver acepta → llega → inicia → termina → Admin ve mismo tripId/timeline/ledger simulado.
2. **MOTO pasajero:** idéntico, pero Driver MOTO/vehículo/documentos/permiso legal independiente. Sin KYC real elegible: resultado debe ser bloqueo seguro documentado, NO false 5/5.
3. **Envío AUTO:** Cliente cotiza carga, reserva \`deliveryId\`, courier elegible AUTO acepta, recoge con custodia, entrega con confirmación receptor, Admin audita ID/ledger.
4. **Envío MOTO:** idem con tipo moto, tamaños, pesos y permisos, confirmación destinatario y registro de eventos.
5. **Comercio:** Cliente crea \`orderId\` real, staff Comercio toma/prepara/listo, backend enlaza \`deliveryId\` bajo orden ORIGINAL, courier acepta/entrega, receptor confirma, Admin ve par orderId/deliveryId original y ledger.

Pruebas negativas horizontales: usuario A no ve pedidos de B; Driver sin documentos o radio OFF no recibe oferta; dos Drivers concurrentes no ganan mismo viaje; reintentos de booking/quote/offer no duplican; jamás resucitar viaje cancelado; logout/revocación G42 corta sesiones; 403/401/503 realmente fail-closed; caídas/reinicios preservan outbox y ledger; confirmación destinatario no falsificable.

**Condición de éxito:** 5 IDs de origen, 5 procesos autenticados y persistidos reales, Admin y registro financiero reconciliados en conexión nueva, documentos/vehículo legales y pruebas negativas. No marcar 5/5 si «transición sintética» o «backend online».

## 8. Producto que A+B+C+D deben terminar, no simplemente simular

**Cliente B**: comparación AUTO/MOTO con cotización previa y ETA real; elección servicio y precio; reserva, live tracking e historial; envíos AUTO/MOTO con pesos/medidas/tarifa; Comercios carrito/pedidos/etapas; chat Cliente↔Driver después del viaje para objetos olvidados (autorizado, limitado, antifraude, privacidad y caducidad); calificaciones de Driver/Comercio/Courier, soporte, pedidos/reembolsos QA y manejo desconexiones.

**Driver C**: onboarding y KYC/legal real verificable, multivehículo AUTO/MOTO, licencias/seguros/inspecciones municipales con alertas y suspensión automatizada, consentimiento GPS revocable, OFF por servicio, radio máximo por carretera para pasajeros/comercio/envíos, bandeja ofertas privada y aceptación idempotente, estados llegada/inicio/fin, reparto y custodia, mensajería postviaje, push y recuperación tras pérdida red.

**Comercio C**: portal web separado, roles staff y cuenta comercio legitimada, catálogo/inventario/ventas/etapas preparación, órdenes autenticadas y acotadas, vincular courier/entrega sin cambiar orderId, dashboard histórico, reclamos y ratings.

**Admin/Owner D**: seguridad y cuentas G27+AAL2, tablero operativo de todos los servicios con trazabilidad SAME-ID, quejas/fraude/reputación y aprobaciones excepcionales, scanner automático de documentos caducados (G250–G254) + outbox notificaciones/ack/política de bloqueos, tarifas y comisión editables por Owner, informes ingresos/ledger SIMULATED, logs auditables; **NO búsqueda ni despacho manual cotidiano**.

**A Backend**: integrar transacciones/fanout/backoff, notificaciones push, mensajería, pagos simulados, cancelaciones, GPS, Geoapify/Maps, RLS, roles, temporalidad legal, API pública acotada y colas observables; cada frontend en SHA compatible con backend real.

**Diseño**: Reutilizar Figma QORE Signature conectado (se reportaron 12 colores/5 tipografías, verificar archivo vigente), pantallas y navegación coherentes. Traducir a interfaces operativas; nada de botones inertes ni textos falsos de «conductor asignado».

## 9. Escala, pruebas, despliegue comercial: trabajo posterior pero obligatorio

- Primero cerrar 5/5 STAGING. Después SLO definidos, ensayos de carga en CI aislado, secuencia 64→1k→10k→100k y proyecciones fundamentadas hacia >1M usuarios sin saturar Hobby ni Supabase FREE. Usuarios totales no equivalen a concurrencia; medir RPS/p95/p99, colas, backpressure, pool Postgres, consumo API Maps, memoria, costo y latencia por vertical. No publicar «soporta 1M» sin pruebas y presupuesto.
- Seguridad: pruebas IDOR, Auth JWT y revocación, MFA, scopes Owner/Admin, RLS/definer, cuotas rate limits, no secretos en Expo/Comercio/logs, KYC privacidad, GPS consentimiento, antifraude, pruebas de doble aceptación y carreras, conservación/supresión de historial según política.
- Observabilidad/continuidad: trazas por requestKey/tripId/orderId/deliveryId, métricas, DLQ/outbox, reintentos, reinicio Railway, fallos Maps, alertas 5xx, backup/restauración, rollback GitHub/PG17, reporte de incidentes.
- Antes de LIVE/Play Store/App Store: cumplimiento local de movilidad/seguros/moto/pasajero y mensajería/datos, beta de dispositivos Android+iOS, APNs/FCM, accesibilidad, políticas legales, store assets, PSP legal si se habilita, QA de pasajeros/conductores reales. No distribuir APK como producto final.

## 10. Plan de ejecución del SUCESOR (orden práctico, sin perder semanas)

**FASE 0 (al empezar, pocos pasos, sin cambiar nada):** leer íntegramente ESTE archivo desde GitHub, verificar HEAD de integración y PR #47/#63/#64/#65/#66/#67/#68/#69; consultar \`list_migrations\`, 44 tablas RLS, \`auth.users\`, \`mobility_stage_g269_auto_dispatch_jobs\`, 8 QA, \`describe_service\` Railway SHA live, logs/HTTPS; distinguir aplicado SQL vs fuente desplegada. No abrir un nuevo handoff.

**FASE 1 (P0 inmediato, desbloquear verdadero E2E):**
- Consolidar código QA G263/G251/G254/G261, manifest privado, Auth createUser real en herramienta con entorno protegido; no publicar credenciales. Validar 8 Auth usuarios y sesiones, 7 roles nativos, Admin pendiente G27, MFA y aprobador independiente legítimo.
- Resolver el procedimiento legítimo de aprobación Owner/Driver/Comercio con prueba auditable, sin KYC o documentos ficticios. Si falta una aprobación legal, marcar flujo bloqueado de forma explícita.
- Configurar/verificar provider vial por carretera (Geoapify/Maps) y tarifas Owner aprobadas en PG17 real; obtener una ruta y quote persistida auténtica desde Cliente.
- Endurecer G269: agregar CI transaccional PG16/17 con fixtures separados del remoto, negativos y concurrencia; revisar G90/G112, provider proof, idempotencia, KYC, radio y reintentos G113. **Solo tras suites y revisión de seguridad, aplicar G269 STAGING** y auditar ACL/trigger/RLS. No aplicar scripts \`CI_ONLY\`.
- Reconciliar ramas PR y deployment; actualizar backend STAGING por SHA aprobado. Confirmar POST Cliente→Quote→Book→Dispatch→Driver, con evidencia real y nunca permiso de Admin para asignar.

**FASE 2 (cerrar los cinco recorridos):**
- Completar AUTO; luego MOTO (legal independiente); entregas AUTO/MOTO; Comercio. Para cada uno, app cliente real, conductor/Comercio autenticado, Admin y ledger del mismo ID, sesión independiente, operación HTTPS y fila persistida. No confundir 5/5 de PG CI con 5/5 externo.
- Instrumentar CI E2E externo seguro: secret manager/runner protegido; evidencias solo hashes/IDs QA sin contraseñas; test relectura tras nueva conexión; idempotencia, concurrencia y ACL.

**FASE 3 (producto completo STAGING):** cerrar UX cuatro apps, Driver radio/mensajería/ratings/KYC, Comercios ventas/etapas, Admin automático documentos/Owner comisiones, antifraude/soporte y notificaciones. Unificar builds, navegación y backend desplegado.

**FASE 4 (pre-lanzamiento):** escala medida con presupuesto, observabilidad, legal, privacidad, tienda iOS/Android y posterior propuesta de activación LIVE separada. Sin merge/LIVE sin Owner.

## 11. Cómo reportar resultados al Owner

Por cada avance mostrar: (a) **ruta/commit SHA/PR DRAFT**; (b) CI run ID, tests y estado de TODOS los checks; (c) migración aplicada y SQL read-only de permisos/filas cuando corresponda; (d) si Railway cambió, deployment ID+SHA+health+HTTPS; (e) contador real 0..5 E2E externos, mismo ID y Admin/ledger; (f) bloqueos auténticos sin pedir al usuario secretos en chat. NO respuestas repetitivas «avanzando», NO prometer trabajo en background.

**Instrucción final para el sucesor:** «Actúa como Arquitecto Ejecutivo Principal e Integrador A+B+C+D. Empieza AHORA ejecutando FASE 0 y FASE 1 mediante GitHub, Supabase y Railway conectados; no redactes otro handoff. Respeta los PR DRAFT y trabajos paralelos, prioriza ocho Auth QA, Owner/Driver legítimos, G269+G113 y el primer AUTO externo completo. Después cerrar MOTO, envíos AUTO/MOTO y Comercios hasta 5/5. Nunca confundas laboratorios CI, backend online o migrations instaladas con viajes reales finalizados. No toques LIVE ni mezcles usuarios falsos o PSP».