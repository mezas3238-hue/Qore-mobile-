# QORE MOBILE — HANDOFF MAESTRO INTEGRAL
**Fecha:** 22 octubre 2026  
**Estado:** investigación y desarrollo STAGING, NO certificación de producción.  
**Repositorio exclusivo:** `mezas3238-hue/Qore-mobile-`  
**Rama de trabajo:** `feature/mobility-monorepo-isolated-20261016`  
**PR:** #7, DRAFT, NO MERGE.  
**Repositorio de trading `mezas3238-hue/qore-core`: NO TOCAR.**

## 1. Mandato del propietario
Construir QORE Mobile, plataforma nacional paraguaya de movilidad y logística, con activación gradual por zonas: automóvil con pasajeros; motocicleta con pasajeros solamente donde sea legal; documentos, paquetes y compras; entregas de restaurantes, farmacias, supermercados y comercios; viajes urbanos e interurbanos. Experiencia comparable o superior a Bolt/Uber, precios competitivos, mayor ingreso para conductores y rentabilidad comprobable de QORE. El propietario exige ejecución técnica real y continuidad sin planes repetitivos.

**Restricciones:** `LIVE_TRIPS_ENABLED=false`; sin producción, pagos reales, SQL remoto, migraciones remotas, push real, merge ni despliegue sin orden expresa. Solamente cuentas y escenarios sintéticos STAGING. No atribuir a Lovable, Supabase ni GitHub estados no verificados.

## 2. Infraestructura y antecedentes
- Monorepo `apps/mobility-expo/`: Expo SDK57 y componentes backend.
- PR #7 DRAFT en rama anterior. No fusionar.
- Lovable proyecto UI `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`; proyecto staging `9c677bb2-746b-419f-ad9c-dd6d26bab944`; workspace `806797cf7f14d2bab85d`. Sin créditos disponibles; propietario ordenó avanzar independientemente de Lovable.
- Supabase ref `hylgkfgkcyrddokloljm`: NO está probado que corresponda al backend de Lovable. Ref antigua `qdqrlgzlotnfdxzpacxs` PROHIBIDA. No ejecutar SQL remoto.
- Infraestructura preexistente: `server/g4-qore-radar-core.mjs` (GPS reciente, precisión, rutas, candidatos y ofertas privadas); `server/g4-staging-runtime.mjs` (loopback y fail-closed); SQL CI-only Postgres 16 en `docs/backend/staging_only/G3_AUTO_DEMO_TRIP_CONTRACT_POSTGRES_CI_ONLY.sql`, `G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`, `G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql`. Incluye atomicidad de aceptación, RLS/privilegios e idempotencia, pero NO equivale a instalación en una BD remota.
- `docs/backend/G3_G4_REMOTE_DEPLOY_GATE_REVIEW_2026-10-18.md` establece gates de seguridad. `docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_100_POR_CIENTO_2026-10-18.md` es antecedente. `docs/qa/STAGING_V3_CONDUCTORES_A_B_EVIDENCIA_2026-10-18.md` describe tres identidades ficticias, NO demuestra registros reales de vehículos ni RLS extremo a extremo.
- En Lovable se reportaron 109 pruebas correctas, pero build TypeScript fallido por opción `exact` en test; NO afirmar que la app está lista.

## 3. Trabajo nuevo publicado en GitHub en esta etapa
Todos los siguientes archivos están bajo `apps/mobility-expo/server/`. Se crearon archivos y tests, pero **no se ha confirmado CI para la mayoría ni integración real de extremo a extremo**. Commits abreviados:

