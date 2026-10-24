# QORE Mobile — Arquitecto B · GET RiderStatusV1 seguro y tipado (23/10/2026)

## Cambio implementado
- Módulo exclusivo `apps/movete-cliente/src/domain/ride-status-gateway.mjs` para `GET /v1/staging/rider/trips/{tripId}/status` de OpenAPI **G11** del Arquitecto A.
- Validación estricta de origen HTTPS fijado, JWT passenger efímero, `subject` UUID, `authRevision`, caducidad, respuesta 200 JSON, contenido/tamaño máximo, viaje propio, `revision` y campos esperados de `RiderStatusV1`. Las respuestas obsoletas de 401/403 o 200 de otro login jamás contaminan la sesión nueva.
- Campos de conductor y ubicación siguen las condiciones declaradas por A: aceptación persistida, datos de AUTO y GPS consentido/fresco. Nunca inventa mapa, ETA ni activación LIVE.
- Adaptador opcional `statusGatewayOptions` inyectado en `client-experience.mjs` y tipos; exclusivamente para `rideStatus`, sin sustituir gateway de solicitudes ni mutaciones. **No se conecta desde `ClientRuntimeProvider` por defecto.**
- Pruebas adversariales: rol ajeno, token caducado, origen falso, inyección, DTO ajeno, flags contradictorios, GPS vencido, HTTP 401/403/404/429/503, fallo de red, contenido incorrecto, concurrencia y rotación de sesión.

## Gates
QA sintético no es JWT/RLS real, ni emulador/dispositivo, ni STAGING externo disponible. Para habilitar este adaptador faltan evidencias reales de A y autorización de pruebas STAGING. Mantener `enabled=false` y `contractCertified=false`. No operar LIVE, no merge ni tocar Driver/backend/CI.
