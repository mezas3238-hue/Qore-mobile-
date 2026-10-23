# Arquitecto B — Prevención de doble despacho al cambiar requestKey (QA, 23/10/2026)

## Riesgo y corrección
Antes, `client-mutations.prepare` permitía reemplazar un `requestKey` inmediatamente tras un timeout, aunque el servidor pudiera haber aceptado el viaje anterior. Así era posible preparar un segundo viaje involuntario. El código ahora deniega `prepare` desde `retryable` con `EXPLICIT_RETRY_REQUIRED`, mantiene clave y cuerpo original en `retry()`, y deniega nuevos intentos desde `failed` con `RECONCILE_BEFORE_NEW_REQUEST`. `clear()` en logout/limpieza explícita elimina los datos privados. Protección extensible a `rideRequest`, `deliveryRequest`, `fareQuote` y pagos SIMULADOS.

## Restricción operativa
La aplicación NO asume que hubo despacho, pago ni confirmación cuando solo ocurrió un timeout; se debe consultar servidor y conciliar antes de permitir un nuevo `requestKey`. No habilitar botón de búsqueda hasta protocolo prequote, autenticación y endpoint tipado certificado. QA sintético, no LIVE.