| Módulo | Pruebas | Commits | Alcance real |
|---|---|---|---|
| `gps-staging-contract.mjs` | `gps-staging-contract.test.mjs` | `ab515719`, `1dc7eee6` | Consentimiento, frescura <=30 s, precisión <=75 m, enlaces Waze/Maps, adapter Routes sintético; CI de esta pareja sí se confirmó previamente |
| `fare-engine.mjs` | `fare-engine.test.mjs` | `d9756b1f`, `feb8a380` | Tarifas PYG versionadas AUTO/MOTO/DELIVERY/MERCHANT_DELIVERY, km/min/base/mínimo/peajes y comisión; no cobros |
| `delivery-staging.mjs` | `delivery-staging.test.mjs` | `db9fc91b`, `cef10547` | Paquetería sintética, límites moto/auto, estados de custodia |
| `dispatch-synthetic.mjs` | `dispatch-synthetic.test.mjs` | `3ab42f32`, `e36fce86` | Ofertas privadas y primer aceptante gana **solo en memoria/proceso único** |
| `dispatch-persistence-contract.mjs` | `dispatch-persistence-contract.test.mjs` | `a180dad1`, `d4ec2c4d` | Interfaz de repositorio, no adaptador SQL funcional |
| `staging-zone-policy.mjs` | `staging-zone-policy.test.mjs` | `dfc58f3c`, `bf221c97` | Política PY de zonas/servicios con geofence inyectado de prueba, nunca autoriza producción |
| `staging-driver-eligibility.mjs` | `staging-driver-eligibility.test.mjs` | `f04f5a6c`, `218edd3c` | Identidad, licencia, consentimiento, vehículo, seguro, vencimientos, moto permiso; no KYC real |
| `staging-operations-audit.mjs` | `staging-operations-audit.test.mjs` | `aa1573a4`, `84535250` | Eventos mínimos sin PII y secuencia sintética; no log durable |
| `staging-e2e-orchestrator.mjs` | `staging-e2e-orchestrator.test.mjs` | `412316fb`, `77dc239b` | Conecta zona, elegibilidad y despacho para simulación en memoria, no E2E dispositivos |
| `staging-ledger.mjs` | `staging-ledger.test.mjs` | `c41a785a`, `4c8e514c` | Doble partida sintética PYG para comisión/proveedor; sin liquidación, persistencia ni dinero |

**Advertencia técnica P0:** algunos tests nuevos fueron escritos sin ejecutar Node local/CI. Verificar nombres de exports, firmas, fixtures y resultados antes de continuar. En particular `staging-e2e-orchestrator.mjs` asume exports `createSyntheticDispatch` y `evaluateSyntheticZone`; `staging-ledger.test.mjs` asume export `quoteSyntheticFare` y forma del resultado. NO asumir que compilan. La comparación de asientos contables asume que `totalPyg = providerPyg + commissionPyg` y debe verificarse frente a peajes, impuestos, promociones y costos.

## 4. INVESTIGACIÓN TARIFARIA — MANDATO PRIORITARIO ACTUAL
El propietario corrigió expresamente el enfoque: **no basta con desarrollar módulos; hay que investigar cuánto cobran REALMENTE Bolt, Uber y otras empresas por automóvil y motocicleta en Paraguay, todos los casos, para definir el motor económico completo.** No usar una tarifa igual para auto y moto. Valores sugeridos en chats (AUTO base 5.000/km 2.000/min 200; MOTO base 2.500/km 1.000/min 100; comisión AUTO 15%, MOTO 12%) son **HIPÓTESIS NO APROBADAS** y no se deben activar.

### Evidencia discutida, requiere reconfirmación documental
- Bolt Paraguay publica comisión aprox. 23% AUTO y 20% MOTO en soporte regional; verificar vigencia, categorías y términos en fuente oficial.
- Reporte de prensa de julio 2025 menciona mínimo Bolt Moto alrededor de Gs. 7.200; otro reporte junio 2025 menciona Gs. 15.000 normal y Gs. 36.000 bajo neblina; NO son tarifas actuales ni generalizables.
- MotoTaxi Platform anuncia tarifa base Gs. 5.000 + Gs. 2.500/km y modelo de membresía anual Gs. 500.000 sin comisión; verificar fuente, cobertura, cargos, fecha.
- Reportes de eventos 2024 con automóvil Gs. 80.000/20 km y Gs. 100.000 centro-aeropuerto son anomalías de demanda, NO precio típico.
- Bolt/Uber: distancia, tiempo, tráfico, recogida, oferta/demanda, peajes, tarifas anticipadas y ajustes; no se conoce tabla confiable actual por km/min para Asunción ni todas las ciudades. No inventar cifras ni atribuirles precios sin cotización.
- No se ha realizado captura directa verificable de cotizaciones comparables en aplicaciones. La investigación está **ABIERTA**.

### Protocolo de investigación obligatoria
1. Matriz de 30+ rutas representativas (1–3, 3–5, 5–10, 10–20, >20 km), por Asunción/Gran Asunción, otras capitales departamentales y rutas interurbanas; categorías Bolt Auto/Moto, UberX/Uber Moto si disponibles, alternativas locales.
2. Repetir mismas coordenadas, fecha, hora y modalidad en horas normales, pico, noche, lluvia; registrar cotización visible, tiempo de recogida, distancia y duración estimadas, disponibilidad, suplementos, fecha y evidencia; **sin reservar viajes innecesarios**. No asumir que categorías están disponibles en todas las ciudades.
3. Calcular costo conductor por categoría: combustible, mantenimiento, seguro, depreciación, tiempo de espera, km vacíos hasta recogida, retornos interurbanos, peajes y tributación; obtener precios locales verificables.
4. Estimar ingresos/hora netos y margen QORE por escenario, con intervalos y sensibilidad; separar cobro al pasajero, comisión, propinas, impuestos, peajes, pasarela, promociones y compensaciones.
5. Investigar y documentar normativa municipal/de transporte, sobre todo legalidad de moto con pasajero y operación interurbana; no habilitar sin validación legal.
6. Definir política de tarifa mínima, precio anticipado, límites de demanda, cancelación, espera, no-show, desvío, recogida larga, peaje, retorno, envío por peso/volumen y condiciones de emergencia. Tarifa versionada por región, servicio y fecha; cambios auditables.
7. Solo tras evidencias y aprobación Owner, calibrar `fare-engine.mjs` y realizar simulaciones masivas; no confundir una simulación con datos reales.

