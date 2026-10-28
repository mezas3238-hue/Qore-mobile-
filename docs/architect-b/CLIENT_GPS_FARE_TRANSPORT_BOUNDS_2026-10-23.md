# B — Seguimiento GPS, cotización PYG y respuestas móviles acotadas

**Fecha:** 2026-10-23 · PR #8 DRAFT; no MERGE, no LIVE, no despliegue.

## Correcciones implementadas
- El gateway de estado de viaje propio y el de cotización económica (POST idempotente) ahora rechazan respuestas tardías a nivel HTTP, cuerpo JSON y última revalidación de identidad. Incluso si un adaptador ignora AbortSignal, no entrega ubicación/ETA ni tarifa después del plazo, ni invalida una sesión por error 401 tardío.
- \`response-bytes.mjs\` cuenta UTF-8 correctamente con acentos, emoji y pares sustitutos sin depender de \`TextEncoder\` o de \`Buffer\`, APIs no garantizadas por igual en entornos móviles Hermes. El lector de historial adopta también este contador portable.
- La política existente no cambia: Android/Web no calculan tarifas, no aceptan GPS no autorizado y no abren operaciones cuando el contrato STAGING/AUTH/RLS de A está desconectado.

## QA
2 pruebas para el contador portátil; 4 pruebas nuevas en status de viaje; 4 en cotización. Pruebas de hermeticidad con \`Buffer.byteLength\` solo en Node QA. Consultar workflow completo del commit para confirmar \`npm run check\`, export Expo web y aislamiento. El límite de bytes se evalúa tras \`Response.text()\`; para acotar memoria ante streams maliciosos el backend/adapter deberá incorporar lectura streaming limitada. No se presume validación manual en Android físico.

## Próximos bloques
Mantener respuestas en UTC/time server-safe, auditar cancelación/entregas, escaneo de datos sensibles, probar Android E2E, certificar JSON remoto con JWT/RLS y contratos productivos antes de cualquier habilitación. Ninguna credencial ni operación de dinero LIVE incluida.
