# B — Transportes Cliente: cancelación idempotente y gateway general

**Fecha:** 2026-10-23. **PR:** #8 DRAFT. Sin merge, backend, SQL remoto, despliegue o LIVE.

## Cambios
- La cancelación propia, que exige \`requestKey\` inmutable para evitar dobles eventos, ahora rechaza HTTP, cuerpo o respuesta aceptable fuera del plazo incluso con \`fetchImpl\` que ignore \`AbortSignal\`. Un timeout se presenta como resultado incierto y se reintenta explícitamente **con la misma clave**, nunca confirmando cancelación o reembolso en UI sin reconsulta de status.
- El gateway Cliente genérico de solicitud de viajes/envíos y operaciones expresamente habilitadas aplica la misma política a 201/401/403; respuestas sobredimensionadas usan \`utf8ByteLength\` portable y límite de bytes real antes de parsing.
- Cinco pruebas nuevas de cancelación (incluye control de retry con la misma key) y cuatro del gateway general (ACK, 401 y body tardíos y Unicode oversized).

## Limitaciones operativas
- Estos transportes siguen fallando cerrados hasta contratos de backend A y autorizaciones explicitadas; no implementan eventos comerciales ni pagos reales.
- JSON streaming *sin* Content-Length aún podría asignar el body antes de verificar su tamaño; protección streaming bounded permanece pendiente.
- Requerido: verificar suite Cliente, TypeScript, export Expo, Admin Web y ownership en el **HEAD de este commit**, no inferir éxito de jobs antiguos.
