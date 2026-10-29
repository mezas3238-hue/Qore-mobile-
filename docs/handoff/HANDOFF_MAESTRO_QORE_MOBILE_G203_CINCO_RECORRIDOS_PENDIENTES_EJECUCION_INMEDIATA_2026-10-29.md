# HANDOFF MAESTRO — QORE MOBILE / MOVETE FÁCIL
## Arquitecto Ejecutivo Integrador A+B+C+D · Cinco recorridos reales · Ejecución inmediata
### Corte: 29 de octubre de 2026 · Transición a nuevo chat SIN pérdida de contexto

> **ORDEN DEL OWNER:** Terminar ya la aplicación en GitHub. Este documento sirve ÚNICAMENTE para continuar en otro chat. El siguiente arquitecto debe IMPLEMENTAR EN CÓDIGO los eslabones pendientes de los cinco recorridos; no escribir otro handoff, ni repetir pruebas aisladas, ni llamar “app terminada” a cinco filas en Admin. No inventar conductores legales, GPS, identidad, destinatarios, pagos, entregas o certificaciones. GitHub primero; no merge, LIVE, Render, Supabase ni PSP externo sin autorización explícita del Owner.

## 0. Estado soberano VERIFICADO a este corte

| Dato | Valor |
|---|---|
| Repositorio oficial | https://github.com/mezas3238-hue/Qore-mobile- |
| Rama operativa A+B+C+D | `integration/qore-mobile-e2e-four-apps-20261027` |
| HEAD de partida antes de publicar ESTE archivo | `cb7b7f27a7a4cb3e626653f024071521b9782aee` |
| Compilación integrada cuatro apps del mismo HEAD | **SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40929894559 |
| PostgreSQL16 descartable, contratos y concurrencia del mismo HEAD | **SUCCESS** — https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40929894583 |
| G202 — cinco fuentes originales Cliente→Admin, mismo PostgreSQL | **5/5 trazas PASS**; **0/5 cierres comerciales reales certificados** |
| Artifact G202 | `qore-g202-five-original-journeys-cb7b7f27a7a4cb3e626653f024071521b9782aee` — id 12922586088 |
| PR paralelo más reciente | #28 G203, DRAFT OPEN, cuatro CI GREEN, aún NO integrado |
| PR de capacidad paralelo | #27 G194, DRAFT OPEN, no certifica 1 millón |
| Veredicto | **QA_INTEGRATED / EXTERNAL_STAGING_NOT_CERTIFIED / COMMERCIAL_NO_GO** |

La publicación de este archivo cambia el HEAD. Al empezar nuevo chat: CONSULTAR GitHub HEAD de nuevo y leer los CI del SHA actual; los demás arquitectos pueden avanzar simultáneamente. Evitar sobrescrituras, force push y fusiones no autorizadas.

## 1. Misión y cinco servicios indivisibles

**Producto:** QORE Mobile / Movete Fácil; mercado inicial Paraguay; importes enteros en Gs/PYG. App sofisticada, elegante, versátil, funcional y antifraude. Objetivo futuro >1M clientes sin perder ni duplicar operaciones.

**Cuatro superficies:**
- **A Backend:** HTTP, PostgreSQL, autoridad comercial, Auth, roles/RLS, despacho, KYC, antifraude, precio, estado, liquidación y trazabilidad.
- **B Cliente:** Expo; pasajeros, paquetes, comercios, GPS/mapa, historial, mensajes, ratings, pagos, incidencias, objetos olvidados.
- **C Driver/Courier:** Expo; KYC real, vehículo y categoría legal, ofertas, radio por distancia real en carretera, aceptar, ejecutar, entregar, chat, ganancias.
- **D Admin Web + Merchant:** Owner con MFA/RBAC, comisiones de TODOS los servicios editables, Merchant Staff/inventario, cinco flujos, soporte, fraude, disputas y finanzas.

**Cinco recorridos, cada uno con aceptación diferenciada:**
1. `AUTO_RIDE` — Cliente reserva auto → Driver AUTO legal → Admin.
2. `MOTO_RIDE` — Cliente reserva moto pasajero → Driver MOTO pasajero autorizado → Admin. No confundir con moto carga.
3. `DELIVERY_AUTO` — Cliente solicita paquete AUTO → Courier AUTO → destinatario independiente → Admin.
4. `DELIVERY_MOTO` — Cliente solicita paquete MOTO → Courier MOTO carga → destinatario → Admin.
5. `COMMERCE` — Buyer compra → Merchant Staff acepta/prepara → Courier entrega → Buyer confirma/califica → Admin con mismo orderId+deliveryId.