## 5. Riesgos y fallas abiertas
**P0:** tests y contratos posiblemente incompatibles; no CI confirmada reciente; falta persistencia transaccional real; actorId de cliente no debe ser confiable (derivarlo de JWT validado servidor); zona usa callback `insidePolygon` simulado, sin PostGIS; aceptación en memoria no protege concurrencia multiinstancia; no comprobación de vínculo real entre oferta y elegibilidad al aceptar; no existe seguridad probada en BD remota; mapping Lovable-Supabase no verificado; no push real; no validación normativa de motos.
**P1:** sin GPS dispositivo conectado, sin Google Routes real/quotas/costos; sin onboarding KYC, revisión documental y vehículo real; sin trip state machine durable y eventos, sin sistema de seguridad SOS; sin recibos/cobros/ledger inmutable ni conciliación; sin app pasajero-conductor E2E; sin panel administrativo y comerciante.
**P2:** expansión nacional, idiomas, accesibilidad, privacidad/retención, antifraude, observabilidad, SLA, incidentes, pilotos regionales, soporte y finanzas.

## 6. Plan de ejecución priorizado para próximo arquitecto
**Fase A — inmediata:** revisar repo/branch y CI, ejecutar `node --test` sobre los tests existentes, arreglar incompatibilidades con commits y evidencia; preservar DRAFT. **En paralelo** hacer investigación tarifaria pública actual con citas y distinguir datos reales de hipótesis. Entregar matriz con fuente, fecha y zona.
**Fase B:** diseñar esquema Postgres/PostGIS STAGING con RLS deny-by-default, migraciones versionadas solo CI local, auth server-side y actor derivado de sesión; integrar solicitudes, ofertas, aceptación atómica, estados, outbox idempotente, GPS consentido y auditoría. Pruebas concurrentes y negativas. No ejecutar remoto.
**Fase C:** integrar app Expo en entorno controlado con 1 pasajero y 2 conductores ficticios en dispositivos independientes, push de prueba, tracking seguro, cancelación, llegada, inicio y fin; registrar video/logs y resultados reproducibles.
**Fase D:** motor tarifario completo por región y servicio, tabla calibrada con datos competitivos, simulación de casos extremos, ganancias netas de conductor, márgenes QORE y reglas de ajustes; revisión económica y legal.
**Fase E:** onboarding/vehículos, entrega y custodia, comercio, pagos/efectivo/conciliación, seguridad, administración, observabilidad, QA, accesibilidad y expansión.
**Fase F:** gates de seguridad, legal, operaciones, pruebas de campo y aprobación expresa antes de cualquier producción. Nunca declarar 100% antes de cumplir.

## 7. Condiciones de aceptación y forma de reportar
Por cada entrega: ruta exacta, commit, test ejecutado y resultado, evidencia CI, riesgo y siguiente bloqueo. Distinguir `código publicado` de `tests aprobados` de `backend desplegado` de `piloto validado`. Nunca decir que el usuario puede pedir viajes reales cuando no hay despliegue. Sin merge, sin live y sin pagos.

## 8. Enlaces de continuidad
- Rama: https://github.com/mezas3238-hue/Qore-mobile-/tree/feature/mobility-monorepo-isolated-20261016
- PR: https://github.com/mezas3238-hue/Qore-mobile-/pull/7
- Código server: https://github.com/mezas3238-hue/Qore-mobile-/tree/feature/mobility-monorepo-isolated-20261016/apps/mobility-expo/server

**Primera instrucción al siguiente arquitecto:** inspecciona exports y ejecuta tests, corrige lo roto; después investiga tarifas reales Bolt/Uber Auto/Moto Paraguay con evidencia contemporánea y construye matriz de escenarios. Priorizar decisiones económicas basadas en datos y persistencia real STAGING, no proliferación de módulos simulados.
