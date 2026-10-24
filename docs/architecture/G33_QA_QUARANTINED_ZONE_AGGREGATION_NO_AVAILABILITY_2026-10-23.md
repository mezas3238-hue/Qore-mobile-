# G33 / G32.3 — Agregación diagnóstica de señales Driver en cuarentena

**QORE Mobile — Movete Fácil · Arquitecto A · 2026-10-23**  
Rama: `feature/mobility-monorepo-isolated-20261016` · PR #7 DRAFT. No merge, LIVE, pagos, VPS, SQL remoto, información personal real ni despliegue.

## Objetivo y resultado

G32 registra señales sintéticas de localización verificadas mediante adaptadores de QA en una **cuarentena privada**. G33 permite analizar, **sin publicarlas**, cuántas de esas señales siguen recientes por zona y tipo de servicio, y cuántos Driver tienen a la vez rol exclusivo, consentimiento de ubicación vigente, estado `available` observado recientemente y **ningún viaje ni entrega activa**. El cómputo es un diagnóstico, NO un despacho ni una afirmación de disponibilidad certificada.

Se implementó:

1. `apps/mobility-expo/docs/backend/staging_only/G33_QUARANTINED_ZONE_DIAGNOSTICS_POSTGRES_CI_ONLY.sql`. RPC `mobility_stage_g33_quarantined_zone_diagnostic(admin,zone,service,anchor)` de sólo lectura, restringido a `service_role` del backend y rol Admin exclusivo con `admin.zones.read` (G27). Verifica zona/servicio que existan en G31 y una ventana de consulta de hasta 60 segundos. Requiere G1, G3, G5, G27, G31 y G32 en PostgreSQL 16 **descartable**.
2. Se une `g32_signal_state` con el **último evento global por Driver** de `g32_signal_quarantine`, evitando contar en dos municipios/servicios tras un cambio de zona. Sólo se cuentan señales capturadas en los últimos 30 segundos y persistidas antes del ancla. No se suman todas las entradas históricas ni se impone un límite total a los registros almacenados.
3. De las señales recientes, la segunda métrica aplica **nuevamente** el consentimiento no revocado, rol único `driver`, `driver_locations.available=true` con timestamp de hasta 60 segundos, ausencia de auto-viaje activo (`accepted/arriving/in_progress`) y ausencia de entregas activas/disputadas (`accepted/picked_up/disputed`). Esta comprobación **no reemplaza** KYC completo, condiciones legales, geocerca real, antidetección de suplantaciones o prueba de voluntad de aceptar un viaje. Por eso se llama `consentingIdleCandidates`, no «conductores disponibles».
4. Los diez campos de la respuesta son: `zoneId,serviceKind,source,observedAtMs,quarantinedRecentSignals,consentingIdleCandidates,availabilityConfirmed,dispatchAuthorized,publishedToG31,productionEnabled`. Los cuatro últimos indicadores son siempre `false`; `source=QA_G32_QUARANTINE_ONLY`. Ningún resultado incluye UUID de Driver, GPS, matrícula, teléfono o identidad. **No escribe en `g31_zone_observations`**, no afecta el Admin Web de B ni las apps Cliente/Driver.
5. `apps/mobility-expo/server/g33-private-zone-diagnostic-qa.mjs`. Función privada sin listener, únicamente `isolated_staging` y `liveEnabled=false`. Exige token validado en proveedor inyectado, rol y scope SQL G27, limitador, atestación MFA independiente AAL2 asociada a la misma sesión, y verifica forma estricta de las diez propiedades SQL; nunca transforma errores de fuentes en ceros ni declara disponibilidad real. Los adaptadores concretos actualmente utilizados en tests son **sintéticos**, no proveedores LIVE.
6. `G33_QUARANTINED_ZONE_DIAGNOSTICS_ASSERT_POSTGRES_CI_ONLY.sql`: transacción de prueba con siete Driver sintéticos, dos zonas, seis señales recientes y una antigua; incluye ocupación en viaje, ocupación en entrega, consentimiento revocado, Driver desconectado, traslado de zona y cambios posteriores de consentimiento. Valida `quarantinedRecentSignals=5` y `consentingIdleCandidates=1` en zona origen; uno trasladado únicamente a la zona nueva; al revocar consentimiento adicional quedan cero candidatos idóneos. Pruebas negativas: usuario no Admin, `MOTO_PASAJERO`, ancla de tiempo vencida y cambios no autorizados en G31. **Todos los fixtures hacen ROLLBACK**.
7. `g33-private-zone-diagnostic-qa.test.mjs`: JWT inválido/caducado, Owner, scope denegado, MFA falsa o atada a otra sesión, limitador caído, consulta malformada y posibles inyecciones de datos PII o falso estado `availabilityConfirmed=true`.

## Reglas de seguridad no negociables

- **Cobertura geográfica ≠ disponibilidad observada ≠ elegibilidad legal ≠ consentimiento de aceptar una carrera ≠ despacho.**
- G33 no publica sus candidatos a G31. La lectura de `GET /v1/staging/admin/zones/overview` de B conserva solamente observaciones QA de G31, con caducidad 60 segundos, `availabilityConfirmed=false` y `eligibleByPolicy=false`. El proyecto no dispone aún de señal móvil/GPS y geocercas comerciales con verificación externa.
- Una señal que antes fue aceptada deja de ser candidata inmediatamente al revocar consentimiento; los conteos son diagnósticos derivados y no un ledger de consentimiento versionado certificado.
- Esta consulta es **interna de QA**, NO un sexto endpoint público. No debe abrirse en HTTP ni entregarse a Admin Web hasta autorizar expresamente el STAGING real, completar IAM/MFA y revisar privacidad/legalidad/retención.
- El conteo de candidatos NO certifica que el Driver tenga vehículo aprobado, seguro vigente, habilitación municipal, GPS honesto o ausencia de un segundo tipo de ocupación aún no modelado. La promoción de eventos G32 a disponibilidad G31 sigue bloqueada.

## Pendientes prioritarios

1. **G33.2:** versionar consentimientos con historial auditable, revocación serializada e invalidación de sesiones de telemetría; normalizar ocupación multi-servicio y certificación KYC de vehículos AUTO/MOTO_DELIVERY sin confundir moto pasajero.
2. **G33.3:** geocercas georreferenciadas paraguayas verificadas y un proveedor de atestación/anti-spoof de ubicación real; seguridad y consentimiento GPS en Android/iOS, sin datos sensibles en logs.
3. **A04.3:** autenticación y MFA reales, rotación de secretos, rate limits compartidos, HTTPS STAGING aislado y aprobación del Owner antes de desplegar.
4. **A05.6:** auditoría completa de cambios de zona, cambios de tarifario, acceso a KYC, operadores, consentimientos y antifraude, incluida política legal de retención.
5. **Finanzas Owner** debe continuar bloqueada hasta conciliar ingresos de operación legítima. G7 tiene pagos simulados; nunca presentarlos como ingresos comerciales.

## Handoff A/B

La rama A conserva `apps/mobility-expo/**`, `docs/architecture/**`, `.github/**`. La rama del Arquitecto B conserva `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. No editar ni sincronizar forzadamente la rama B. Comentar resultados exactos en issue #9 y mantener PR #7 y PR #8 DRAFT, no merge.
