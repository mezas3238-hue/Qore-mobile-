# Arquitecto B — lectura acotada de respuestas HTTP en Cliente

**23 de octubre de 2026. PR #8 DRAFT. Sin merge, SQL remoto, despliegues ni LIVE.**

Se implementó \`bounded-http-response.mjs\` para leer \`Response.body.getReader()\` en fragmentos antes de acumular más de los bytes autorizados. Valida UTF-8 estricto (incluyendo emojis divididos entre fragmentos), rechaza excesos de bytes, responde a abortos incluso ante \`read()\` bloqueado y nunca registra JWT, GPS, direcciones ni tarifas. Sin stream disponible, mantiene fallback \`text()\` con límite posterior; esa limitación no desaparece en todas las versiones de Android/Hermes.

Se aplicó a cinco transportes Cliente ya existentes y aislados: historial propio, estado del viaje y GPS, cotización PYG, cancelación idempotente y gateway general de viajes/envíos. Se conservaron límites de 262 KiB/32 KiB/8 KiB y semánticas de error existentes; el controller continúa exigiendo la misma requestKey y nueva consulta de servidor tras cancelación.

El bloque contiene cinco casos unitarios especializados además de la batería previa: Unicode fragmentado, streams mayores al límite, UTF-8 inválido, abort de lector colgado y fallback Android sin stream. Los cinco gateways quedan apagados por defecto y no incluyen contratos ni secretos productivos.

**Pendiente:** certificar la CI exacta, STAGING con JWT/RLS reales, pruebas de dispositivos Android/iOS, contrato tipado de incidentes/status entregas, PSP/comercios y permisos Owner. No afirmar que export Expo web equivale a APK real.