Todos deben mantener **la misma transacción original**: requestKey, serviceId/tripId/deliveryId, precio quoteId/consentimiento, actor y transiciones. Nunca ensamblar una reserva nueva con un viaje prelegal distinto y presentarlo como E2E.

## 2. El hallazgo central: G202 pasa pero el producto aún NO

**G202**: `apps/mobility-expo/server/g202-five-original-service-journeys-pg-ci.mjs`, llamado desde `.github/workflows/mobility-g4-postgres-disposable.yml`. Audita 5 solicitudes originales y sus respectivas trazas Admin bajo rol privado en la MISMA instancia PostgreSQL 16 descartable. Comprueba IDs, claves originales, roles y estados. Publica JSON de evidencia.

**Importante:** las cinco fuentes pueden existir y verse correctamente en Admin **sin que se haya aceptado un conductor legal, completado un viaje, entregado un paquete o liquidado dinero**. El propio G202 informa `commerciallyCompletedEndToEndJourneys: 0`.

La cadena de pruebas existente G109 de fases Driver AUTO utiliza un caso histórico/fixture prelegal; es útil para probar ciclos, pero NO demuestra un viaje nuevo G73→oferta→aceptación legal→fin. Las pruebas MOTO G118/G199/G200 incluyen fixtures sintéticos QA, no permiso municipal. No eliminar los gates por frustración de “terminar ya”.

## 3. Matriz P0 — qué está y qué falta por servicio

| Servicio | Implementado / probado dentro de QA | Primer salto que NO está certificado comercialmente | Prueba de aceptación pendiente |
|---|---|---|---|
| **AUTO_RIDE** | Reserva G73/G98; despacho G111/G112, ofertas G4; Driver G170/G177 fases; Admin G138; G202 identifica fuente original | Driver realmente KYC G38/G71 autorizado recibe y acepta **ESA reserva nueva**, GPS/sesión y estado legal | Un nuevo tripId G73: Driver privado acepta una sola vez, arrive→pickup→complete, Cliente e historial/ratings y Admin muestran mismo id, tarifa, slot liberado |
| **MOTO_RIDE** | G100/G102 reserva/ledger; G118 legal fence, Driver read G169; Admin G142; preferencia distancia G199; chat objetos G200 | Verificación independiente de licencia, casco/seguro y habilitación local para **pasajero MOTO**, oferta y Driver real | Misma reserva MOTO nueva, no virar a AUTO; aceptación legal, GPS, finalización B/C/D, recibo y valoración |
| **DELIVERY_AUTO** | G5/G121/G122/G123 tarifa/consentimiento; G66/G67 custodia; G187/190/192/193 destinatario y recuperación; Admin G145 | Courier AUTO legal de oferta real y evidencia de retiro + destino independiente; mapas/ruta y persona receptora verificadas | Un mismo deliveryId desde pedido hasta pickup G67, destinatario G187, estado delivered, disputa/return, Admin, settlement solo si autorizado |
| **DELIVERY_MOTO** | Igual cadena G5 con modo MOTO, precio G122, Admin G145 | Courier MOTO **carga** legal con peso/capacidad/zona, aceptación y recorrido; destinatario | Mismo deliveryId sin convertir vehículo ni autorización; custodia + receptor original + Admin |
| **COMMERCE** | Buyer G45/G139, stock; Merchant G148/G156, precio/envío G150/G153/G154; Admin G146; PR #28 G203 coteja G145 del envío vinculado | Merchant Staff y courier legal reales, paquete retirado/entregado, Buyer confirma y PSP separado | El MISMO orderId→deliveryId→quoteId, Merchant ready/pickup/entrega real, Buyer/Driver/Admin, stock y comisiones/ledger conciliados |

**NO se considera finalizado** ningún recorrido porque termine en Admin sin un actor legal de ejecución; tampoco se debe marcar “paid” con una cotización G7. Los permisos y cobros se certificarán bajo autoridad externa real.

## 4. Prioridad máxima del SIGUIENTE arquitecto — acciones de código, no documentación

