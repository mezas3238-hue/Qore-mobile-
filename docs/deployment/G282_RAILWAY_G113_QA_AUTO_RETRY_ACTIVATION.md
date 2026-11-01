# G282 — Railway G113 automático, activación segura y reversible (STAGING)

**Estado:** PR DRAFT, NO DESPLEGADO. Railway actual no está ejecutando
G113 periódico. Supabase STAGING `mrjzxftsdxzepzbcuids` recibió la
migración `g281_g269_g113_private_auto_dispatch_pg17` mediante
`apply_migration`, comprobada con `processed=0`, `commercialEnabled=false`.

## Comportamiento implementado

En el arranque oficial de Railway, la programación de reintentos G113
permanece **OFF por defecto**. Al habilitarse expresamente, el arranque:
1. Exige Railway STAGING, modo no comercial y condiciones explícitas
   del operador para ruteo verificable, revisión Driver y tarifa Owner.
   **Estos flags no equivalen a prueba real:** las verificaciones legales,
   consentimiento y radio continúan siendo indispensables en SQL.
2. Mantiene la prueba G256 del entorno y el cierre del registro público.
3. Prueba la existencia de la RPC privada con el presupuesto inválido
   `_limit=0`: únicamente `P2694` demuestra que la función correcta
   está disponible al backend. Esta consulta no consume ningún trabajo.
4. Prepara el runtime G4 existente con `autoDispatchRetryQa:true`.
   Arranca la instancia G113 solo después de que Railway escuche.
5. Ejecuta automáticamente lotes de hasta cinco trabajos cada 30 s,
   con bloqueo `FOR UPDATE SKIP LOCKED` en PostgreSQL. El worker
   preexistente detiene su intervalo en `SIGTERM` / `SIGINT`.
6. No expone API Admin para lanzar viajes, ni crea KYC, ruta, vehículo,
   consentimiento, tarifas, cuentas, transacciones, pagos ni identidad.

## Variables de operador (no establecer todavía)

En la configuración privada de **Railway STAGING**, solo después de
certificar en su origen independiente cada requisito real:

```text
QORE_G113_AUTO_RETRY_QA_APPROVED=true
QORE_G269_ROAD_EVIDENCE_READY=true
QORE_DRIVER_COMPLIANCE_READY=true
QORE_OWNER_AUTO_FARE_PUBLISHED=true
```

Las variables ya obligatorias `QORE_STAGING_PROJECT_REF`,
`QORE_MOBILITY_ENV=staging`, `RAILWAY_ENVIRONMENT_NAME=staging`,
`QORE_RAILWAY_STAGING_APPROVED=true`,
`QORE_RAILWAY_NO_COMMERCIAL_TRIPS=true` y
`LIVE_TRIPS_ENABLED=false` siguen siendo requeridas.

**Importante:** no activar esos cuatro flags basándose únicamente en
tests sintéticos de GitHub. Un estado READY autodeclarado no sustituye:
la autorización G27 con MFA AAL2, la tarifa AUTO aprobada por Owner,
los documentos verdaderos Driver + vehículo, el consentimiento GPS,
un motor de carreteras con prueba vial independiente, la conexión
de cuatro apps y los cinco E2E externos.

## Fallos y reversibilidad

Cualquier flag inválido o preparación de RPC incompleta impide activar
el worker. Con flags omitidos, el backend existente se comporta igual
que antes. Para revertir, definir
`QORE_G113_AUTO_RETRY_QA_APPROVED=false` y desplegar STAGING:
el proceso termina el worker por el cierre de ciclo de vida.
No usar LIVE ni habilitar PSP.

**No hay merge, deploy, tráfico real ni cambio de claves en este PR.**
