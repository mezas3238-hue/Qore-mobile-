# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO DE CONTINUIDAD G12
**Corte verificado:** 22 octubre 2026. **Destino:** siguiente arquitecto en ChatGPT Work / nuevo chat.
**Repositorio soberano:** `mezas3238-hue/Qore-mobile-`.
**Rama:** `feature/mobility-monorepo-isolated-20261016`.
**PR:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — DRAFT.
**HEAD verificado:** `73be6dfd37661d75cd80eec96f3e6949e5419758`.
**DOCUMENTO HISTÓRICO OBLIGATORIO:** `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_WORK_MOVETE_FACIL_INFRAESTRUCTURA_2026-10-22.md` (historia, G1–G11, riesgos, arquitectura y roadmap).
**OTRO HANDOFF:** `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_INTEGRAL_TARIFAS_INFRAESTRUCTURA_2026-10-22.md`.
Este documento es un **delta técnico verificado** de G12 y un mandato de continuidad; leerlo junto con los dos handoffs anteriores, no reemplazarlos.

## 1. MANDATO DEL OWNER — CONTINUAR SIN PAUSAS ARTIFICIALES
Completar primero infraestructura y backend de Movete Fácil: AUTO pasajeros; MOTO pasajeros solo donde sea legal y asegurable; ENVÍOS privados; delivery de supermercados, restaurantes, farmacias y otros comercios. Luego integrar interfaz definitiva en Lovable. La app debe permitir solicitud, búsqueda de conductores cercanos elegibles, oferta privada, notificación, aceptación exclusiva, datos conductor/vehículo/ETA en pasajero, tracking y cierre. Tarifas AUTO/MOTO/ENVÍOS/COMERCIO independientes, márgenes y comisión transparentes. El Owner pide ejecución real, no solo planes ni reportes reiterativos.
**No detenerse por dudas menores:** inspeccionar código, implementar en rama, probar, arreglar y seguir hasta bloqueo real. Si hay un bloqueo externo, registrar evidencia, continuar otro frente independiente y comunicar la decisión que falta.
**Prohibiciones:** NO MERGE; NO LIVE; NO VPS; NO SQL remoto; NO pagos reales; NO push real; NO despliegues remotos sin aprobación explícita. Mantener PR DRAFT y flags LIVE desactivados. NO TOCAR `mezas3238-hue/qore-core` (trading).

## 2. ÚLTIMO ESTADO CI — CONFIRMADO
En commit `73be6dfd`:
- PostgreSQL 16 desechable `QORE G4 PostgreSQL disposable smoke` **#4 SUCCESS**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39867044128
- Node STAGING contracts **#106 SUCCESS**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39867044005
- Expo isolated CI **#600 SUCCESS**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39867043977
G12 dispone de prueba SQL secuencial y prueba con **dos conexiones PostgreSQL independientes**: un trabajador reclama oferta con transacción abierta; el segundo debe obtener cero filas usando `SKIP LOCKED`; solo el dueño puede ACK; ACK duplicado falla; ACK del proveedor NO equivale a recepción por dispositivo. **Esto certifica solo esos contratos en PostgreSQL desechable, NO producción, ni cobertura integral de G4/G10.**

## 3. TRABAJO HISTÓRICO YA REALIZADO
Consultar handoff WORK anterior para commits y archivos G1–G11. Componentes ya documentados: GPS consentimiento/frescura y navegación simulada; cotizador PYG por AUTO/MOTO/DELIVERY/MERCHANT_DELIVERY con versión de reglas y comisión; ledger sintético conciliable; dispatch privado; autenticación de actor desde sesión; SQL/RPC G3/G4; G4 radar; G5 entregas; G10 ofertas courier/outbox; contratos OpenAPI; pruebas Node/Expo; persistencia, políticas de zonas, elegibilidad conductor, auditoría, flujos simulados. **No asumir que simulación es conexión real.**
Se realizaron endurecimientos de UUID/TTL, integridad de identidad, idempotencia, bloqueo de carreras, snapshots, SQL y contratos API. Ver evidencia detallada en handoff WORK.