**P0-1 — Primer commit: conectar NUEVA reserva AUTO G73 a aceptación real Driver autorizada.**
Abrir:
- `apps/mobility-expo/server/g4-staging-runtime.mjs`
- `apps/mobility-expo/server/g4-loopback-http-transport.mjs`
- `apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs`
- `apps/mobility-expo/server/g111-after-booking-auto-dispatch.mjs`
- `apps/mobility-expo/server/g112-scoped-auto-dispatch-repository.mjs`
- `apps/mobility-expo/server/g109-driver-auto-completion-pg-http-ci.mjs`
- `apps/mobility-expo/server/g177-verified-auto-driver-step-gateway.mjs`
- `apps/movete-driver/app/ofertas.tsx`, `app/viaje.tsx`
- `apps/movete-cliente/app/index.tsx`, `src/ClientRuntime.tsx`
- `apps/movete-admin/src/service-trace-gateway.mjs`

Identificar exactamente dónde se detiene **G73 nueva→G112 despacho→oferta privada→Driver verificado G71→aceptación G42→G177**. Implementar la unión que pueda hacerse con código; conservar `DENY` por KYC externo ausente. Probar doble aceptación, cancelación vs aceptación, no doble cobro, reconexión y mismo serviceId en Cliente/Admin. Producir commit + CI del HEAD.

**P0-2 — MOTO pasajero**: misma reserva G100, oferta privada G118 y categoría legal; combinar G199 distancia por ruta con autorización local **ambas necesarias**, G169 Driver, G142 Admin; completar fases reales. No usar permiso de MOTO carga para pasajeros.

**P0-3 — Dos tipos de ENVÍO**: fuente G121/G122, G10 oferta Courier, G66/G67 custodia, G187 destinatario de identidad distinta, G190 estado read-only, G145 Admin, reintentos y disputa; `requested_vehicle_kind` inmutable; un solo deliveryId.

**P0-4 — COMMERCE**: inspeccionar PR #28 G203 ANTES de programar lo mismo, luego unir Buyer G139, Merchant G148/G156, G150 `orderId→deliveryId`, Courier G10/G66/G67 y destinatario, Admin doble traza G145/G146 y economía. Merchant no puede marcar “delivered” sin courier/receptor.

**P0-5 — Prueba de integración ÚNICA**: desde UIs nativas (no scripts inconexos), con actores reales STAGING cuando estén autorizados; instrumentar por paso `requestKey`, `tripId`, `deliveryId`, `orderId`, actor/rol, quote, transaction commit, timeouts, error, p95/p99, Admin source, anti-fraude. G202 se conserva como examen de fuentes, pero hace falta una **prueba distinta de cierre físico** con permisos externos genuinos.

Cuando un paso dependa de KYC, PSP, GPS o IdP reales aún inexistentes, señalar EXTERNAL_BLOCKED, mantener fail-closed y CONTINUAR otra reparación implementable. No afirmar “todo listo” por no poder levantar un servicio externo.

## 5. PR ABIERTOS: no duplicar, no perder, no merge a ciegas

**#28 G203 — PRIORIDAD INMEDIATA**
https://github.com/mezas3238-hue/Qore-mobile-/pull/28

- DRAFT abierto, NO integrado; branch `feature/qore-g201-commerce-admin-linked-cargo-20261029`; HEAD comprobado `5d6996810db1e406d72dad04622eb674970a2c22`.
- Modifica tres archivos: `apps/movete-admin/src/main.tsx` (acción Admin verificar G150 delivery original enlazado al pedido), `apps/mobility-expo/server/g150-merchant-priced-delivery-link-pg-ci.mjs` (doble cotejo orderId/deliveryId/quoteId, estado, precio) y `.github/workflows/qore-four-apps-unified.yml`.
- **4/4 CI SUCCESS del mismo HEAD verificados:** A+B+C+D https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40930275074 ; Mobility Expo https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40930275095 ; PG16 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40930275075 ; Node STAGING https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40930275087 .
- SIGUIENTE: revisar diff y estado de PR, conservar trabajo en paralelo; proponer integración a Owner sin hacer merge sin orden. Falta Courier/PSP comercial aunque 4 CI pasen.

**#27 G194 — CAPACIDAD/ADMISIÓN**
https://github.com/mezas3238-hue/Qore-mobile-/pull/27

