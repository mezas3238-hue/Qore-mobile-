# QORE Mobile — frente C: Portal Soporte, G309

**Fecha:** 2026-11-03. **Tipo:** coordinación y seguridad QA. **Autoridad:** NO LIVE, NO MERGE, NO DEPLOY.

## División propuesta para tres arquitectos (sin presuponer que recibieron la asignación)

| Arquitecto | Propietario del frente | Archivos que NO debe modificar otro frente |
| --- | --- | --- |
| A | Cliente/Driver: UX, GPS, autocámara, APK, publicación de apps | `apps/movete-cliente/**`, `apps/movete-driver/**`, workflows de APK |
| B | Comercio: prepago, PSP, despacho, liquidaciones, conciliación | `apps/mobility-expo/server/**` para pagos/merchant/dispatch y SQL comercial, con revisión antes de desplegar |
| C (este PR) | Personal de soporte: portal, autenticación, permisos de consulta, tickets | `apps/movete-soporte/**`, esquema de soporte sujeto a revisión PG17 |

Los archivos transversales de Railway, Supabase, `main`, configuraciones compartidas y ensamblaje final requieren un integrador único: no ejecutar merges/deploys paralelos ni activar LIVE.

## Trabajo G309

El frontend G301 podía volver a mostrar una bandeja antigua o revivir estado `ready` si una consulta iniciada antes de cerrar sesión terminaba después del cierre. G309 añade un contador de generación por sesión: los resultados tardíos de `login`, MFA, autologin y `refresh` no pueden aplicar cambios de UI tras logout o una consulta posterior.

**No es autorización:** el servidor debe validar de nuevo Auth + MFA AAL2 + rol y RLS por cada operación. La defensa de UI impide fugas accidentales de pantallas anteriores, no sustituye políticas PostgreSQL.

## Bloqueos observados del frente C

- PR #104 contiene UI y contrato G301; todavía faltan registro de agentes verificado y bandeja PostgreSQL real.
- La migración de soporte propuesta en `apps/mobility-expo/docs/g301-support-staging-schema.sql` **no se ejecuta** en G309.
- Falta verificar que el personal de soporte tenga acceso únicamente a tickets autorizados y nunca a Owner/Admin, dinero, precios, KYC o ubicaciones.
- Faltan API auditada de acciones de ticket, retención de datos, revisión jurídica/privacidad y pruebas con identidades STAGING diferenciadas.
- Controles de release: tests de Node, TypeScript, build web; luego QA real con 2 identidades soporte, revocación, AAL1/AAL2 y sesión vencida.

## Condiciones de entrega

1. Mantener `VITE_QORE_SUPPORT_STAGING_APPROVED=false` en CI; no introducir publishable key ni contraseñas en repositorio.
2. Confirmar RLS, no exposición de datos personales ni permiso financiero en PG17 antes de activar flag STAGING.
3. Validar que cerrar sesión mientras `refresh` está pendiente no reabre la bandeja.
4. PR DRAFT y revisión independiente antes de integrar a cualquier release.
