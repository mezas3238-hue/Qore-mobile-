# MOVETE FÁCIL / QORE MOBILE — HANDOFF MAESTRO PARA CHATGPT WORK
**Fecha:** 2026-10-22. **Propietario:** Owner QORE Mobile. **Destino:** siguiente arquitecto en ChatGPT Work.  
**Repositorio soberano:** `mezas3238-hue/Qore-mobile-`. **Rama:** `feature/mobility-monorepo-isolated-20261016`. **PR:** [#7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7).  
**NO TOCAR:** `mezas3238-hue/qore-core` (trading). **NO MERGE, NO LIVE, NO VPS, NO pagos reales, NO despliegue remoto, NO SQL remoto sin autorización explícita del Owner.**

## 1. MANDATO FINAL Y ORDEN DE EJECUCIÓN
Crear **Movete Fácil**, plataforma paraguaya de movilidad y logística, superior a Bolt/Uber en fiabilidad, claridad de precios, protección de usuarios, herramientas de conductores, cobertura y rentabilidad sostenible. Servicios:
1. AUTO: pasajeros, vehículos y conductores verificados; categorías y capacidad configurables.
2. MOTO: pasajeros solo donde normativa local y seguros lo permitan; jamás asumir autorización nacional.
3. ENVÍOS: documentos, paquetes y mensajería; moto/auto según dimensiones, peso y restricciones.
4. COMERCIO: supermercados, farmacias, restaurantes, tiendas, ferreterías y otros; pedido, preparación, recogida, cadena de custodia, entrega, devolución, incidencias y liquidación.
5. Zonas urbanas, suburbanas e interurbanas con geofences, cobertura por modalidad y expansión gradual; NO activar indiscriminadamente todas las zonas sin operación/legalidad.
**Secuencia vinculante:** primero desarrollar, probar y cerrar infraestructura, APIs, BD, seguridad, pricing, dispatch, logística, pagos simulados y operaciones **en QORE Mobile**; **después** diseñar/integrar la interfaz final con Lovable. No bloquear backend por créditos Lovable. Expo actual puede servir para pruebas técnicas, no adelantar rediseño UI.

## 2. ESTADO REAL VERIFICADO
- **Actualización Work R4:** G6 incorpora contrato persistente de comercios,
  sucursales, personal, catálogo, reserva/reposición de inventario, pedidos y
  preparación para supermercado/farmacia OTC/restaurante/retail/otros. El
  pedido se enlaza a G5 y solo avanza con los estados reales de custodia. Ya
  dispone de repositorio Supabase y cinco rutas HTTP autenticadas. Ver
  `docs/backend/G6_MERCHANT_CATALOG_ORDERS_2026-10-22.md`. Pruebas estáticas
  incluidas; 176/176 pruebas de servidor locales PASS y PostgreSQL 16
  desechable permanece como gate de ejecución SQL.
- **Actualización Work R3:** G5 añade entregas persistentes AUTO/MOTO con
  capacidad, habilitación privada de carga, seguro, GPS/consentimiento,
  asignación atómica, prueba obligatoria de entrega, disputa/devolución,
  auditoría append-only y RLS por participante. Incluye repositorio Supabase,
  cuatro endpoints autenticados y recorrido HTTP loopback. Farmacia queda
  limitada explícitamente a OTC. Ver
  `docs/backend/G5_PERSISTENT_DELIVERY_CUSTODY_2026-10-22.md`. Verificación
  local al implementar: 164/164 pruebas de servidor PASS; el workflow G1→G5
  PostgreSQL 16 desechable queda como autoridad de sintaxis/concurrencia SQL.
- **Actualización Work R2:** API HTTP local autenticada para crear solicitud de
  pasajero y ejecutar transiciones persistentes de conductor/pasajero. Usa el
  adaptador común y RPC SQL; no admite identidades declaradas en JSON. Ver
  `docs/backend/G4_AUTHENTICATED_TRIP_COMMANDS_2026-10-22.md`. Verificación:
  102/102 dominio, 150/150 servidor, TypeScript, guard NO-LIVE y export web PASS.
- **Actualización Work R1 (posterior al handoff):** se confirmó que
  `.github/workflows/mobility-ci.yml` ya ejecuta G1→G4 sobre PostgreSQL 16
  desechable, incluidas carreras de dos conductores y dos workers. El punto P0.1
  original estaba desactualizado. Se implementó y conectó el adaptador real
  `server/g4-supabase-dispatch-repository.mjs`: RPC transaccionales para
  request/offer/accept/transition y snapshot autorizado por participante
  persistido, no por IDs declarados por cliente. Ver
  `docs/backend/G4_SUPABASE_PERSISTENCE_ADAPTER_2026-10-22.md`. Verificación
  local: TypeScript PASS, 102/102 dominio, 145/145 servidor y safety guard PASS.
- Monorepo `apps/mobility-expo/` (Expo SDK 57, backend Node ESM `server/`).
- Workflow `QORE Mobility STAGING Node contracts`: **138/138 PASS, 0 FAIL**, run #40, commit `69dcf58b5b77be0b1a86f84c65ef0ad1f15c890f`, https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39833613306.
- Workflow `QORE Mobility Expo isolated CI`: **SUCCESS**, run #531, mismo commit, https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39833613454.
- **NO equivale a app funcional comercial**, no demuestra Postgres concurrencia real, dispositivos GPS, push real, onboarding/KYC, cobros ni piloto. CI Node prueba contratos mayormente sintéticos.
- Workflow adicional `.github/workflows/mobility-g4-postgres-disposable.yml` creado en `a9f43fd3`, con PostgreSQL 16 local de GitHub Actions y smoke inicial, **solo workflow_dispatch**; NO integra aún G2/G3/G4 ni demuestra carrera real.
- PR #7 DRAFT sin merge. Mantener.

## 3. HISTORIAL DE TRABAJO IMPLEMENTADO
### 3.1 Componentes previos y contratos de simulación
- `server/gps-staging-contract.mjs`: consentimiento, precisión y frescura GPS, enlaces Waze/Google Maps, rutas simuladas.
- `server/fare-engine.mjs`: tarifas sintéticas PYG para `AUTO`, `MOTO`, `DELIVERY`, `MERCHANT_DELIVERY`; base + distancia + tiempo + mínimo + peajes, comisión bps y regla versionada. NO se han fijado precios reales.
- `server/delivery-staging.mjs`: paquete, capacidad y estados de custodia sintéticos.
- `server/dispatch-synthetic.mjs`: solicitudes y ofertas privadas; primer aceptante gana **en memoria**, no multiinstancia.
- `server/dispatch-persistence-contract.mjs`: frontera de repositorio, validación de identidad y modo sintético; no es driver SQL completo.
- `server/staging-zone-policy.mjs`: restricciones de zona/servicio con geofence inyectado.
- `server/staging-driver-eligibility.mjs`: elegibilidad, vencimientos, licencias, seguros y modalidad; no verifica documentos reales.
- `server/staging-operations-audit.mjs`: auditoría sintética sin PII; no durable.
- `server/staging-e2e-orchestrator.mjs`: flujo sintético; no dispositivos reales.
- `server/staging-ledger.mjs`: asientos PYG sintéticos, no pagos ni liquidación.
- G4 existente: `server/g4-qore-radar-core.mjs`, `server/g4-staging-runtime.mjs`, `server/g4-loopback-http-transport.mjs`, `server/run-g4-local-staging-radar.mjs`.
- SQL CI-only `docs/backend/staging_only/G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`, `G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`, `G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql`; inspeccionar prerequisitos y orden real antes de instalar en Postgres desechable. RLS y RPC no están validadas en entorno remoto.

### 3.2 Endurecimiento reciente, commits reales
- `95762b88` / `6c5b9005`: conciliación y pruebas ledger.
- `4acac97b` / `703e5a28`: TTL oferta limitado por vencimiento de documentos y pruebas.
- `df24fce3` / `d302a529`: coherencia servicio conductor/viaje.
- `97f943ae` / `e2d6af99`: `createAuthenticatedStagingDispatchPersistence`, actor derivado de resolver de sesión en servidor, pruebas de spoofing.
- `d6eea470` / `d24744dd`: UUIDs, TTL y entradas de ofertas privadas.
- `8d9a44f6` / `27381836`: identidad de conductor al aceptar.
- `42a3e642` / `035c5665`: identidad pasajero, eventos y claves de transición.
- `ed1b0fda`: workflow Node; `7c61f678` intentó npm ci sin lockfile; `3b9b3185` corrigió instalación; `74e732ba` movió import Supabase después de comprobaciones locales de entorno. CI pasó 128/128 en run #8.
- `f4f9c055`: rechazo explícito de clave de decisión contradictoria en SQL G4.
- `2375a885`: tests estáticos de orden de locks, permisos e idempotencia SQL G4; CI pasó 131/131.
- `a9f43fd3`: workflow PostgreSQL 16 desechable inicial, sin integración G4; no asumir ejecutado.
- `5c2cf1ba` / `50057f12`: verificación integral de desgloses y comisión de tarifa; CI 133/133.
- `c803ffa2` / `ef0913d6`: validación de `ruleVersion`.
- `2923deaa` / `5e751c57`: ledger exige cotización íntegra, pruebas de manipulación.
- `27ad37f6` / `a3652ce3`: ledger restringe a tres cuentas sintéticas canónicas.
- `27e99dc1` / `d5d5a538`: entrada de cotización malformada falla cerrada.
- `7ebe64d4` / `0b1e5f07`: contrato persistencia rechaza entradas no objeto.
- `c099f4a8` / `69dcf58b`: snapshot exige identidad de participante declarada, tests; **P0: la identidad declarada NO basta**, SQL debe verificar contra el viaje persistido. Último CI 138/138.

## 4. ARQUITECTURA OBJETIVO — CONSTRUIR PRIMERO EN QORE MOBILE
**Backend y datos:** API versionada, autenticación validada en servidor, RBAC/ABAC, PostgreSQL+PostGIS, transacciones serializadas, RLS deny-by-default, idempotencia, migraciones reproducibles y reversibles, outbox + workers + reintentos, colas, rate limits, logs auditables y telemetría. Separar dominio `ride`, `delivery`, `merchant_order`, `payment`, `identity`, `fleet`, `support`, `pricing`, `geography`. Evitar microservicios prematuros; modular monolith válido.
**Roles:** pasajero, conductor auto, conductor moto, repartidor, comerciante, operador, soporte, admin; un usuario puede tener roles múltiples, autorizados en servidor.
**Ciclo viaje:** cotizar → solicitar → buscar cercanos elegibles → oferta privada TTL → aceptar exactamente un conductor → notificar pasajero con identidad/vehículo/ETA → llegada → recogida/OTP → viaje en curso → finalización → recibo, calificación, incidencia. Cancelación, rechazo, no-show, pérdida GPS, conductor desconectado, reasignación y disputa con máquina de estados durable.
**GPS/routing:** consentimiento, foreground/background conforme plataforma, expiración, precisión, geofence PostGIS, matching de candidatos, ETA, mapa, navegación Google Maps/Waze, proveedor de rutas intercambiable, caché/costos; jamás exponer coordenadas precisas innecesariamente.
**Logística:** remitente/destinatario, peso/volumen, categoría, vehículo permitido, artículo restringido, recogida, foto/OTP con consentimiento, prueba de entrega, reintentos, devolución, extravío, cobertura de seguro, entrega fallida.
**Comercios:** alta/validación de supermercado/farmacia/restaurante/tienda, sucursales, catálogo e inventario, carrito, horarios, sustituciones, preparación, courier asignado, tracking, entregas parciales, devoluciones y soporte. Farmacias: revisar prescripción, medicamentos controlados, cadena de frío y habilitación antes de permitir categorías; no implementar venta indiscriminada.
**Economía:** cotizaciones transparentes y separadas AUTO/MOTO/PAQUETE/COMERCIO, reglas por ciudad/zona/hora, peajes, recogida, espera, cancelación, promociones, impuestos, precio mínimo, tarifa anticipada, topes anti-abuso; ganancias conductor y margen QORE visibles. Comisiones **15% auto y 12% moto solo como hipótesis de negocio a aprobar**, no tarifa implantada ni dato de Bolt/Uber. Comisiones delivery/comercio requieren modelo propio.
**Cobros:** efectivo y pasarelas locales evaluadas, autorización/captura, conciliación, reembolsos, saldo conductor/comercio, facturas, fiscalidad PY, chargebacks, antifraude; implementar mocks primero, no dinero real.
**Operaciones:** consola de soporte, incidentes, SOS, verificación conductor/vehículo, revisión manual, bloqueo por fraude, privacidad, retención, acceso a datos, métricas de SLA, alertas, pruebas de carga, accesibilidad y expansión geográfica.

## 5. SUPERIORIDAD COMPETITIVA — MEDIR, NO AFIRMAR
Diseñar diferenciadores verificables: menor comisión sostenible, mayor ingreso neto/hora de conductor, precio anticipado transparente sin sorpresas, seguridad y verificaciones, matching justo por ETA/calidad y no solo cercanía, modo de bajo consumo de datos, soporte humano y resolución rápida, entregas multisectoriales, portal comerciante, múltiples paradas/paquetes, estimación de llegada y comprobantes claros. Definir KPIs: tasa de aceptación, tiempo hasta conductor, pickup ETA p50/p95, cancelaciones, cumplimiento, entregas a tiempo, ganancias netas por hora, margen contribución por modalidad, NPS, incidentes/1000 viajes. Nunca afirmar que supera Bolt/Uber sin comparación medida.

## 6. INVESTIGACIÓN DE PRECIOS OBLIGATORIA
No hay matriz de cotizaciones directas verificadas de Bolt/Uber Paraguay; los valores publicados en chats son hipótesis. Levantar 30+ rutas y varias franjas horarias, auto/moto por ciudad, competidores disponibles, cotización capturada con fecha, condiciones y fuentes; estudiar costos reales de combustible, mantenimiento, depreciación, peajes, tiempo vacío, seguridad, comisión, impuestos, pasarela y promociones. Simular 1/3/5/10/20/30+ km, pico, lluvia, noche, interurbano, multi-stop, entrega pequeña/grande, comercio con sustituciones y retorno. No cobrar igual a auto y moto por defecto. Aprobar tabla versionada antes de habilitar uso real.

## 7. BLOQUEOS / RIESGOS CONCRETOS
**P0**
1. **RESUELTO en el workflow principal:** PostgreSQL 16 desechable prueba carreras G3/G4 con dos conductores y outbox con dos workers. El workflow manual separado sigue siendo solo smoke y no debe citarse como única evidencia.
2. **RESUELTO para runtime local G4:** actor derivado de sesión y snapshot filtrado en BD contra pasajero/conductor persistidos. Falta ampliar el mismo patrón a todos los endpoints nuevos.
3. **PARCIAL AVANZADO:** adaptador Supabase implementa `request/offer/accept/transition/snapshot`; status, request, accept y transition ya están conectados a HTTP local autenticado. Persisten gates de despliegue remoto, dispatch automático, zonas legales y pruebas con JWT/dispositivos reales.
4. **PARCIAL AVANZADO:** envíos ya tienen contrato PostgreSQL, adapter y API
   autenticada; faltan despacho automático de couriers, prueba/OTP almacenada
   de forma privada, incidencias operativas y dispositivos reales.
5. Sin backend conectado a dispositivos, push ni GPS reales; NO declarar MVP funcional.
6. Sin decisión documentada sobre licitud moto-pasajero y entregas farmacéuticas por municipio/categoría.
7. No se ha demostrado un flujo económico real ni integridad de cobros, reembolsos, saldos y liquidaciones.
**P1**
8. Datos y precios competitivos contemporáneos insuficientes; falta modelo económico por servicio.
9. Onboarding/KYC, documentos/vehículos, verificación, seguros, SOS, soporte, prevención de fraude y privacidad.
10. Catálogo comercial, inventario, pedidos, preparación, sustituciones y portal comerciante; entrega/retorno base ya persiste en G5.
11. Escalabilidad, disponibilidad, observabilidad, contingencia de GPS, notificaciones y pasarelas.
12. Faltan apps reales piloto pasajero/conductor/comerciante y pruebas de dispositivos Android/iOS.
**P2**
13. Cobertura nacional, acuerdos comerciales, idiomas, accesibilidad, operaciones, marketing y crecimiento.

## 8. ROADMAP EJECUTABLE Y CRITERIOS DE SALIDA
**G0 / integridad (inmediato):** inspeccionar rama, PR, últimas CI y árbol; verificar 138 tests y reproducir; mantener tests sin regresiones. Corregir workflow PostgreSQL (SQL quoting y automatización) y conectar fixtures. No invertir ciclos solo en añadir validaciones triviales cuando falta integración.
**G1 / DB real CI:** instalar G2→G3→G4 sobre PostgreSQL 16 desechable, roles auth/service simulados, fixtures de pasajero, dos conductores y vehículos. Pruebas paralelas: exactamente una aceptación, segunda rechazada; reintentos idempotentes, oferta expirada, conductor inelegible, cancelación, fanout, permisos RLS y snapshot no autorizado. CI automático verde. Si dependencias SQL faltan, inventariar y resolver en rama, no usar BD remota.
**G2 / backend:** implementar adaptador PostgreSQL real, API autenticada y contratos OpenAPI, state machine durable, outbox, worker y pruebas de integración; secretos fuera de repo.
**G3 / servicios:** implementar módulos completos AUTO, MOTO (legal gate), ENVÍOS, COMERCIO (supermercados, farmacias con controles regulatorios, restaurantes y tiendas), con flujos positivos/negativos E2E.
**G4 / precios:** investigación verificable, motor parametrizable por servicio/zona, simulaciones, costos y márgenes, aprobación Owner.
**G5 / operaciones:** KYC, flota, soporte, seguridad SOS, auditoría, administración, merchant dashboard, pagos simulados y reconciliación.
**G6 / QA:** dispositivos y cuentas sintéticas, GPS real solo entorno permitido, pruebas push de prueba, carga, seguridad, UX técnica, trazabilidad, pilot readiness; nunca confundir staging con LIVE.
**G7 / Lovable al final:** cuando backend/APIs/servicios/seguridad estén probados, integrar y diseñar interfaz de pasajero, conductor, repartidor, comercio y admin en Lovable; contrato API como fuente, no lógica económica oculta en UI.
**G8 / producción:** solo tras aprobación expresa del Owner, revisión legal, financiera, privacidad y seguridad, certificación y plan de rollback; activación gradual por zonas.

## 9. INSTRUCCIÓN OPERATIVA A CHATGPT WORK
Trabaja de forma continua y autónoma en QORE Mobile; no te detengas a repetir roadmaps ni a pedir confirmaciones para cambios **aislados y reversibles en la rama DRAFT**. Para cada lote: inspecciona código, implementa funcionalidad real, añade pruebas, ejecuta CI, corrige fallos, deja commits y documentación; reporta SHA, archivos, pruebas y bloqueos. Detente a pedir permiso solo ante **bloqueo externo real**, necesidad de credenciales/acceso, gasto, operación irreversible, despliegue, migración remota, merge o producción. No afirmar éxito sin logs. Preserva propiedad intelectual y no exponer claves/PII.
**Primera tarea técnica recomendada:** corregir y ejecutar CI PostgreSQL 16 desechable con fixtures G2/G3/G4 y prueba de carrera de dos aceptaciones. Después adaptador transaccional y backend, no proliferación de mocks.
**Primera tarea de producto en paralelo:** especificación de envíos y comercios por vertical (supermercado/farmacia/restaurante), límites legales y matriz de tarifas reales.

## 10. ENLACES
- Repo/branch: https://github.com/mezas3238-hue/Qore-mobile-/tree/feature/mobility-monorepo-isolated-20261016
- PR #7: https://github.com/mezas3238-hue/Qore-mobile-/pull/7
- Handoff previo: `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_INTEGRAL_TARIFAS_INFRAESTRUCTURA_2026-10-22.md`
- Node CI 138/138: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39833613306
- Expo CI success: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39833613454

**Regla final:** el objetivo no es producir documentos o más mocks: es entregar una plataforma Movete Fácil realmente funcional, verificable y segura, primero en QORE Mobile y solo después la interfaz Lovable. El estado actual es STAGING, NO LIVE.