- DRAFT abierto; HEAD leído `f457b5f6b6878918d71caaed5ac60d097ab0c298`. Cambia antiguo límite de 64 operaciones upstream en vuelo por instancia por carriles configurables 256 GET y 128 POST (384 en vuelo por réplica) y ~32768 identidades por réplica; incluye backpressure y validaciones. **NO significa 384 viajes/s ni 1M clientes certificados.**
- No integrar antes de revisar conflictos con G201 y G202, pooling PG, RAM y latencias. PR #21 (laboratorio Redis/carga) y #22 (modelo >2M) siguen como antecedentes; no son evidencia de un millón simultáneo.

Otros PRs: #26 ingreso STAGING Render/código cuatro apps; #25/#24/#23 precedentes superados; #19 KYC Driver, #20 Admin, #14 candidatos Stores, #13 retry, #7/#8 fundaciones; PR #21/22 escala; PRs legacy con bases distintas. Issues arquitectos: #15 A Backend, #16 B Cliente, #17 C Driver, #18 D Admin. Volver a consultar todos sus HEADs y PR states: cambios concurrentes son posibles.

## 6. Avances G187–G202 recientes que el nuevo arquitecto DEBE preservar

**Entrega y confirmación independiente**
- G187 `apps/mobility-expo/docs/backend/staging_only/G187_INDEPENDENT_RECIPIENT_CONFIRMATION_POSTGRES_CI_ONLY.sql`. El remitente vincula destinatario distinto; mensajería/custodia G67 y recepción independiente, sin PSP.
- G188 UI Cliente `apps/movete-cliente/app/confirmacion-entrega.tsx` + `src/domain/g187-recipient-http-gateway.mjs`.
- G190 GET privado sin reenviar confirmación tras ACK perdido, historial no desaparece por disputa; settlement bloqueado durante incidencia.
- G192/193: `src/domain/g192-receipt-key-journal.mjs` y `src/NativeG192ReceiptJournal.ts`; requestKey original se cifra **ANTES** del POST en Keystore/Keychain, se restaura al reiniciar, se archiva solo con GET del mismo bindingKey SQL original. No re-post automático.

**Distancia de recogida controlada por Driver**
- G197 `apps/movete-driver/app/distancia-recogida.tsx` y SQL `G197_DRIVER_PICKUP_ROAD_DISTANCE_POSTGRES_CI_ONLY.sql`; G199 extiende `MOTO_RIDE` al trigger G118.
- Servicios independientes `RIDE`, `MOTO_RIDE`, `DELIVERY`, `MERCHANT_ORDER`; rangos seleccionables 1/2/3/5/8/10/15/20/30/50 km; compara **distancia real por carretera** con evidencia reciente, no círculo GPS.
- PENDIENTE real: proveedor de ruta/posición Geoapify certificado, prueba de movimiento del Driver y conexión al despacho en servidor STAGING desplegado. Si no hay ruta, denegación de nuevas ofertas bajo la preferencia, no inventar metros.

**Objetos olvidados y contacto posterior**
- G198 AUTO, G200 MOTO; Cliente `app/objetos-olvidados.tsx`, `app/objetos-olvidados-moto.tsx`; Driver tiene bandejas equivalentes. SQL G198/G200 cierra permisos a pasajeros y conductores originales, 7 días, controles de mensajes/rate, revocación y bloqueo. Respuesta Driver exige vehículo detenido mediante proveedor independiente.
- HTTP `apps/mobility-expo/server/g198-lost-items-gateway.mjs`, `g200-moto-lost-items-gateway.mjs`. Nativos `apps/movete-cliente/src/domain/g198-lost-items-http.mjs`, `g200-moto-lost-items-http.mjs`; Driver `src/domain/g198-driver-lost-items-http.mjs`, `g200-driver-moto-lost-items-http.mjs`.
- G201 `g201-five-journey-runtime-bridges.mjs` montado en `g4-staging-runtime.mjs` con `journeyTrust` explícito, identidad G42 y PostgreSQL como autoridad. Ausente trust → 503/cerrado. 
- PENDIENTE: atestación vehículo detenido, cierre de caso con lectura auditada (G201 aún deniega cierre sin comprobante), reconciliación de mensajes inciertos tras reinicio, notificaciones, privacidad.