## 4. G12 — CAMBIOS RECIENTES, ARCHIVOS Y COMMITS
- `server/g12-openapi-integrity.test.mjs` — `208246b7`: integridad OpenAPI, refs, parámetros, auth/errores.
- `server/g12-delivery-push-worker.mjs` — `f44aa360`: worker STAGING `createDeliveryPushWorker({claim,ack,sendToProvider,workerId,now})`; rechaza ofertas expiradas, nunca afirma device receipt.
- `server/g12-delivery-push-worker.test.mjs` — `f163af6`, `b4d946`, `a5c675`, `9dbc275`, `88a839`: validaciones y reloj inyectable.
- `server/g12-delivery-push-repository.mjs` — `3a2c550d`: adaptador `createDeliveryPushRepository({rpc})`, mapea `mobility_stage_claim_delivery_push` y `mobility_stage_ack_delivery_push`; tests `server/g12-delivery-push-repository.test.mjs` `4d262a11`.
- `docs/backend/staging_only/G12_DELIVERY_PUSH_CLAIM_ACK_POSTGRES_CI_ONLY.sql` — `7ff8a3c9`: columnas `claimed_at/claimed_by/provider_ticket_id`, restricciones, índice, claim atómico `FOR UPDATE ... SKIP LOCKED`, ACK solo dueño, grants service_role; **solo PostgreSQL desechable**.
- `server/g12-delivery-push-sql-contract.test.mjs` — `6cda6ba`: contrato estático.
- `server/g12-delivery-push-integration.test.mjs` — `1659dd3e`: dos workers con RPC fake atómico, un envío.
- `docs/backend/staging_only/G12_DELIVERY_PUSH_DISPOSABLE_SMOKE_POSTGRES_CI_ONLY.sql` — `01e3d2ae`: fixture mínimo local G10 con oferta y outbox.
- `docs/backend/staging_only/G12_DELIVERY_PUSH_DISPOSABLE_ASSERT_POSTGRES_CI_ONLY.sql` — `5ef2d9ec`: claims y ACK SQL secuenciales.
- `.github/workflows/mobility-g4-postgres-disposable.yml` — `a667fa68` + correcciones `2b083f45`, `e7bc94ca`, `ca90ec37`, `73be6dfd`: PostgreSQL 16 service, roles simulados, fixture, migración, SQL asserts, test dos conexiones. Activación pull_request por cambios relevantes y workflow_dispatch. Instala psycopg solo en runner de CI.
- `server/g12-delivery-push-concurrency-ci.py` — `ff1b780a`, corregido `dd93664d`: conexiones psycopg con transacción abierta y `statement_timeout=2000ms`; rehúsa BD fuera de `qore_disposable`/host localhost.
**Incidentes CI y resolución:** #1 falló por SQL quoting en verificación versión; #2/#3 fallaron por cadena literal `\\n` que unía pip con Python; #4 SUCCESS después de corregir. No reabrir incidentes cerrados salvo regresión.

## 5. LÍMITES TÉCNICOS REALES
- G12 claim actual es **at-most-once**; caída del worker después de reclamar puede dejar una oferta sin entrega push; diseñar recuperación/reclaim con garantías de no duplicación, caducidad y fencing antes de habilitar.
- Provider ACK no implica notificación recibida ni vista en dispositivo; hace falta ticket, receipts reales y tratamiento offline.
- Fixture G12 reproduce columnas mínimas de G10; **no demuestra migración sobre toda la cadena SQL G2→G10 ni políticas RLS completas**.
- No se ha probado push real, GPS real, app real en teléfonos, cuentas productivas, pagos, seguridad operacional o cumplimiento legal.
- Cualquier llamada a `sendToProvider` en G12 es inyectada en test/simulación, no push a usuarios reales.
- La oferta de moto-pasajero depende de análisis normativo y seguros por zona. Farmacia requiere regulación por categoría.
- Comisión 15% AUTO / 12% MOTO es hipótesis comercial del Owner, NO tarifa de mercado confirmada ni política de producción. Precios Bolt/Uber necesitan evidencia local vigente.
- No afirmar que Lovable solo aporta UI si faltan contratos de cliente, auth, navegación, manejo de errores, notificaciones y pruebas integradas.

