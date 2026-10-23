# QORE MOBILE — MOVETE FÁCIL
# HANDOFF MAESTRO R2 — ARQUITECTO B · CLIENTE MÓVIL + ADMIN WEB
**Fecha:** 23 de octubre de 2026. **Destinatario:** siguiente arquitecto B, nuevo chat/Work. **Mandato del Owner: continuar sin detenerse salvo bloqueo real.**

> DOCUMENTO ACTUALIZADO. El handoff histórico de 545 líneas sigue publicado en `docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md`. Léelo para cronología inicial, contratos y archivos históricos. Este R2 amplía y corrige su fotografía desactualizada; nunca comenzar de cero.

## 1. UBICACIÓN Y ESTADO VERIFICADO

- Repo soberano: https://github.com/mezas3238-hue/Qore-mobile- — NO confundir con trading `qore-core`.
- **Arquitecto B**: `feature/mobility-cliente-admin-parallel-20261022` → [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), **DRAFT / abierto / NO MERGED**. HEAD previo a este documento: `eadc7df73f5e143797dd21575f5e7a7fb110f85f`. Tras publicarlo volver a leer HEAD del PR.
- **Arquitecto A**: `feature/mobility-monorepo-isolated-20261016` → [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), **DRAFT / abierto / NO MERGED**, base main. Último HEAD observado: `6f91fe23ed760aab529e7da4d120032ba735da29`. Cambia constantemente; no asumir fijo.
- La base del PR B es la rama A, no main. A y B no se pisan.
- Coordinación API, bloqueos y evidencias: https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
- OpenAPI fuente de verdad **en rama A**: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, versión observada `1.0.0-g11`, **47 rutas** (verificar de nuevo al continuar).
- Verificado en GitHub para HEAD B citado: [Cliente+Driver/aislamiento #39957767227](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767227) **SUCCESS, Cliente 194/194 PASS, TypeScript y Expo export web PASS, Driver PASS**; [Admin Web #39957767415](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767415) **SUCCESS, 131/131 PASS, TypeScript y Vite build PASS**; [ownership B #39957767253](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767253) SUCCESS. **325 pruebas de Cliente+Admin**, no certificación de producción.
- PR B previo a este handoff: **116 archivos cambiados; 0 fuera de propiedad B**. Este documento suma un archivo. **No se desplegó ni hizo merge.**
- A HEAD `6f91fe23...` en última consulta: PostgreSQL y Node SUCCESS; Expo y aislamiento aún ejecutándose. El G35 `6ec96fc8` anterior tenía 4/4 SUCCESS. Volver a verificar CI A si es relevante; nunca inventar green.

## 2. SEPARACIÓN OBLIGATORIA DE PROPIEDAD

**B SÓLO PUEDE EDITAR:** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. **A EDITA:** `apps/movete-driver/**`, `apps/mobility-expo/**`, backend, SQL, Auth, rutas/API/OpenAPI, paquetes compartidos, `.github/**`, CI, `docs/architecture/**`, `docs/handoff/**`, raíz y despliegues. Comunicación a través del issue #9. No rebase/force-push/merge sin orden.

**Producto aprobado:** dos apps móviles SEPARADAS: Cliente pasajero/remitente/comprador y Driver conductor/repartidor. Admin es **sitio web** independiente, no tercer binario móvil. Servicios Paraguay: AUTO pasajeros, AUTO y MOTO carga, envíos particulares y comerciales (supermercado/restaurante/farmacia OTC). **MOTO pasajeros prohibida** hasta autorización legal/seguros. Activación por zonas; cobertura NO equivale a disponibilidad. Tarifas y comisiones desde servidor en guaraníes, no precios inventados en móvil. 50 registros por página, NUNCA límite global. Datos KYC de Driver centralizados, privados, con RLS/roles; UI solo metadata autorizada. Lovable exclusivamente interfaz final, no backend, Auth, SQL, dispatch ni pagos.

**PROHIBIDO:** MERGE, LIVE, despliegues/VPS, tiendas, pagos PSP, SQL remoto, secretos en front, documentos/PII reales, cambios de cuentas financieras, push real, pruebas con usuarios reales, hasta autorización expresa. CI sintético ≠ STAGING autenticado ≠ producción.

## 3. TRABAJO IMPLEMENTADO: APP CLIENTE (Expo Router/React Native/TypeScript)

1. **App independiente y navegación:** `apps/movete-cliente/app/_layout.tsx`, `index.tsx`, `viaje.tsx`, `envios.tsx`, `comercios.tsx`, `cotizacion.tsx`, `seguimiento.tsx`, `historial.tsx`, `cuenta.tsx`, `pagos.tsx`, `soporte.tsx`. `src/ClientRuntime.tsx` Provider de datos efímeros; conexiones reales **OFF** de fábrica.
2. **Sesion y anti-filtración:** `client-session.mjs` Passenger-only, JWT/revisión/TTL, logout y respuestas tardías. Última corrección P0 en HEAD `eadc7df7`: `privacyRevision` opaco separado de epoch de red; se incrementa en login, logout, relogin misma cuenta, cambio JWT, expiración/revocación, no en refresh idéntico. `client-experience.snapshot().privateViewRevision` expone sólo contador. Formularios `viaje.tsx`, `envios.tsx`, `soporte.tsx` se desmontan/remontan con React `key` para borrar rutas, peso, dimensiones y texto privados **ANTES** de mostrar otra sesión. No persisten tokens/PII.
3. **Preparación local segura de AUTO:** `capabilities.mjs`, `client-request-preparation.mjs`. Valida origen/destino, AUTO y niveles `economico/confort/xl`; genera UUID CSPRNG OS después de validación, construye body exacto `rideRequest`. Pantalla revisar → preparar → descartar borrador listo. **NO envia ni despacha.**
4. **Preparación local de envíos:** `delivery-form.mjs`, `client-request-preparation.mjs`; AUTO/MOTO carga, categorías DOCUMENTS/PARCEL/GROCERIES/RESTAURANT/PHARMACY_OTC, rechazo restringidos/receta, peso MOTO 10kg, AUTO 100kg, dimensiones 1–200cm; no acepta vacío, exponentes, decimales, negativos. UUID seguro, body validado sin precio ni distancia. Pantalla `envios.tsx` bloquea cambios mientras draft preparado.
5. **Comercios y soporte:** `commerce-draft.mjs`, carrito por sucursal, sin stock falso/cobro; `support-draft.mjs` y `soporte.tsx` sólo borrador local, NO denuncia ni SOS real.
6. **Idempotencia del flujo:** `client-mutations.mjs` bloquea doble tap antes de primer await, conserva **MISMA requestKey** en retry explícito, impide crear nueva clave tras timeout o 409/failed hasta conciliar. `client-experience.discardPreparedMutation` sólo elimina `ready` con operación y key iguales; nunca borra en vuelo/retryable/failed/ack.
7. **Triple gate HTTP:** `client-gateway.mjs` exige `enabled`, `contractCertified` y `certifiedOperations`; HTTPS origen fijado, no cookies/referrer/redirect, JWT Passenger con `subject`, `authRevision`, TTL; 401/403 y 200/201 tardíos no contaminan otro login, JSON estricto y tamaño máximo. `rideStatus`, `fareQuote` mediante gateways dedicados; `orderRequest` bloqueada. `201` HTTP NO prueba conductor aceptado ni pago.
8. **Tarifas G24:** `fare-quote-gateway.mjs`, `fare-quote-flow.mjs`, `quote-view.mjs` y `cotizacion.tsx`; POST `/v1/staging/fares/quote` con body exacto `{requestKey,fareMode:'AUTO',subjectKind:'RIDE',subjectId}`; verifica importe PYG entero, `ownerId`, recibo G7, TTL, versión, routing, modo STAGING y `livePaymentsEnabled=false`. No monto/fee/GPS desde UI, no precio anticipado ni pago. **Depende de subjectId ya existente; no hay prequote-before-dispatch certificado.** OFF por defecto.
9. **Seguimiento seguro:** `ride-status-gateway.mjs`, `rider-polling.mjs`, `rider-status.mjs`; GET propio, `revision` autoritativa, Driver/placa AUTO verificados, GPS consentimiento + frescura + ubicación visible y ETA condicionada. Sin mapas falsos, disponibilidad imaginaria ni tracking LIVE.
10. **Cancelación propia:** `ride-cancellation.mjs`, `seguimiento.tsx`: doble confirmación, UUID OS, `POST /v1/staging/rider/trips/{tripId}/cancel` body exacto `{requestKey}`, retry misma key, recibo persistido, 409 conciliación, re-fetch GET antes de declarar `cancelled`, no reembolso inferido. Roundtrip synthetic QA.
11. **Historial ilimitado:** `client-history-gateway.mjs`, `history-feed.mjs`, `history-auto-page.mjs`, `historial.tsx`. Cursor HMAC se envía por cabecera **`X-Qore-History-Cursor`**, no query; primera sin cursor. Lista `FlatList` virtualizada con carga automática al scroll y botón manual, 400 reset, owner-only, keys `kind:serviceId`, sin límite de total; tests 120 páginas y 5000 filas sintéticas.
12. **Tipos/tests/README:** `.d.mts`, suites unitarias y de composición; último HEAD 194/194 Cliente PASS y web Expo export. **No se probó APK/iOS, IAM real ni STAGING HTTP remoto**.

Documentos recientes Cliente en `docs/architect-b/`: `CONTINUIDAD_B_CANCELACION_UX_SEGURA_2026-10-23.md`, `RIDER_STATUS_G11_GATEWAY_QA_2026-10-23.md`, `FARE_QUOTE_G24_CLIENTE_QA_2026-10-23.md`, `IDEMPOTENCY_MUTATIONS_RETRY_GUARD_2026-10-23.md`, `HISTORY_INFINITE_SCROLL_IDENTITY_2026-10-23.md`, `CLIENT_HTTP_OPERATION_CERTIFICATION_STALE_JWT_2026-10-23.md`, `SAFE_LOCAL_RIDE_DELIVERY_PREPARATION_UI_2026-10-23.md`, `CLIENT_FORM_PRIVACY_EPOCH_LOGIN_ROTATION_2026-10-23.md`.

## 4. TRABAJO IMPLEMENTADO: ADMIN WEB (React 19/Vite/TS)

1. `apps/movete-admin/**` web independiente; `AdminRuntime.tsx`, `main.tsx`, `styles.css`; **sin Auth ni API remota activos**.
2. `admin-session.mjs`: Admin/Owner separados, MFA obligatorio y JWT/revisión; cambios de token o caducidad **incluso misma cuenta** limpian KYC, zona, incidentes, auditoría, finanzas y cursores; no restauración de respuesta vieja. Owner no hereda KYC de Admin.
3. `admin-read-gateway.mjs`: GET whitelist A05, origen HTTPS pinned, JWT+MFA, authRevision, bloqueo redirect/cookies/referrer y payload, cursor base64url **44–256** (validación sintáctica, firma se verifica en servidor), HTTP 400 cursor vencido y reset. Desactivado hasta backend STAGING real.
4. `page-cursor.mjs`: navegación Anterior/Siguiente y cursores opacos, sin límite global, un máximo 50 filas POR RESPUESTA. Se corrigieron KYC, zonas, incidentes y audit para rechazar 51. Tests de cientos de páginas.
5. `kyc-queue.mjs`, `kyc-page-view.mjs`: metadata del vehículo/seguro/licencia/inspección, sin fotos/PII; estados vencido, rechazado, ausente, pendiente y reportado válido. `operationalEligibilityConfirmed=false` SIEMPRE: documentos aprobados NO habilitan operación. Filtros/contadores **página visible**; 123 expedientes sintéticos recuperados 50/50/23.
6. `zone-overview.mjs`: cobertura por modo AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY, TTL de recuentos <=60s. Cobertura ≠ disponibilidad. G33 candidatos/contadores privados **NO** son disponibilidad autorizada.
7. `incidents-overview.mjs`: bandeja mínima sin PII ni SOS; test 121 incidentes 50/50/21, sin tope total; sin suspender conductores desde UI.
8. `audit-feed.mjs`: solo lectura de G30 **PARCIAL** (vehículo/incidentes/suspensión). Faltan tarifa, zonas, comisiones, comercios, accesos y operaciones generales; UI lo reconoce, no altera/firma logs.
9. `owner-finance.mjs`: agregado Owner PYG, bruto, fees, payouts/neto inclusive negativo, revisión de ledger/TTL, sin PSP/credenciales bancarias, no afirmar utilidad fiscal.
10. `admin-access.mjs`, `review-draft.mjs`, `admin-experience.mjs` y tests: KYC revisiones como borradores QA, roles y datos privados con fallas cerradas, paginación, sesiones concurrentes. No aprobación/rechazo comercial.
11. Último HEAD: **131/131 tests Admin PASS, TypeScript/Vite build SUCCESS**. Documento `G29_KYC_EVIDENCE_G30_AUDIT_SCOPE_UI_2026-10-23.md`.

## 5. CRONOLOGÍA RESUMIDA DE COMMITS / BUGS SOLUCIONADOS

- Handoff anterior `692ffc88`: base Cliente 131 tests y Admin 109; enumeración cronológica de primeros ~84 archivos en el documento histórico (NO repetirlo).
- `8aa0b04b`, `bb053d7a`, `57e685e5`: UX cancelación, OS UUID, tipos; tests Cliente 138.
- `1ee127f9`, `7e484a17`: status GET propio y roundtrip cancelación→GET; tests 150.
- `90d1f718`, `3fd42826`: tarifa G24 UI y gateway; **bug quote borrada al iniciar tracking mismo trip** reparado manteniendo `subjectId` coincidente; tests 162.
- `492c4989`, `d14362f2`, `97b1b7c9`: requestKey preservada y nuevo draft denegado después de timeout; historial scroll, clave compuesta `kind:serviceId`; tests 168.
- `b4442ebc`, `1820eb75`: Admin JWT rotada same subject, cursor A05; 121 incidentes; Admin 120.
- `e27e6e7b`, `48fb56dd`: 50/page en KYC/zonas/audit; test CI falló por variable sombra en zona y reparado sin quitar tests; Admin 125.
- `74a6d50a`, `b176d904`: clasificación documental KYC y alcance G30 honesto; Admin 131.
- `29dce2f8`, `75c1282e`: HTTP triple gate y JWT race. Primer CI 173/176 por `Date.now()` distinto en cada lectura de fixture y expectativa antigua `rideStatus`; corregido 176/176 sin saltar pruebas.
- Posteriormente: `client-request-preparation`, UI borradores AUTO/envíos y descarte idempotente; ninguna búsqueda comercial.
- HEAD `eadc7df73f5e143797dd21575f5e7a7fb110f85f`: privacidad de formularios al logout/relogin/rotación del MISMO sujeto con `privateViewRevision`; Cliente 194/194 y Admin 131/131, 3/3 CI SUCCESS.

## 6. AVANCES DE ARQUITECTO A — NO CONFUNDIR QA CON PRODUCCIÓN

- G24 contrato de quote servidor `ServerPricedQuoteV1` existe, pero **no contrato prequote sin despacho** y POST viaje/envío aún retorna `Success` genérico, no recibo tipado/comercial.
- G28/G29/G29.1: bandejas/diagnósticos KYC en PostgreSQL 16 descartable y Node loopback, con expiración y verificación por servicio. Nada de PII real.
- G30 auditoría parcial y no global.
- G31/G32: GPS consentimiento, señales aisladas; **no garantías de geocerca/GPS dispositivo real**.
- G33: diagnóstico privado de señales recientes/candidatos con filtros, **no** publicación de disponibilidad ni despacho.
- G34: consentRevision y fencing contra consentimientos revocados en PG descartable.
- G35: elegibilidad documental por **tipo servicio** (AUTO pasajeros vs AUTO/MOTO carga), clearance licencia/seguro/ocupación/consentimiento, privado en QA, **no** habilitación comercial ni sexto endpoint Admin.
- G36 último HEAD: prueba/ajuste de carreras de aceptación de oferta privada G4/G10 sin atajos inseguros a G3/G5. Verificar CI SHA, revisión legal y servidores antes de su uso. Son responsabilidades A.

## 7. PROBLEMAS ABIERTOS — RESPONSABLE Y CIERRE OBLIGATORIO

**P0 — bloquean viajes/envíos/comercialización:**
1. **A:** especificar operación segura de **draft/prequote** JWT-bound, UUID real servidor, TTL, idempotencia, SIN búsqueda antes de confirmar; OpenAPI, pruebas. **B:** solo UI/wizard después del contrato.
2. **A:** recibo `RideRequestReceiptV1` para POST viaje: tripId, ownerId, requestKey, revision, estado persistido y error; 201 genérico no alcanza. Pruebas multiusuario/409.
3. **A:** recibo `DeliveryRequestReceiptV1` y estrategia de cotización MOTO/AUTO carga; seguridad de artículos prohibidos, zona y ocupación; sin envío actual.
4. **A:** IAM real Passenger/Driver/Admin/Owner, JWT, MFA AAL2 session-bound, refresh/revocación, RLS SQL y objetos Storage privados; **B:** integración solo tras certificado.
5. **A:** STAGING HTTPS real autorizado, tokens y permisos de ensayo, red, geocercas legales Paraguay y GPS antifraude/consentimiento real; no añadir secretos a repositorio.
6. **A:** idempotencia server-side y conciliación por requestKey tras timeout/crash/retry; B nunca crear un segundo viaje por ACK ambiguo.
7. **Owner + A:** seguros/habilitación municipal, categorías permitidas, tablas de tarifas PYG/fees por AUTO y MOTO entrega y política de comisiones; pagos solo tras licencia/proveedor adecuado.
8. **A:** despacho y aceptación transaccional con doble reserva/ocupación, expiración push y cambios de conductor; G35/G36 no bastan por sí solos.
9. **A:** KYC por servicio, vigencia de licencias/seguros, documentos centralizados auditados, RLS/Storage; pruebas con sintéticos, nada live.
10. **A/Owner:** definición operativa de atención incidentes/SOS, privacidad, responsabilidades regulatorias y escalamiento.

**P1 — funciones no completas o no certificadas:**
11. **B:** unir wizard Cliente quote→confirmar→despacho→GET status/ETA SOLO al recibir contratos A y autorizaciones STAGING; hacer tests ante 401/403/409/429/503.
12. **B:** interfaz completa envío y comercios (selección comercio/sucursal, stock, carrito, pedido, precio, seguimiento, entrega), sin inventar backend; pruebas de permisos/errores.
13. **B:** unir GET Admin A05 (KYC, zonas, incidentes, audit) + GET Owner finanzas a Auth/MFA HTTPS real tras certificado de A; cursor firmado real, cambio de rol y sesión; no habilitar lectura con flag falso.
14. **A+B:** aprobar/rechazar documentos KYC con RBAC/MFA/audit solo si endpoint real autoriza decisión; B no exponer archivos sin URL efímera autorizada.
15. **A:** ampliar G30 para auditoría de tarifas/comisiones/zonas/comercios/accesos; B solo representar alcance probado.
16. **A+B:** soporte/denuncia y seguridad operacional reales; borrador Cliente no es SOS.
17. **A+B:** finance reconciliada Owner con ledger real, reembolsos, payouts, neto, periodos, fees y control fiscal; no PSP en QA.
18. **B:** E2E Android/iOS Cliente separado de Driver (permisos, offline, deep links, GPS stale, accesibilidad y estado), navegadores Admin (teclado, lector, CSP, sesión/token) — hoy solo export web y test Node.
19. **A+B:** carga/paginación/cursors con 30.000+ expedientes/usuarios en STAGING descartable, pruebas de memoria y consistencia; NO tope global de 50.
20. **A:** seguridad profunda, rate limiting, observabilidad, backups, incident response, geofencing; B únicamente pantallas/contratos sin secretos.

**P2 — lanzamiento pendiente:**
21. Lovable **sólo UI**, paridad Cliente/Driver/Admin según componentes finales y contratos, sin segunda base ni Auth paralela.
22. SDK push/OTP/geocoding/routing/seguros/autorizaciones y consumo real certificados con dueños A/Owner.
23. Android/iOS firmado, Play Store/App Store, términos y privacidad Paraguay, pagos/cobros, observabilidad, autorización Owner de merge/launch.
24. Completar documentación y matriz de smoke tests E2E multirol; firma de gates por Owner antes de cualquier despliegue.

## 8. ROADMAP EXECUTABLE PARA EL SIGUIENTE ARQUITECTO B — SIN DETENERSE

**Primeras acciones al abrir nuevo chat:**
1. Abrir [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) y [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7); leer issues #9 y sus últimas respuestas; confirmar HEAD y último estado CI. Releer OpenAPI A y ambos handoffs; no repetir implementación existente.
2. Comprobar que B solo toca sus tres carpetas. Ejecutar `npm run check` y build/export QA o usar GitHub Actions; no tocar CI de A.
3. **Primera tarea independiente viable:** reforzar tests de renovación/logout/mismo sujeto en *todos* los formularios, navegación y estados Cliente; luego accesibilidad y validación de draft antes de red. Corregir QA hasta verde, publicar commit en rama B y mantener PR DRAFT.
4. **Segunda tarea independiente:** en Admin verificar filtros KYC, 50 por página sin tope global, Owner vs Admin y reconciliación de lectura bajo rotación JWT/MFA, paginación/revisiones; tests adversariales. No construir otro `kyc-page-view` ni gateway historial duplicado.
5. **Tercera tarea:** añadir pruebas de consistencia de draft `ready` vs retryable, entrega restringida, botón desactivado sin precio servidor, no falso despacho tras HTTP 201; usar solo adaptadores opcionales fail closed.
6. Documentar al A mediante issue #9 los cuerpos concretos de draft/prequote, recibo viaje/envío, errores, revision y RLS; A es el único autor de backend. **Mientras A tarda, continuar con otra tarea B.**
7. Al recibir certificación A y permiso de STAGING, conectar gateways opcionales uno por uno: auth propio, quote, request receipt, status, cancel/history; luego Admin 5 GET, siempre pruebas negativo cross-account/403/relogin.
8. Integrar QA en dispositivo Android/iOS y navegador Admin cuando estén disponibles. Un export web no sustituye build nativo.
9. Después de cada incremento verificar tres workflows B, registrar SHA, nuevos tests, fallos y arreglo; actualizar `docs/architect-b/**` e issue #9. **No inventar éxito mientras CI no termine.**

**Comandos orientativos en entorno Node 22.13+:**
`cd apps/movete-cliente && npm install --no-audit --no-fund --ignore-scripts && npm run check && npx expo export --platform web --output-dir dist`
`cd apps/movete-admin && npm install --no-audit --no-fund --ignore-scripts && npm run check && npm run build`.
Nunca mezclar lockfile de Driver/Cliente/Admin.

## 9. GATES DE ACEPTACIÓN

- **B-G1 QA Cliente (logrado en sintéticos):** 194/194 tests, TypeScript/export, flujo local, cancel/history/status/quote opcionales. **Falta:** STAGING/JWT/RLS real, dispatch, pagos, GPS/Push, Android/iOS físicos.
- **B-G2 QA Admin (logrado en sintéticos):** 131/131, Vite/TS, 50 por página, KYC/read-only, Owner roles, auditoría parcial. **Falta:** MFA proveedor, HTTPS APIs, auditoría completa, KYC Storage real, seguridad navegador E2E.
- **B-G3 operativo STAGING (NO logrado):** Auth, endpoints montados, RLS, datos sintéticos, contrato quote-before-dispatch, driver assign, pago simulado/ledger, observabilidad/E2E.
- **B-G4 LIVE comercial (NO autorizado):** validación legal/seguros, tarifas, pagos, tiendas, privacidad, operación nacional, backups, autorización explícita MERGE/LIVE.

## 10. INSTRUCCIÓN LISTA PARA PEGAR EN CHAT NUEVO

> Actúa como **Arquitecto B de QORE Mobile / Movete Fácil** en `mezas3238-hue/Qore-mobile-`. Continúa el PR #8 DRAFT, rama `feature/mobility-cliente-admin-parallel-20261022`, que se basa en PR #7 del Arquitecto A. **No empieces desde cero y NO TE DETENGAS salvo bloqueo real.** Lee primero `docs/architect-b/HANDOFF_MAESTRO_B_R2_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md`, handoff histórico `HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md` y issue #9. Verifica HEAD/CI/contratos OpenAPI actuales. Tu propiedad estricta: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`; A controla Driver, backend, DB, APIs, CI y documentación común. Mantén dos apps móviles independientes, Admin Web aparte. Owner prohíbe MERGE/LIVE/deploy/pagos y PII reales sin orden. Última evidencia antes del handoff: Cliente 194/194, Admin 131/131, 3/3 workflows B SUCCESS (QA, NO STAGING comercial). **Empieza implementando el siguiente incremento seguro dentro de B**, ejecuta tests y CI, corrige hasta verde, publica commits, registra SHA; en caso de API bloqueada solicita contrato a A vía issue #9 y sigue otro módulo sin pausa. No inventes disponibilidad, tarifas, Driver, GPS, pago ni habilitación KYC. Sigue hasta cerrar infra e integración; Lovable será solo UI al final.

**CIERRE: handoff maestro R2 entregado para continuidad real.**