**G202:** los cinco originales Cliente→Admin y contrato Admin/SQL se examinan juntos en `g202-five-original-service-journeys-pg-ci.mjs`, con artifact; 0 cierres comerciales certificados. No volver a escribir otro laboratorio que reemplace el mismo examen.

## 7. Identidad, legalidad y protección antifraude — P0/P1

- **KYC Driver G38/G71 REAL**: distinguir automóvil, motocicleta pasajeros y motocicleta carga; licencia, antecedentes/reglas localmente aplicables, habilitaciones municipales, seguro, vehículo, fechas de vencimiento, revocación. Un perfil creado NO implica KYC autorizado. Requiere verificación de documentación real/operador autorizado.
- **Supabase Auth real G42**: sesión, JWT y revocación/rol exclusivo de Passenger, Driver, Merchant Staff, Admin. No exponer `service_role` en Cliente/Driver. RLS y RPC; staff no puede mutar pedidos ajenos. Owner Admin MFA/AAL2 y auditar cambios de tarifas.
- **Ratings bilaterales** G155: Cliente→Driver/Courier/Comercio, Driver→Cliente, Merchant→Cliente cuando participante/completado verificable; filtros fraude, evidencia y apelaciones, sin sanción automática por 1 reporte.
- **Fraude/soporte** G157/G158: reportar falsas entregas, falsas recogidas/GPS spoofing, suplantación, cancelaciones abusivas, estafas/links, disputas de PSP, acoso, riesgo de objeto olvidado; análisis humano, trazas inmutables, deduplicación y límites.
- **Custodia G66/G67 y destinatario G187**: prueba Driver y receptor independientes, identidad misma entrega original, no liberar dinero ante ACK ambiguo ni disputa; devolución/recuperación.
- **Mensajes**: Client↔Driver activos y post-servicio; no números/emails, anti-spam, no teclear conduciendo, retención/legal local y bloqueo.
- **Seguridad/privacidad:** secretos fuera de apps móviles, protección contra cross-tenant, Sentry/logs redactados, CI análisis dependencias, validación DTO estricta, expiraciones reales, revocación de staff y drivers, rotación secretos.

## 8. Tarifas, pagos, comisiones, contabilidad y Merchant

El Owner exige que **todas las comisiones** sean configurables desde Admin Web (AUTO/MOTO pasajeros, envíos AUTO/MOTO, comercio y subtipos). Implementación antecedente G116/G124/G136 con MFA/AAL2, revisiones CAS y auditoría; **verificar versión actual**, no inventar porcentaje fijo ni usar subsidios de pasajero en comercio/carga.

- Precio antes de aceptar, mapa/ruta/quote con G7/G122 y consentimiento exacto; no cambiar vehículo ni precio sin reconsentimiento.
- Merchant: catálogo/variantes, stock, atomic reserve/commit/compensate, no oversell; preparación, listo, courier recoge y entrega, orderId y deliveryId; Admin G203 coteja ambos.
- PSP **aún no certificado**: elegir proveedor soportado y contrato solo tras autorización; sandbox con webhooks firmados, reembolsos, disputas, cash vs online separado, ledger de comisiones, reconciliación, settlement y rollback. Sin PSP: `paymentAuthorized=false`, no pintar “pagado”.
- Recibos/ganancias de Driver, comisiones Merchant, reembolso de Buyer y reporte Admin tienen que ser el mismo libro original.

## 9. Figma y UX: premium SIN reemplazar el código funcional

Figma QORE Signature: https://www.figma.com/design/md9phVO8aDiDG3l57G7Rkw ; ocho pantallas de alta fidelidad reportadas y tokens reutilizables (Cliente, Driver, Comercio, Admin). Referencias de nodos: Comercio 7:10, Admin 7:89. Al corte el plan Figma Starter dio cuota agotada para leer diseño desde conector. **No afirmar que ya fueron trasladadas a GitHub**; revalidar cuota/acceso.

Pendiente UI real para CUATRO apps: mapa GPS/direcciones y tiempos, solicitud completa y seguimiento, filtros y chat, recibos, ratings, privacidad, resolución de obj. olvidados, foto prueba entrega, seguridad, comercios, comisiones Owner, Figma tokens en componentes editables Expo/React, accesibilidad, adaptación teléfonos Android/iOS, calidad premium, estados offline/loading/errores, sin cuelgues.

