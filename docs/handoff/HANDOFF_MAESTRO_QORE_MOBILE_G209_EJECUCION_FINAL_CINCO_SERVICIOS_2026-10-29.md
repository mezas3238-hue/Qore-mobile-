# HANDOFF MAESTRO EJECUTIVO — QORE MOBILE / MOVETE FÁCIL
## Continuidad integral A+B+C+D · G209 · Terminar cinco operaciones reales y preparar STAGING
**Corte de evidencia: 29 de octubre de 2026, 19:38 Paraguay (UTC−03) · No confundir corte con HEAD permanente.**

> **MANDATO DEL OWNER:** El siguiente arquitecto debe **terminar código funcional**, no rehacer handoffs, prototipos o pruebas aisladas. Debe conservar los avances, cerrar los eslabones físicos reales de los **cinco servicios**, verificar cuatro aplicaciones/una transacción original y preparar, sin activar por cuenta propia, Render + Supabase. **No declarar lista una operación comercial sin prueba real.** No merge, despliegue externo, LIVE ni PSP comercial sin autorización explícita del Owner. Ejecutar toda reparación local/GitHub que no requiera esos permisos.

## 0. PUNTO DE PARTIDA VERIFICADO EN GITHUB — ACTUALIZA ANTES DE TOCAR CÓDIGO
- Repo oficial: https://github.com/mezas3238-hue/Qore-mobile-
- Rama de integración: `integration/qore-mobile-e2e-four-apps-20261027` (NO `main`).
- **HEAD verificado antes de publicar este documento:** `9918e56ed31349f5f47b9c2a3c4bf4d7b506d781` = **G209**. Este documento crea otro commit y otros arquitectos pueden mover la rama: recuperar HEAD y comprobar `git status`, árbol, PR y CI de nuevo.
- CI del G209 exacto: [A+B+C+D](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40966144334) **SUCCESS**, [PostgreSQL16 G4](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40966144350) **SUCCESS**. Miden integración y contratos SQL descartables, **no servicio comercial funcionando en la calle**.
- [G203 handoff precedente](https://github.com/mezas3238-hue/Qore-mobile-/blob/b36960120d0b08a1898d2eac8063094e35a6ce7c/docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G203_CINCO_RECORRIDOS_PENDIENTES_EJECUCION_INMEDIATA_2026-10-29.md): detalle técnico, archivos, bloqueos y definiciones; éste **actualiza** las prioridades tras G204–G209.
- **Veredicto de producto:** `CODE_QA_PARTIAL_GREEN` / `EXTERNAL_STAGING_NOT_VERIFIED` / `COMMERCIAL_NO_GO`. G202 trazó 5/5 solicitudes originales B→A→D en un PG16 descartable y reportó **0/5 cierres comerciales físicos certificados**. No usar un estado de prueba para afirmar cinco entregas/viajes completos.

### Delta REAL desde handoff G203: NO DUPLICAR
1. **G204** (commit `f1c7acd...` y consolidación G206): protege lifecycle Driver AUTO contra viaje anterior no ligado a reserva G73.
2. **G205** (commits `d41b32f...`, `8579dfd...`, `3c1c435...` hasta `a4efa35...`): SQL `G205_ORIGINAL_G73_AUTO_DRIVER_ACCEPTANCE_POSTGRES_CI_ONLY.sql` y G4 enlazan **aceptación privada AUTO a la misma reserva G73**, sesión G42, autorización documental G38/G71, revocación y carrera de aceptación. Está probado en PostgreSQL **QA descartable**; **no** equivale a conductor real con licencia/cobertura municipal verificada en Paraguay.
3. **G206** `bee54653c6e5d4f1d57176dfe9fe32a353b8c286`: incorpora trabajo G203/G204 de PR #29: Admin verifica envío originado en Comercio G150→G145/G146; Driver MOTO nativo `moto-viaje.tsx`, recuperación privada del mismo G119 booking G169/G189; adaptaciones four-app/Driver G197/G198/G200 y tests.
4. **G207** `45269d70985e8566282343d30f18bf0efca6ad85`: desplaza antiguo cuello de 64 operaciones en vuelo **por réplica** a carriles `256 GET + 128 POST` (384 concurrentes/réplica configurables, no RPS ni millón certificados) con presupuesto de identidades 32768; `render-staging-ingress.mjs`, `run-g4-render-staging.mjs`, `render.yaml`. Cliente AUTO `f1-auto-ride-continuation.mjs` revalida GET de viaje original y reintenta **solamente GET** bajo backoff/foreground; nunca reenvía POST.
5. **G208** `0f0d25c...` y `c0533c6...`: SQL G169/G189 se niega a crear estructuras de prueba fuera de DB descartable. **NO ejecutar SQL `*_CI_ONLY.sql` directamente en Supabase STAGING persistente**.
6. **G209** `9918e56...`: corre regresiones G194/G207 en workflow PostgreSQL de cuatro superficies; 2 pipelines verde para HEAD exacto.

### PRs paralelos — foto verificada, NO efectuar fusiones ciegas
- [#29 G204](https://github.com/mezas3238-hue/Qore-mobile-/pull/29) **DRAFT OPEN**; código funcional ya incorporado a integración en G206. Analizar diffs/ancestría antes de considerar merge: peligro de volver a aplicar duplicados o conflictos.
- [#28 G203](https://github.com/mezas3238-hue/Qore-mobile-/pull/28) **DRAFT OPEN**, marcado consolidado en #29; componente Commerce→Admin también incorporado en G206. **No merge por separado**.
- [#27 G194](https://github.com/mezas3238-hue/Qore-mobile-/pull/27) **DRAFT OPEN**; carriles de admisión implementados sobre integración por G207. Comparar antes de cualquier merge.
- [#26 G190/G193](https://github.com/mezas3238-hue/Qore-mobile-/pull/26) DRAFT OPEN, parte de legado y Render edge; revisar para no revertir las protecciones G207.
- [#21](https://github.com/mezas3238-hue/Qore-mobile-/pull/21) laboratorio aislado de 5.500 solicitudes HTTP, [#22](https://github.com/mezas3238-hue/Qore-mobile-/pull/22) plan >2M, **NO certifican carga real de 1M clientes**.
- #25/#24/#23, #19 Driver KYC, #20 Admin, #14 candidate Store, #13 retry, #7/#8 base: ramas históricas/antecedentes con bases divergentes; revisar necesidad por diff, no fusionar indiscriminadamente.
- Issues por división: #15 Backend A, #16 Cliente B, #17 Driver C, #18 Admin D. Si cualquier PR cambia, tomar nuevamente las referencias.

## 1. MISIÓN DE PRODUCTO Y CUATRO APLICACIONES
Cuatro superficies compartiendo transacción y backend:
- **A — Backend / PostgreSQL:** contrato HTTP, autenticación/roles, cotización, límites legales, despacho, estados, identidad, auditoría, pagos/ledger, seguridad, escalabilidad.
- **B — Cliente Expo:** pasajeros AUTO/MOTO, paquetes AUTO/MOTO, compras Comercio, mapas y GPS, precio y consentimiento, solicitud, seguimiento, chat, calificaciones, recibos, incidentes, objetos olvidados y recuperación sin duplicados.
- **C — Driver/Courier Expo:** alta/KYC legal por categoría, ubicación y disponibilidades, preferencias radio de **recogida por distancia de carretera**, oferta privada, aceptación única, lifecycle, custodia, destinatario, chat, historial, ganancias.
- **D — Admin Web + Merchant Staff:** Admin Owner con MFA/RBAC, comisiones configurables de todos los servicios, operaciones/identidades/soporte/fraude/ledger; Comercio con catálogo/stock/preparación/entrega propia y personal autorizado. No confundir Merchant con Admin Owner.

Meta UX Owner: calidad/elegancia superiores a alternativas de mercado, sin perder funcionalidad/estabilidad; mercado inicial Paraguay, importes en **guaraníes enteros (PYG/Gs)**.

## 2. LOS CINCO RECORRIDOS COMERCIALES INNEGOCIABLES
| Servicio | ID y fuente original | Completitud QA actual | BLOQUEO de cierre real |
|---|---|---|---|
| `AUTO_RIDE` | B solicita viaje G73→`tripId`→A/G112→C/G205→D/G138 | G205 ya comprueba aceptación original con G42/G71 en SQL QA, G177 fases Driver históricas; G207 relectura B | Encadenar **nuevo tripId** en UI real hasta llegada, pickup, completado, recibo y Admin con actor Driver documentalmente autorizado y GPS genuino; G205 QA no es una operación comercial |
| `MOTO_RIDE` | B G100/G102→G118 legal→C G169/G189→D G142 | G206 Driver nativo `moto-viaje` y recuperación del viaje propio, pruebas SQL | Legalidad **moto pasajero** autónoma (municipio/seguro/casco/licencia), oferta/aceptación real, ruta/fases y cierre; no usar autorización moto-carga |
| `DELIVERY_AUTO` | B G121/G122 G5→`deliveryId`→C G10 G66/G67→G187 receptor→D G145 | Fuentes y pruebas de custodia/receptor, lectura privada G190 | Oferta Courier AUTO real, pickup y entrega física + receptor distinto, GPS, saldo y disputa misma orden |
| `DELIVERY_MOTO` | B G121/G122 G5 MOTO→`deliveryId`→C G10 G66/G67→G187→D G145 | Contratos e idempotencia QA, G197/G199 alcance de recogida | Courier MOTO **carga** legal, límites de peso/capacidad/zonas, aceptación y cierre sin cambiar tipo de vehículo |
| `COMMERCE` | Buyer G139→`orderId`→Merchant G148/G156→G150`deliveryId` G5→Courier→D G146+G145 | G206 incorpora link original G203, con cotejo Admin doble y reserva/stock QA | Staff/stock operativos reales, precio, courier autorizado, retiro, destinatario, confirmación Buyer, comisión, PSP y conciliación |

**Regla:** cada transacción conserva `requestKey`, `tripId` o `deliveryId`, `orderId` para Commerce, `quoteId`, actor, versión, consentimiento y recibos; backend autoritativo SQL. Prohibido sustituir una solicitud nueva con fixture previo o recrearla en Admin. Cinco fuentes G202 =/= cinco operaciones finalizadas.

## 3. EJECUCIÓN P0 — SIGUIENTE ARQUITECTO DEBE CAMBIAR CÓDIGO
**P0-A — AUTO primero, desde G205/G207 (NO reimplementar aceptación G205):**
1. Inspeccionar en HEAD `apps/mobility-expo/docs/backend/staging_only/G205_ORIGINAL_G73_AUTO_DRIVER_ACCEPTANCE_POSTGRES_CI_ONLY.sql`, `apps/mobility-expo/server/g4-staging-runtime.mjs`, `g4-loopback-http-transport.mjs`, `g111-after-booking-auto-dispatch.mjs`, `g112-scoped-auto-dispatch-repository.mjs`, `g177-verified-auto-driver-step-gateway.mjs`, `g109-driver-auto-completion-pg-http-ci.mjs`.
2. Inspeccionar B `apps/movete-cliente/app/viaje.tsx`, `src/domain/f1-auto-ride-continuation.mjs`; C `apps/movete-driver/app/ofertas.tsx`, `app/viaje.tsx`, `src/domain/driver-auto-accept-flow.mjs`, `driver-accepted-ride-resume.mjs`; D `apps/movete-admin/src/service-trace-gateway.mjs`.
3. Localizar **primer eslabón no conectado** entre G205 nueva aceptación y lifecycle G177 del MISMO `tripId` (Driver autoriza, llega, sube Cliente, finaliza, Cliente ve estado, Admin lo ve). Corregir servidor + UI nativa + prueba integradora sobre el mismo viaje, no crear otro G202.
4. Carrera 2 conductores; aceptar/cancelar al mismo tiempo; rechazo KYC expirado, sesión revocada, GPS ausente, doble finalización, restart/red inestable. No fake authorization, no post duplicado si ACK ambiguo. Si falta identidad legal externa, marcar `EXTERNAL_BLOCKED` y seguir siguiente tramo implementable.

**P0-B — MOTO pasajero original:** continuar desde G206 `apps/movete-driver/app/moto-viaje.tsx`, `src/DriverMotoJourneyProvider.tsx`, G118/G169/G189, radio G199, Admin G142; completar oferta única + aceptación real + estados + precio + calificación. Permisos pasajero no intercambiables con carga.

**P0-C — DELIVERY_AUTO y DELIVERY_MOTO:** cerrar B G121/G122→A G5/G10→C accept→G66/G67 custodio→G187 destinatario independiente→G190 reconciliación→D G145 con **un deliveryId**. Pruebas de robo/falsa entrega, prueba fotográfica autorizada y minimizada, devolución, reclamación, disputas, carrera, reintento, capacidad y tipo de vehículo inmutable.

**P0-D — COMMERCE:** aprovechar G206, no reeditar G203. Buyer B G139 stock/reserva/cancelación→Merchant D G148/G156 acepta/prepara→G150 vincula `orderId`/`deliveryId`/`quoteId`→C G10/G67 entrega→receptor G187→B valora→Admin D G145+G146, conciliación de pedido, inventario y comisiones. Merchant jamás autoatestigua entrega física; evitar oversell.

**P0-E — Una prueba E2E de transacción original por servicio:** incorporar a CI una ruta end-to-end desde app B real (cliente HTTP, auth real en staging autorizado) pasando por aceptación del actor y comprobación Admin. Mantener G202 como test de **fuentes** y nuevo examen como test de **cierre**. Instrumentar `requestKey`, ID original, `quoteId`, roles, revisiones, fases, GPS/route proof, expiraciones, sucesos PG, errores, p95/p99. Si no hay operador autorizado, separar prueba QA de prueba en dispositivo real, no falsificar estado.

## 4. SEGURIDAD, LEGALIDAD, ANTIFRAUDE (P0 TRANSVERSAL)
- G38/G71: verificar documentos **reales** del Driver/Courier por vehículo, licencia, seguro, habilitación local, expiración, revisión humana/revocación; QA documental no habilita viaje comercial. Distinguir AUTO, MOTO pasajero y MOTO carga.
- G42 Supabase Auth/IdP: sesiones no falsificables, verificación JWT servidor, revocación transaccional, roles disjuntos Passenger/Driver/Merchant Staff/Admin; RLS estricta, `service_role` nunca en Cliente/Driver, MFA/AAL2 en Owner.
- G197/G199 **radio configurado por Driver para recoger pasajeros y pedidos de comercios**: separar `RIDE`, `MOTO_RIDE`, `DELIVERY`, `MERCHANT_ORDER`; opciones 1/2/3/5/8/10/15/20/30/50 km; calcular **distancia por carretera desde ubicación vigente** y provider proof, no radio geométrico. Bloquear oferta si evidencia de ruta/GPS no disponible. Probar modo real con desplazamiento y origen de comercio, además de simulaciones.
- G198/G200 **Cliente↔Driver chat para objetos olvidados tras viaje AUTO o MOTO** (ventana de 7 días/participantes originales, G201): integración con historial y recuperación de mensajes, sin revelar teléfonos, anti-spam, bloqueos, reclamación y soporte; Driver no escribe conduciendo, exigir atestación independiente de vehículo detenido. No prometer entregabilidad push o atestación sin proveedor.
- G50–G60 chat durante asignación privada y entregas, recibos/reintentos ACK sin emitir doble mensaje; minimizar PII, moderación y reportes.
- G155 calificaciones verificadas: Cliente→Driver, Cliente→Courier, Cliente→Comercio; Driver→Cliente; Merchant→Cliente si participación válida, solo transacciones realmente terminadas, límite de repetición, apelación humana y evitar campañas de calificación falsa.
- G157/G158 antifraude: suplantación, GPS spoofing, robo y falsa entrega, cancelación abusiva, collusion, pedidos falsos, multi-cuenta, phishing/link en chat, disputas, rating manipulation y exfiltración; modelos de riesgo y revisión humana, evidencia, sanciones reversibles, bloqueos de alto riesgo, límites y audit log.
- G66/G67 custodia y G187 receptor: dos actores independientes; no establecer `delivered` por solo click de Merchant o imagen de prueba inventada. Disputa bloquea settlement.
- Datos: firma/vigencia de pruebas, acceso de mínimo privilegio, secretos fuera de bundle, cifrado local sensible, redacción logs, alertas, retención legal, recuperación ante fraude y privacidad paraguaya aplicable.

## 5. TARIFAS, ECONOMÍA Y PAGOS
- Cotización exacta/consentimiento B (G7/G122/G150) en **Gs/PYG enteros**, moneda explícita, cambio de ruta/vehículo requiere reconsentimiento.
- Todas las comisiones editables por **Owner desde Admin**: AUTO, MOTO pasajero, DELIVERY_AUTO, DELIVERY_MOTO, COMMERCE, subtipos/zonas/políticas; no hardcode, control MFA/AAL2, revisión CAS, auditoría y vistas claras para Merchant/Driver.
- Inventario Merchant: reserva atómica, no oversell, cancel/compensación/stock release; costo de envío ligado a factura original.
- PSP **aún sin evidencia de integración externa verificada**: seleccionar proveedor legal/autorizado solo con Owner; sandbox, checkout idempotente, webhooks con firmas y replay fences, cash vs online, devolución, contracargo, ledger de doble entrada o reconciliable, comisión, payout y auditoría. Hasta entonces NO marcar `paid`, `settled` ni ingresos ciertos.
- Consistencia económica entre Admin, Buyer, Driver, Merchant, reembolsos y reportes para mismos IDs; ningún payout si incidencia/receptor ambiguo.

## 6. RESILIENCIA, UX Y DISPOSITIVOS
- G192/G193 write-ahead `requestKey` cifrado antes de POST, GET seguro tras ACK perdido; preservar. G207 AUTO recuperación solo GET bajo backoff y foreground, preservar.
- Estados completos en B/C/D: loading, offline, reconexión, timeout, errores, cancelación, retries idempotentes, revocación, background y reinicio, servicios sin congelamientos ni loops; notificaciones push y lecturas de fallback, no auto duplicar POST.
- GPS y mapas integrados Geoapify indicados por Owner, **verificar conexión, alcance, cuotas, calidad de ruta real Paraguay**; ETAs y cobertura vehicular, geofencing, permisos foreground/background, degradación segura, no exponer key secreta.
- Figma QORE Signature: https://www.figma.com/design/md9phVO8aDiDG3l57G7Rkw ; referencias Commerce `7:10`, Admin `7:89`. Diseños/token reportados, **no asumir que ya están codificados en Expo/React**. Auditar Client, Driver, Merchant, Admin y llevar estilo premium a código **sin quitar funcionalidades**, accesibilidad, pantallas pequeñas, Android/iOS, teclado, mapas, chat, resultados y errores. Figma puede presentar límite de plan/conector: priorizar código existente.
- Ensayos E2E móviles en Android/iOS físicos: sesión real, GPS real, sin permisos, red débil, app en segundo plano, push, restarts, enlaces, fotos/entregas, navegación, batería y latencia. Un build web/TS verde no sustituye dispositivos reales.

## 7. ESCALABILIDAD MULTIMILLONARIA — RUTA NO BLOQUEANTE A CIERRE P0
- G207 **ya quitó el límite histórico 64 operaciones upstream en vuelo POR INSTANCIA** con carriles 256 lectura y 128 escritura. Evitar reintroducir 64. No equivale a 384 req/seg ni a 32768 usuarios simultáneos garantizados.
- Objetivo Owner: >1 millón de clientes; medir *registrados*, *activos diarios*, *simultáneos*, *RPS*, *viajes* y *entregas* por separado.
- Pendiente: múltiples réplicas (balanceador), Redis compartido para cuotas/estado no autoritativo, PgBouncer/pooling y máximo conexiones, índices, partición/archivado y VACUUM, durable outbox, workers/colas/DLQ, deduplicación transaccional, cache invalidation y coherencia, provider circuit breakers, límites de admisión globales, health/readiness real, autoscale y rollback.
- Benchmark escalonado representativo de cinco verticales y ratio GET/POST, distribución realista de usuarios y geolocalización, errores/caída PG/Redis/Geoapify/PSP y reconexión; informar RPS, p50/p95/p99, errores, pérdida/duplicado, RAM/CPU/SQL/connections, costo y recovery. PR #21/#22 son antecedentes, no certificado >1M.
- No usar laboratorio de millones de solicitudes contra terceros/Render sin presupuesto y autorización; desarrollar pruebas locales sostenibles.

## 8. RUTA A RENDER + SUPABASE (NO DESPLEGAR AÚN SIN ORDEN)
**Orden del Owner:** GitHub funcional y CI E2E sin duplicados → aprobación **STAGING externo** para Render/Supabase → proveedores IdP/KYC/Geoapify/PSP sandbox + dispositivos → certificar seguridad/legalidad → orden nueva para LIVE/Stores.
1. Render: revisar `render.yaml`, `apps/mobility-expo/server/render-staging-ingress.mjs`, `run-g4-render-staging.mjs`, HTTPS host pinned, variables de entorno externas, red privada, health/readiness, observabilidad, pools, horizontal scaling, rollback, `autoDeploy` apagado/LIVE deshabilitado en baseline; el endpoint `/_qore/liveness` solo prueba proceso.
2. Supabase STAGING: proyecto y Auth propios con tenant/roles/RLS, secretos guardados, migraciones **separadas** de SQL QA descartable, backups/restores, pooling, Storage, cifrado, pruebas de revocación. G208 bloquea ejecutar SQL G169/G189 `*_CI_ONLY.sql` fuera de entorno descartable: **diseñar migraciones productizables auditadas**, no quitar el guard.
3. Integraciones externas: Geoapify ruteo y GPS verificables, KYC/permiso local, PSP sandbox (firmas), push, correo si procede. Obtener acción/credenciales vía canal seguro; no copiar secretos a commits ni chat plano.
4. Publicación: builds Android/iOS separados Cliente y Driver, Admin Merchant web, políticas, revisión stores y monitoreo; requerirá evidencia externa y permiso Owner. No prometer go-live por un 2/2 CI verde.

## 9. PLAN DE ATAQUE POR PRIORIDAD Y CRITERIO DE SALIDA
**Sprint de ejecución inmediata, por primera falla concreta (NO por nueva documentación):**
1. Volver a consultar HEAD, CI y diferencias #29/#28/#27; observar que G205–G209 están en integración; construir mapa de rutas reales del *mismo ID*. Si otros arquitectos avanzaron, no sobrescribir.
2. Commit funcional P0-A: conectar el eslabón AUTO faltante posterior a G205 con G177/Cliente/Admin, más prueba integración y carrera.
3. P0-B: terminar MOTO pasajero con su permiso independiente y Driver G169/G189; continuar P0-C envíos AUTO/MOTO, P0-D Commerce.
4. En paralelo reparar bugs de UX críticos (congelamientos, reconnect, chat objetos, radios por distancia real y cotizaciones), evitar que cualquier vertical destruya avances existentes.
5. P1: Auth/RLS/KYC, GPS real, custodia, PSP sandbox/ledger, antifraude, ratings, comisiones. Cambios externos mantener separados de gates QA hasta aprobados.
6. P2: UI premium Figma, performance horizontal, pruebas de 1M bajo laboratorio gradual, dispositivos y salida STAGING.
7. Cada avance debe entregar: **SHA y archivos modificados**, evidencia de acción B→A→C/Merchant→D **del mismo ID**, URL GitHub Actions del HEAD EXACTO, resultado concreto, escenario adversarial, dependencias `EXTERNAL_BLOCKED` y siguiente eslabón. No decir «terminado» por filas Admin.

### Definition of Done POR CADA uno de cinco servicios
- [ ] Solicitud nueva de B con sesión válida y cotización autorizada.
- [ ] Una única persistencia A; ACK incierto se consulta sin segundo POST.
- [ ] Oferta/orden recibida únicamente por C/Staff legal/rol debido, misma identidad transaccional y aceptación única.
- [ ] GPS y distancia carretera auténticos con evidencia reciente, legalidad diferenciada y estados físicamente demostrados.
- [ ] Ciclo `accepted→arrive→pickup→complete` o `picked_up→delivered`, en su caso dos actores custodia/receptor.
- [ ] B sigue estado, mensaje, recibo, ratings y soporte reales.
- [ ] D lee misma fuente original, tarifas/comisiones, evento, versión, riesgo y respuesta antifraude.
- [ ] Concurrencia, timeout, rollback, cancelación, reinicio, roles, impersonation y privacidad bajo tests.
- [ ] PSP/ledger conciliado en sandbox autorizado; de lo contrario estado financiero NO_GO.
- [ ] Android/iOS físico (donde corresponda) y backend STAGING externo certificados.
Estados a mantener explícitos: `CODE_QA_GREEN`, `EXTERNAL_STAGING_VERIFIED`, `COMMERCIAL_READY`. **No elevar estado automáticamente.**

## 10. ARCHIVOS Y PUNTOS DE ENTRADA QUE EVITAN RECONSTRUIR EL PROYECTO
- Workflows: `.github/workflows/qore-four-apps-unified.yml`, `.github/workflows/mobility-g4-postgres-disposable.yml`.
- Servidor: `apps/mobility-expo/server/g4-staging-runtime.mjs`, `g4-loopback-http-transport.mjs`, `g205` SQL citado, `g201-five-journey-runtime-bridges.mjs`, `g202-five-original-service-journeys-pg-ci.mjs`, `render-staging-ingress.mjs`.
- B Cliente: `apps/movete-cliente/app/` y `src/ClientRuntime.tsx`, `src/domain/f1-auto-ride-continuation.mjs`, `src/domain/g192-receipt-key-journal.mjs`, pantallas `calificar`, `confirmacion-entrega`, `objetos-olvidados`, `objetos-olvidados-moto`.
- C Driver: `apps/movete-driver/app/ofertas.tsx`, `viaje.tsx`, `moto-viaje.tsx`, `distancia-recogida.tsx`, `src/DriverMotoJourneyProvider.tsx`, `src/domain/driver-auto-accept-flow.mjs`, `driver-moto-current-resume.mjs`, `g197-pickup-preferences-http.mjs`, `g198-driver-lost-items-http.mjs`, `g200-driver-moto-lost-items-http.mjs`.
- D: `apps/movete-admin/src/main.tsx`, `src/service-trace-gateway.mjs`, Admin SQL G138/G142/G145/G146 y Owner tariffs.
- Source legal/custodia: `apps/mobility-expo/docs/backend/staging_only/` (G71, G118, G187, G189, G197, G198, G199, G200, G205); **QA-ONLY NO migración a producción**.
- Continuidad profunda: `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G203_CINCO_RECORRIDOS_PENDIENTES_EJECUCION_INMEDIATA_2026-10-29.md`; `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_ABCD_G181_FINALIZACION_E2E_CINCO_SERVICIOS_ESCALA_2026-10-29.md`; `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md`.

## 11. PROMPT LISTO PARA ABRIR NUEVO CHAT — COPIAR Y PEGAR
> **Actúa como Arquitecto Ejecutivo Principal e Integrador A+B+C+D de QORE Mobile / Movete Fácil.** Debes **terminar la aplicación en código**, no crear handoffs ni prototipos. Lee **íntegro** en GitHub el documento canónico `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G209_EJECUCION_FINAL_CINCO_SERVICIOS_2026-10-29.md`, repo `mezas3238-hue/Qore-mobile-`, rama `integration/qore-mobile-e2e-four-apps-20261027`. Luego verifica **HEAD/CI actuales** y los PR #29, #28, #27, #26 para no duplicar merges o reimplementar G205–G209. Al corte G209 `9918e56...` pasó CI four-app y PG16; **cinco fuentes originales Cliente→Admin QA, cero cierres comerciales físicos certificados**. Implementa en primer commit el eslabón faltante **posterior a aceptación legal QA G205**: nueva reserva AUTO G73→Driver C G177→Cliente B seguimiento→Admin D con MISMO tripId, roles, estados y recuperación segura. Después MOTO pasajero G169/G189, DELIVERY_AUTO, DELIVERY_MOTO, COMMERCE con G150 y receptor independiente; termina las cuatro UIs y backend. Conserva radio por distancia carretera para recoger pasajeros y pedidos comerciales G197/G199, chat privado para objetos olvidados G198/G200, ratings G155, antifraude G157/158, comisiones Owner y UX premium Figma. Corrige fallas, race conditions, doble cargo, congelamientos y prepara escalado >1M sin inventar benchmark. Verifica cuatro apps y PostgreSQL del **mismo SHA**, reporta prueba de cada recorrido realmente unido. Si KYC/permiso/GPS/PSP real requiere acción externa, mantener fail-closed, etiquetar EXTERNAL_BLOCKED y completar lo que sí depende solo de código. **No merge, LIVE, Render, Supabase, PSP real, Stores ni costos externos sin orden explícita.** No me pidas de nuevo requisitos establecidos. Tu siguiente respuesta debe mostrar código/commits y evidencias funcionales, no otro plan ni handoff.

**Fin — Este documento es una plataforma de ejecución, no un certificado de operación comercial.**
