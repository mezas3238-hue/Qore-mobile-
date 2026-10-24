# QORE Mobile / Movete Fácil — Arquitecto B · R47 caducidad visible de comercio
Fecha 24-oct-2026. PR #8 DRAFT, sin merge o despliegue. Etapa R47 después de R46.

## Problema real corregido
Un snapshot vigente durante la renderización podría caducar sin ninguna interacción o actualización de React. `Date.now()` en render NO dispara render al avanzar el reloj; por tanto, una página de catálogo y su subtotal podrían quedar visibles con stock/precio vencidos hasta otro evento.

## Implementación
- `apps/movete-cliente/src/domain/commerce-ttl-refresh.mjs` y `.d.mts`: política pura para calcular un refresh preciso cuando vence el TTL y rechazar timestamps inválidos. No renueva autorizaciones del backend.
- `apps/movete-cliente/src/domain/commerce-ttl-refresh.test.mjs`: 5 tests de límite exacto, TTL ausente/ilegal, rebose de timer, prohibición de prorrogar datos y visibilidad justo antes/después del vencimiento.
- `apps/movete-cliente/src/useCommerceExpiryClock.ts`: hook de UI con re-render en el vencimiento exacto + revalidación al volver a primer plano (`AppState active`); libera timers y listeners al desmontarse. No usa red ni secretos.
- `apps/movete-cliente/app/comercios.tsx`: catálogo/carrito y paginación usan `isCommercePageFresh` junto al reloj React. Al caducar se ocultan precios y artículos incluso sin toques, y se bloquea `Anterior/Siguiente` hasta nueva lectura. Subtotal revisado usa el mismo instante de validación; nunca hay extensión local de TTL.

## Seguridad y límites
Se preservan R46 (bloqueo síncrono de doble toque, limpieza de feedback y desmontaje) y R37–R45 (gates server-first, privacidad, cotizaciones en guaraníes y políticas OTC). El hook NO garantiza la ejecución inmediata de timers mientras el sistema suspende la app; al reanudarse hay revalidación antes de una nueva interacción. Backend JWT, transacciones de stock y PSP reales siguen pendientes de A. El frontend no habilita compras, descuentos, checkout ni pago.

## Verificación y continuación R48
Ejecutar los tres workflows EN EL MISMO SHA final: ownership B, Admin QA y aislamiento+TypeScript+tests+Expo export Cliente/Driver. Tests del helper prueban la política de tiempos; TalkBack/VoiceOver y dispositivos Android/iOS físicos permanecen pendientes. R48: revisar expiración visual de más pantallas con datos caducos y priorizar integraciones server-authenticated cuando A entregue evidencia. PR DRAFT, NO MERGE/LIVE/DEPLOY/PSP ni uso de PII real.
