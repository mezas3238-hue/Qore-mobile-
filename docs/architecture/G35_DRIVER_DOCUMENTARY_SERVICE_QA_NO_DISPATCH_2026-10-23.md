# G35 — Verificación documental de Driver por servicio (QA)

**QORE Mobile / Movete Fácil · 23 de octubre de 2026 · Arquitecto A · PR #7 DRAFT**

## Por qué se añadió

El diagnóstico G33 cuenta señales de ubicación recientes y Driver con consentimiento y sin viajes/envíos activos. Eso **no demuestra** que su vehículo ni sus licencias estén vigentes. Se detectó el riesgo de interpretar `consentingIdleCandidates` como autorización para recibir pasajeros o paquetes.

G35 introduce un **diagnóstico documental independiente, exclusivamente privado y sintético**. No se modifica G33 ni se cambia ninguna ruta/DTO del Admin Web del Arquitecto B; `admin.zones.read` mantiene su alcance, pero **no se habilita** comercialmente.

## Infraestructura implementada

- `apps/mobility-expo/docs/backend/staging_only/G35_DRIVER_DOCUMENTARY_READINESS_POSTGRES_CI_ONLY.sql`: función `mobility_stage_g35_driver_documentary_diagnostic(admin,driver,zone,service,anchor_ms)`, instalable **únicamente en PostgreSQL 16 descartable**. Solo `service_role` ejecuta la función, y dentro del SQL se comprueba de nuevo el Admin activo/exclusivo de G27 con permiso `admin.zones.read`. La función requiere G1/G2/G3/G5/G17/G20/G27/G31/G32/G34.
- La evidencia `hasFreshQuarantinedSignal` procede exclusivamente del **último evento global de G32** de ese Driver, su zona y su servicio, dentro de 30 segundos. `hasCurrentLocationConsent` exige consentimiento activo **y la misma revisión de G34** que corresponde a esa señal; tras retirar y volver a autorizar GPS, una señal antigua ya no sirve.
- `freeOfActiveAssignments` requiere el rol **exclusivo Driver**, `driver_locations.available` observado durante los últimos 60 segundos, **sin** carrera G3 en `accepted/arriving/in_progress` ni reparto G5 en `accepted/picked_up/disputed`, aunque la señal corresponda a otra clase de servicio.
- `vehicleDocumentEvidenceReviewed` exige `mobility_stage_driver_current_license_approved` (G20, último documento G17 realmente aprobado), licencia G2 vigente y revisada por Admin independiente. Para `AUTO_RIDE` se reutiliza `mobility_vehicle_preflight` de G20: vehículo AUTO aprobado, inscripción, inspección, seguro para pasajeros, autorización municipal y revisiones actuales. Para `AUTO_DELIVERY` y `MOTO_DELIVERY` se exige vehículo de clase correspondiente, sin rechazo/suspensión, clearance **de carga G5 separado del permiso de pasajeros**, seguro de carga vigente, verificación temporal y revisor Admin no relacionado con el Driver. Las motos de G2 mantienen `moto_pasajero` como tipo histórico, pero **este contrato jamás concede viajes de pasajeros en moto**.
- La salida privada tiene **diez propiedades booleanas/metadatos** sin DriverId/GPS/matrícula/documentos: `source`, `hasFreshQuarantinedSignal`, `hasCurrentLocationConsent`, `freeOfActiveAssignments`, `vehicleDocumentEvidenceReviewed`, `candidateEvidenceComplete`, `zoneEligibleByPolicy`, `availabilityConfirmed`, `dispatchAuthorized`, `productionEnabled`.
- El `candidateEvidenceComplete` interno es una **conjunción de verificaciones de laboratorio, no una decisión comercial**. Los campos `zoneEligibleByPolicy`, `availabilityConfirmed`, `dispatchAuthorized` y `productionEnabled` son siempre `false`. Nunca se escribe ni se incrementa `mobility_stage_g31_zone_observations`. No se abre una ruta HTTP nueva.
- `apps/mobility-expo/server/g35-private-driver-evidence-qa.mjs`: puerta privada en forma de función **sin listener**. Verifica JWT con adaptador de servidor independiente, Admin exclusivo/permiso SQL G27, limitador, MFA AAL2 de proveedor unido a sesión y salida estrictamente cerrada. Rechaza inconsistencias, PII, autorización/despacho falsos y errores de SQL; proveedores actuales **sintéticos**. Nunca envía la clave `service_role` a móvil o navegador.

## Evidencias de QA

- `G35_DRIVER_DOCUMENTARY_READINESS_ASSERT_POSTGRES_CI_ONLY.sql`: se usan cuentas, auto, motocicleta, revisión de documentos, seguro de carga y geolocalización completamente **sintéticos** con `ROLLBACK`. Antes de verificar el documento el candidato falla; luego de aprobar mediante RPC G17 auténtico y con seguro vigente, el candidato puede superar el *control interno de evidencia*, **pero sigue prohibida su activación comercial**. Un viaje en curso, un seguro de carga vencido o una revocación de consentimiento obligan a denegar. No se puede tomar señal AUTO_DELIVERY para MOTO_DELIVERY, ni una habilitación de carga convierte una moto en moto pasajero.
- `g35-private-driver-evidence-qa.test.mjs`: rechaza Owner, rol mixto no certificado, JWT falso/revocado, MFA caducada o asociada a otra sesión, límites de tasa, tipo `MOTO_PASAJERO`, identificadores malformados, PII en DTO y falsas autorizaciones.
- El workflow G4 PostgreSQL aplica G35 **después de G34** y sigue sin conectarse a ningún SQL de producción o STAGING remoto.

## Pendientes bloqueantes antes de operar

1. Proveedores reales de JWT/revocación y MFA AAL2; antifalsificación GPS/attestation del dispositivo, geocercas documentadas y licencias de geodatos válidas para municipios paraguayos. Solo proveedores sintéticos aprobados en este QA.
2. Pruebas de elegibilidad por solicitud concreta (pasajero o carga), vehículo activo seleccionado, dimensiones/peso, tarifa/seguro por riesgo, occupancy multi-servicio, zona y respuesta efectiva a una oferta en una transacción atómica.
3. Política municipal y legal que permita pasar de `eligible_by_policy=false` a TRUE de manera auditada; ninguna tabla G31 permite activarlo por el momento.
4. Conciliación comercial real para Owner Finance. G7 es dinero simulado: **ningún ingreso debe mostrarse como efectivo**.
5. Certificación de HTTPS STAGING, retención/privacidad de ubicación y expedientes, E2E Android/iOS, con autorización escrita del Owner. No publicar estas verificaciones de Driver en un endpoint Admin Web que muestre PII.

**Gobernanza:** PR #7 y PR #8 siguen DRAFT; no merge, LIVE, PSP, VPS, SQL remoto ni despliegue. No se editaron los archivos del Arquitecto B. La coordinación se centraliza en issue #9.
