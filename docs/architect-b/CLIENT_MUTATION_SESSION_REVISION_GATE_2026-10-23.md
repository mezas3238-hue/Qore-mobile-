# Movete Fácil — B24 gate de revisión privada en mutaciones Cliente

**Fecha:** 23 de octubre de 2026
**Ámbito:** Arquitecto B, `apps/movete-cliente/**` y QA sintética.
**Estado:** publicado y certificado en GitHub Actions.
**Restricciones:** PR #8 DRAFT, sin merge, despliegue, LIVE, JWT real, pagos, GPS ni datos personales.

## Problema cerrado en la capa Cliente

Un `subject` Passenger no identifica por sí solo una sesión. La misma cuenta puede cerrar sesión, rotar el JWT o iniciar una sesión nueva mientras existe un request preparado o en vuelo. Un borrador creado por el JWT anterior no debe salir bajo el JWT nuevo, y un ACK tardío no debe restaurar datos del formulario anterior.

## Implementación

- Cada preparación de viaje, envío, cotización o cancelación queda ligada a `sessionRevision`, una revisión privada que cambia en login, logout, expiración, cambio de cuenta o rotación de JWT.
- Un refresh idéntico del mismo token conserva la revisión y el borrador; no destruye trabajo legítimo.
- Los controllers comparan titular y revisión antes de invocar el transporte.
- Los gateways HTTP vuelven a comparar `expectedSessionRevision` antes de hacer `fetch`; si la revisión ya cambió retornan `STALE_SESSION_RESPONSE` con **cero llamadas de red**.
- La comprobación existente posterior al HTTP continúa validando token, vencimiento y `authRevision`; una respuesta de una sesión anterior nunca se acepta.
- La rotación/logout dispara la limpieza privada existente y el `privateViewRevision` fuerza remount de formularios de viaje, envío y soporte.
- El `sessionRevision`, JWT, body, direcciones y datos privados no aparecen en snapshots públicos.

## Superficies cubiertas

1. `client-mutations`: viaje AUTO, envío AUTO/MOTO de carga y pago únicamente simulado.
2. `client-gateway`: bloqueo pre-red de request preparado con otra sesión.
3. `fare-quote-flow` + `fare-quote-gateway`: cotización G24 QA.
4. `ride-cancellation` controller + gateway: cancelación idempotente del viaje propio.
5. `client-experience`: entrega de la revisión privada a controllers/gateways y limpieza integral.

## Pruebas adversariales añadidas

- Misma cuenta con revisión diferente antes de submit: `SESSION_CHANGED`, 0 envíos.
- Request preparado, JWT rotado y luego submit: estado privado `idle`, formulario desmontado, 0 envíos.
- JWT rotado durante request: ACK anterior descartado como `STALE_RESPONSE_IGNORED`.
- Logout durante request: ACK anterior descartado y Cliente queda no autenticado.
- Gateway genérico, cotización y cancelación reciben una revisión esperada antigua: `STALE_SESSION_RESPONSE`, 0 llamadas `fetch`.

## Evidencia local

- `npm run check`: TypeScript SUCCESS; **200/200 tests PASS**, 0 FAIL.
- `npx expo export --platform web --output-dir dist`: SUCCESS.
- El corte anterior tenía 194 tests; este bloque agrega 6 pruebas y no elimina ninguna.

## Evidencia GitHub

- Commit: `93cb5bf13ec81acdf7b1345ec2f09f86276b57b3`.
- Architect B ownership boundary #39962457773: SUCCESS.
- Admin Web QA #39962457776: SUCCESS.
- Two app isolation #39962457781: SUCCESS, Cliente 200/200 en el bloque B24.

## Límites que siguen abiertos

- La revisión es una defensa del frontend, no reemplaza JWT/RLS/idempotencia/reconciliación del backend A.
- Los gateways siguen OFF por defecto y no se activó ningún endpoint.
- Un request que ya salió puede haber sido procesado por el servidor; por eso timeout/409 conservan la misma `requestKey` y exigen conciliación.
- Faltan Auth Passenger real, STAGING HTTPS autorizado y E2E multiusuario. No declarar la app comercialmente lista.

