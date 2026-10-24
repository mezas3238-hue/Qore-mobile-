# G31 / A05.5 — Cobertura por zonas y disponibilidad observada (QA)

**Fecha:** 23 de octubre de 2026 · Arquitecto A · PR #7 DRAFT · no merge, LIVE ni SQL remoto.

## Arquitectura entregada

La fuente soberana de este bloque es PostgreSQL 16 desechable y código backend A. Las dos aplicaciones móviles siguen físicamente separadas: Driver (A) y Cliente (B); el Admin Web es exclusivo del Arquitecto B. Ninguna tabla fue aplicada a Supabase remoto.

**Catálogo `mobility_stage_g31_zone_coverage`:** zona UUID + servicio `AUTO_RIDE`, `AUTO_DELIVERY` o `MOTO_DELIVERY`, municipio, país `PY`, `coverage_status` de `ACTIVE`, `PLANNED`, `PAUSED` o `CLOSED`, revisión y fuente explícita `SYNTHETIC_STAGING_REVIEWED`. La tabla **no** representa una autorización nacional o municipal para operar. El constraint `eligible_by_policy=false` impide que una fila `ACTIVE` habilite comercialmente transporte, repartos o pasajero en motocicleta.

**Observaciones `mobility_stage_g31_zone_observations`:** muestras sintéticas inmutables asociadas a zona+servicio, con fecha de observación y conteo de vehículos de guardia. No guardan GPS, contactos, matrículas ni identidades de conductores. Son observaciones de QA, **NO disponibilidad real**. No se otorga a `anon`, `authenticated` ni `service_role` capacidad INSERT/UPDATE sobre la tabla; un futuro pipeline real exige una fuente comprobable con permisos mínimos y auditoría.

**RPC `mobility_stage_g31_admin_zone_page(uuid,bigint,text,integer)`:** exclusivamente servidor (`service_role`) y `admin.zones.read` con rol activo, separado y sin otra identidad nativa. Cursor de página de 50, descendente por el par `(zoneId, índice de servicio)`, y HMAC de usuario/sesión/scope del gateway G27. **50 es el tamaño de página, NO un tope de registros, zonas ni municipios**. RLS habilitado y función no ejecutable desde navegadores.

### Interpretación de disponibilidad: principio crítico

- Los campos de respuesta son exactamente `zoneId, municipality, serviceKind, coverageStatus, eligibleByPolicy, onDutyVehicles, availabilityObservedAt`. **No** se agregó un campo que rompa el contrato del Arquitecto B.
- Una muestra *reciente* es aquella cuya edad al ancla de lectura es **hasta 60 segundos**, igual que el proyector `apps/movete-admin/src/zone-overview.mjs` del Arquitecto B. Una muestra más vieja queda inválida para mostrar presencia actual.
- Si no se ha recibido una muestra, la muestra venció o falta un canal real de observación: se devuelve `onDutyVehicles=0` y `availabilityObservedAt=0` como **sentinela de DESCONOCIDO**, **no como evidencia de cero choferes disponibles**. La vista del Arquitecto B calcula `availabilityFresh=false` y `onDutyVehicles=null` para este sentinela; jamás debe etiquetarlo como disponibilidad cero confirmada.
- Incluso ante una observación fresca `onDutyVehicles>0`, `eligibleByPolicy=false` y `availabilityConfirmed=false`: observar guardia no prueba consentimiento actual para aceptar viajes, ubicación precisa, póliza, KYC, límites operativos ni aceptación de una oferta.
- No se mezcla `MOTO_DELIVERY` con `AUTO_RIDE`, ni se introduce `MOTO_PASAJERO` como servicio comercial válido. El servicio de moto pasajero permanece bloqueado por legalidad/seguro.

### Evidencia automatizada

- `G31_ADMIN_ZONE_COVERAGE_ASSERT_POSTGRES_CI_ONLY.sql`: 121 combinaciones reales de SQL en una transacción que hace ROLLBACK, páginas 50/50/21 sin repeticiones. Prueba AUTO y MOTO_DELIVERY en la misma zona, una muestra AUTO fresca de 7, una MOTO fresca de 3, muestras vencidas de 10 minutos y 70 segundos, y zonas sin observación. Todas las filas siguen `eligibleByPolicy=false`. Intenta lectura como Owner, sesión con rol pasajero duplicado, cursor alterado y tamaño de página 51; todo se rechaza.
- `G31_ADMIN_ZONES_30030_ROWS_ASSERT_POSTGRES_CI_ONLY.sql`: prueba de **30.030 combinaciones zona-servicio**, 601 páginas completas con cursor, sin salto, sin techo de 50 global y sin inferir guardias. Registra duración del ensayo pero no declara compromiso SLA comercial.
- `g28-backoffice-sql-read-repository.mjs` y `g28-backoffice-qa-composition.mjs`: conexión al RPC privado G31 en servidor de QA sólo `127.0.0.1`, con suites Node para DTO, keyset y prohibición de Owner Finance. JWT/MFA son **adaptadores sintéticos inyectados**, no certificación de autenticación de proveedor ni un HTTPS desplegado.

## Limitaciones reales y próximos bloques

1. Modelo de polígonos geográficos validado, versiones, municipios reales de Paraguay y licencias de geodatos: **aún no certificado**. No poblar todas las zonas reales mediante suposición.
2. Observaciones de conductores con consentimiento, TTL, exactitud de GPS, pertenencia a zona verificable, detección de telemetría falsificada, pérdida de señal, cambios de elegibilidad y exclusión de conductores en servicio: **aún no integradas**. Este bloque solo crea la estructura y prueba el aislamiento.
3. Índice de expresión en clave zona+servicio: se usa para buscar continuaciones con el orden exacto que requiere B; falta medir planes, latencias y presión de escritura en un entorno STAGING aprobado. Que el stress de CI sea verde no demuestra capacidad comercial nacional.
4. Contratos de activación por zona requieren doble revisión normativa/operativa antes de cambiar `eligibleByPolicy=false`. Las zonas marcadas `ACTIVE` aquí son sintéticas.
5. `owner.finance.read` permanece denegado: ledger G7 de pagos simulados no es recaudación conciliada real. El Admin Web del Arquitecto B sigue en `enabled=false` / `certifiedContracts=[]` hasta JWT/MFA con proveedor real y HTTPS STAGING autorizado.
6. Falta ampliar el registro de auditoría G30 para actos del panel de zonas, modificaciones de permisos, observaciones, tarifario, finanzas y comprobación antifraude, sin PII.

**Siguientes tareas A:** cerrar pruebas de rendimiento G31; añadir invariantes de origen de muestras (evitar contaminación de zonas); diseñar verificador de telemetría auténtica y A04.3 Auth/MFA de proveedor sin desplegar; coordinación vía issue #9, sin tocar `apps/movete-admin/**`, `apps/movete-cliente/**` ni `docs/architect-b/**`.