## 10. Escalabilidad >1M clientes: rutas separadas del E2E P0

PR #27 G194 = límite por réplica configurable, NO throughput certificado. PR #21 incluye HTTP/Redis y PostgreSQL co-tenant QA, PR #22 plan >2M; ninguno demuestra más de 1 millón de clientes reales simultáneos. El tope histórico 64 por instancia no debe confundirse con 64 clientes totales.

Pendiente: arquitectura horizontal Render/servicios réplica, balanceador, Redis compartido y quota global por actor, PgBouncer/pooling/conexiones, outbox durable, queue+DLQ, alertas, índices/particionado/vacuum, backpressure y p95/p99 por vertical, métricas por commit, crash recovery y replay idempotente, carga real conjunta 5 servicios, fallas PG/Redis/GPS/PSP, pruebas escalonadas aprobadas por presupuesto. No ejecutar cargas gigantes o costos externos sin autorización. Medir usuarios únicos, activos, sesiones, RPS, operaciones simultáneas, backlogs, CPU/RAM/SQL, límites y costos POR SEPARADO.

## 11. Render / Supabase / Geoapify / Stores: no se improvisa salida

**Orden Owner:** GitHub con E2E real verificable primero → autorización Owner para Render/Supabase STAGING externo → identidad/KYC/GPS/PSP sandbox y dispositivos reales certificados → nueva orden para LIVE/Stores.

- **Render STAGING:** revisitar PR #26, `render.yaml` del PR #27, TLS/pinned host, health/readiness, backoff, Redis, log seguro, rollback. No desplegar sin orden.
- **Supabase STAGING:** proyecto autorizado, Auth real, roles/RLS/migraciones auditadas, índice/backup, pool y límites; **SQL en `apps/mobility-expo/docs/backend/staging_only/` fue diseñado para base POSTGRES DESCARTABLE, NO aplicar ciegamente a producción**.
- **Geoapify:** usuario indicó Maps conectado a GitHub; confirmar permisos/scope/key seguros, cuota Paraguay, rutas auto/moto, geocerca/fraud GPS, driver ETA y metros de carretera; no meter API key secreta al teléfono.
- **PSP:** autorización y legal local, modo sandbox separado; sin operación comercial hasta firmar estados, checkout y conciliación.
- **Dispositivos:** Android real/iOS real, red débil, app background/restart, GPS denegado, timeout, sesión revocada, push, intermitencia, render UI y QR/photo, QA de cinco recorridos; revisar PR #14 AAB/iOS candidatos, no confundir build con Play Store/App Store aprobado.

## 12. Definición de terminado por servicio (checklist de aceptación)

Para cada uno de los cinco:
- [ ] Solicitud nueva desde app B física, pasajero autenticado, quote y consentimiento original.
- [ ] Backend A guarda una sola reserva; POST ambiguo se recupera sin duplicar ni perder.
- [ ] Actor Driver/Courier legal/Staff recibe oferta u orden **correspondiente al mismo serviceId** y puede aceptarla solo una vez.
- [ ] Maps/GPS/ruta y desplazamiento realmente verificados; horarios, zonas y permisos legales; no fake position.
- [ ] Cliente sigue estado real, intercambia mensajes; Driver/Comercio actualiza fases originales.
- [ ] `complete/delivered` solo después de prueba física; para envíos/Comercio, G67 courier y G187 destinatario independiente.
- [ ] D Admin consulta mismo serviceId, bookKey/quote/orderId/deliveryId, transiciones, versiones de tarifa, comisiones e incidencias.
- [ ] Ratings bilaterales, fraude/disputa, contacto postviaje y soporte funcionan con rol y evidencia.
- [ ] PSP sandbox o comercial autorizado, con webhooks, ledger exacto, disputa/reembolso y conciliación; si ausente estado financiero `NO_GO`.
- [ ] Red débil/reinicio, carreras 2 Drivers, cancel/retry, sesión revocada, app Android/iOS sin cuelgues y verificación de no fuga de PII.
- [ ] Misma revisión en 4 apps + cadena PostgreSQL16 + pruebas externas físicas, y aceptación Owner/legal cuando corresponda.