## 6. PRÓXIMOS TRABAJOS — ORDEN DE EJECUCIÓN
**P0.1 — Consolidar integraciones reales CI:** inspeccionar HEAD, CI y esquema G2/G3/G4/G5/G10/G12; añadir prueba de migraciones completas en PostgreSQL 16 desechable (sin tablas ficticias mínimas), roles/grants/RLS, replay de carreras, expiraciones, fallos, idempotencia. Mantener pruebas rápidas y CI verde.
**P0.2 — Push delivery fiable:** cerrar recovery de claims huérfanos, retry/fencing o demostrar decisión explícita at-most-once y fallback de polling; validación de recepción, desconexión, expiración, worker reentrante; no duplicar oferta ni confirmar receipt sin dispositivo. Implementar adaptador provider falso en CI.
**P0.3 — Flujos E2E durables:** AUTO y MOTO legal-gated: cotización→solicitud→ranking GPS→oferta privada→aceptación única→datos conductor/vehículo/ETA→llegada→OTP→viaje→cierre; cancelar/rechazar/no-show/desconexión y reasignación. Envíos: recoger→custodia→prueba de entrega→fallo→retorno. Usar persistencia transaccional y autenticación de actor servidor.
**P0.4 — Merchant backend:** alta comercio, sucursales, catálogo, disponibilidad, carrito, orden, preparación, courier, sustitución, cancelación/reembolso simulado, soporte; farmacia con restricciones por categoría.
**P0.5 — Precios y economía:** matrices por vehículo, zona, km, minutos, mínimo, peajes, demanda, esperas, cancelación; costo de proveedor mapas/push/pagos; márgenes QORE y conductor; investigación competitiva local con fecha/fuentes; simulaciones PYG y casos borde; sin imponer un mismo precio a AUTO y MOTO.
**P0.6 — Seguridad y operaciones:** KYC/vehículos/seguros, RBAC, RLS, SOS, auditoría durable sin PII innecesaria, rate limiting, fraude, privacidad, métricas, observabilidad, errores, alertas y soporte.
**P1 — QA integrada:** clientes móviles Android/iOS de prueba, GPS con consentimiento, background restrictions, offline/reconnect, permisos, push sandbox, mapas/rutas, accesibilidad, carga, seguridad y facturación sintética; documentación API versionada y OpenAPI. Sin datos de usuarios reales.
**P1 — Lovable:** conectar pantallas pasajero, conductor, repartidor, comerciante, operador a backend ya probado; no delegar lógica económica/autorización al frontend; validación E2E de flujos.
**P2 — Preparación lanzamiento:** marco regulatorio Paraguay por zona, seguros, protección datos, pasarela y facturación, acuerdos conductores/comercios, estrategia geográfica, operación y soporte, métricas de piloto, rollback. Solo activar producción con autorización expresa.

## 7. DEFINICIÓN DE BLOQUEO REAL Y REGLAS DEL PRÓXIMO ARQUITECTO
1. **Trabajar, no repetir handoffs:** abrir archivos reales, implementar un cambio funcional con pruebas, commitear en rama, revisar CI, arreglar fallos, seguir con siguiente P0. No pedir confirmación por decisiones técnicas reversibles que respeten límites.
2. Bloqueo real: falta de permisos/credenciales, exigencia de autorización legal/financiera, riesgo de producción, acceso a infraestructura no autorizada o contradicción irreversible de producto. Documentar y pasar a tarea independiente.
3. No inventar ejecuciones, aprobaciones ni métricas. Registrar commit, ruta, PR, run, resultado. `SUCCESS` CI no equivale a producto listo.
4. Conservar todas las prohibiciones y PR DRAFT; no crear cuentas reales, migraciones remotas ni activaciones LIVE.
5. Si usuario pide autonomía completa, usar **ChatGPT Work** y herramientas conectadas disponibles; no prometer ejecución continua fuera de una sesión ni detenerse tras cada commit pequeño.
6. Prioridad absoluta: **backend funcional verificable, luego interfaz Lovable, luego piloto controlado sujeto a autorización**.

## 8. PRIMERA ACCIÓN EN EL NUEVO CHAT
Abrir este documento y el handoff WORK; verificar rama, PR #7, commit `73be6dfd`, runs PostgreSQL #4, Node #106 y Expo #600. Inspeccionar archivos SQL G10/G12 y worker; elegir un P0 funcional (recuperación de outbox o migración SQL integrada), implementar y validar en la misma sesión. **No reiniciar investigación ni solicitar al Owner información ya registrada.**
