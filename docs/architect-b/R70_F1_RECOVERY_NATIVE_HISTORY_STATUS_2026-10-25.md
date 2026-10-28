# R70 — Recuperación AUTO tras reiniciar, sin POST duplicado (QA)
Fecha: 2026-10-25. Arquitecto B, PR #8 DRAFT. Owner NO_GO / sin producción.

## Función entregada
La app Cliente ahora compone gateways independientes de historial de pasajero (G26)
y estado privado de viaje (G11/G4). No se infiere autorización del exitoso
liveness, del contrato G73 ni de una compilación Expo. Ambos GET se fijan al
mismo origen HTTPS Render aprobado, JWT de Passenger firmado, servidor
verifica propietario, revisión y estado. Tras reiniciar el proceso, en Historial
hay un acceso directo a recuperar los viajes propios por GET; el usuario elige
un viaje activo con revisión actual y la app ejecuta OTRO GET independiente
antes de activar seguimiento. No envía POST ni crea segunda bookingKey.

## Build flags QA (todas requeridas, default OFF)
- EXPO_PUBLIC_F1_STAGING_ORIGIN y EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN:
  igual host https://<app>.onrender.com, sin path, puerto o query.
- EXPO_PUBLIC_F1_OWNER_APPROVED=true (autorización escrita del Owner)
- EXPO_PUBLIC_F1_PG_RUNTIME_VERIFIED=true (misma BD STAGING persistente)
- EXPO_PUBLIC_F1_HISTORY_CONTRACT_VERIFIED=true (A certifica GET /v1/staging/rider/history)
- EXPO_PUBLIC_F1_STATUS_CONTRACT_VERIFIED=true (A certifica GET /v1/staging/rider/trips/{tripId}/status)
- EXPO_PUBLIC_F1_PASSENGER_RLS_VERIFIED=true (JWT, RLS, propiedad y revocación)

Estos flags **no se activaron**: no hay evidencia de instancia y dominio
autorizados. Ninguno permite LIVE, pagos o descuentos. Los endpoints podrían
seguir sin montarse en runtime externo. Los flags públicos no son credenciales;
la seguridad definitiva es backend JWT/RLS y restricciones server-side.

## Certificación disponible
Prueba de integración sintética del reinicio: instancia nueva de Cliente
GET historial propio → GET status tripId → seguimiento, cero POST, sin JWT
en snapshot. Negativos: flags parciales/entorno/origen, historial foráneo.
El test de CI certifica programa, no teléfono, PostgreSQL remoto ni Driver real.

## Bloqueos de A / requisitos antes de E2E físico
Acta de G26/G11 en OpenAPI y en runtime con la misma base de G73, contrato
de autorizaciones y evidencias SQL permanentes de historial/status.
Comprobar retención, paginación de más de 50 registros, 401/403/404/503,
rotación de JWT, doble dispositivo, interrupción de red, Driver G65 y G75.
La ausencia de una fila de historial NO equivale a ausencia de reserva ni
autoriza un POST adicional: se necesita reconciliación idempotente por
bookingKey persistida por servidor. Posterior: pruebas nativas Android/iOS.