Tres estados separados por servicio: `CODE_QA_GREEN`, `EXTERNAL_STAGING_VERIFIED`, `COMMERCIAL_READY`. **Nunca derivar el último solo del primero.**

## 13. Cómo acelerar trabajo del siguiente arquitecto

1. **No redactar otro documento**. Recuperar este handoff y HEAD actual; abrir PR #28 y ver si se integró; primer cambio de código debe cerrar un eslabón AUTO G73→G71→C→D.
2. Conservar una sola rama operativa, contratos y PostgreSQL original; no inventar G203 duplicado ni reconstruir apps.
3. Respetar ramas paralelas/PRs y CAS sobre SHA/blob actualizado; no hacer merge sin Owner.
4. Encadenar reparación de backend con **la pantalla nativa que la utiliza**, y prueba E2E del **mismo ID original**.
5. Continuar P0 por vertical, luego seguridad/comisiones, diseño, escalado; no sustituir cierre operativo por cientos de pruebas aisladas.
6. Por cada avance, proporcionar SHA, files concretos, URL CI **del HEAD exacto**, qué cliente puede hacer REALMENTE, qué sigue bloqueado y próxima acción precisa.
7. Cuando solo falte permiso/proveedor/costo externo, mantener `EXTERNAL_BLOCKED` fail-closed, solicitar aprobación específica de forma segura y seguir con trabajo implementable; nunca recibir secretos en chat plano.
8. No hacer promesas de trabajo en segundo plano, no dar estimaciones inventadas y no declarar éxito comercial sin evidencia.

## 14. Prompt para copiar al NUEVO CHAT

> Actúa como **Arquitecto Ejecutivo Integrador A+B+C+D de QORE Mobile / Movete Fácil**. Recupera el handoff canónico `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G203_CINCO_RECORRIDOS_PENDIENTES_EJECUCION_INMEDIATA_2026-10-29.md` directamente de GitHub, repo `mezas3238-hue/Qore-mobile-`, rama `integration/qore-mobile-e2e-four-apps-20261027`. Consulta HEAD/CI actuales y PR #28 G203 y PR #27 G194 antes de modificar archivos. Tu misión es **TERMINAR EN CÓDIGO los cinco recorridos verdaderos** `AUTO_RIDE`, `MOTO_RIDE`, `DELIVERY_AUTO`, `DELIVERY_MOTO`, `COMMERCE` Cliente→Backend→Driver/Comercio→Admin, con el mismo ID original. Al corte había 5/5 fuentes Client→Admin verificadas (G202), **0/5 cierres comerciales reales certificados**. **Empieza ya reparando nueva reserva AUTO G73→Driver con KYC legal G38/G71→aceptación→viaje→Admin**, luego MOTO, envíos y Comercio; aprovecha PR #28 sin duplicar código, conserva G187 custodia/confirmación, G197/G199 distancia carretera, G198/G200 chat postviaje, seguridad G42 y comisiones Owner. No redacciones, prototipos ni tests aislados como sustituto de la aplicación. Publica commits y valida las cuatro apps y PostgreSQL del mismo HEAD. No inventes KYC, permisos MOTO, GPS, pagos ni adjudicaciones; cuando falte proveedor externo mantené fail-closed y avanzá todo lo implementable. **No merge, LIVE, Render/Supabase ni PSP externo sin mi orden**. No me vuelvas a pedir requisitos que ya constan en el documento. Quiero funciones completas en GitHub, no otro handoff.

## 15. Anexos que NO deben perderse

- `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_ABCD_G181_FINALIZACION_E2E_CINCO_SERVICIOS_ESCALA_2026-10-29.md` — inventario profundo y antecedentes de escalabilidad.
- `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md` — detallado de SQL/roles/traders legacy (movilidad) y puntos de corte A+B+C+D.
- `.github/workflows/qore-four-apps-unified.yml` y `.github/workflows/mobility-g4-postgres-disposable.yml` — gates integrados.
- `apps/mobility-expo/server/g201-five-journey-runtime-bridges.mjs`, `g202-five-original-service-journeys-pg-ci.mjs`.
- PRs #28, #27, #26, #21, #22; issues #15 A, #16 B, #17 C, #18 D.
- Diseño https://www.figma.com/design/md9phVO8aDiDG3l57G7Rkw.

**Fin del handoff. Próximo paso obligatorio: código del camino crítico en GitHub, NO otro handoff.**
