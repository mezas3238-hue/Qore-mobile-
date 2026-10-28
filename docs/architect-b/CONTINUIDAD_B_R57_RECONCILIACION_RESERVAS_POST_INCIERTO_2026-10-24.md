# Movete Fácil — Arquitecto B · R57: No repetir reservas con resultado desconocido

**Fecha:** 2026-10-24 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **Rama:** `feature/mobility-cliente-admin-parallel-20261022` · **PR #8 DRAFT**.

## Impacto: bloqueo P0 real corregido

Tras R56, `createClientMutationController` todavía clasificaba `NETWORK_OR_TIMEOUT`, `RATE_LIMITED` y `SERVICE_UNAVAILABLE` como `retryable`. En solicitudes de autos o envíos de pago real, eso permite efectuar otro **POST** usando la misma `requestKey`, aun cuando la primera petición pudo haber llegado al servidor y persistido antes de perder su ACK. El backend idempotente es la verdadera defensa, pero **hasta tenerlo verificado** la app no debe retransmitir automáticamente un intento incierto.

## Código realizado — frontera exclusiva B

1. `apps/movete-cliente/src/domain/client-mutations.mjs`: cuando el transporte es un `bookingReconciliationRequired:true` y la operación es `rideRequest` o `deliveryRequest`, **cualquier POST sin recibo QA verificable** conduce a `phase:'failed'`; no existe `retryable` para reserva en ese gateway. Un segundo `retry()` no repite POST, `prepare` rechaza una `requestKey` distinta, conserva `body`/clave **únicamente en memoria privada** y requiere conciliación read-only. El comportamiento histórico del gateway genérico no se modifica en otras operaciones.
2. `passenger-booking-staging-gateway.mjs`: método `reconcile(operation,{requestKey,expectedSubject,expectedSessionRevision})`. **OFF sin `reconciliationContractCertified:true` y `reconciliationRead` inyectado**, independiente de las cuatro certificaciones R56 del POST. **No se inventó URL ni endpoint A**. Antes y después de la lectura se revalida token/rol Passenger, sujeto y revisión de sesión; el resultado debe ser un `HTTP 200` con recibo QA de campos exactos R56 y `requestKey` original, nunca `404 NOT_YET_OBSERVED` ni reembolso. No emite HTTP POST.
3. `client-mutations.mjs`: nuevo `reconcileBooking` para un único estado anterior `failed` de viaje o envío; comprueba sesión, garantiza respuesta tardía descartada por generación al hacer logout y cambia a `acknowledged` **solo** al recibir el recibo QA validado vía gateway. Nunca almacena `serviceId`, PII o datos de reserva real en snapshot público. Si la lectura es inconcluyente, mantiene bloqueo.
4. `client-experience.mjs` y `.d.mts`: opción de inyección `bookingHttpOptions.reconciliationContractCertified` + `reconciliationRead` y método público `client.reconcileBooking()`; **sin cablear** automáticamente UI ni transporte sin IdP/HTTPS real.
5. `passenger-booking-staging-gateway.d.mts`: contrato completo de función y resultado QA.
6. `passenger-booking-staging-gateway.test.mjs`: **8 pruebas R57 adicionales**: reconcile OFF sin tráfico; mismo actor y clave con lectura certificada sin POST; 404/DTO/cross-key no desbloquean; cambio de rol/sesión; rotación JWT en lectura; timeout en ClientExperience que bloquea `retry`/nueva clave; ACK recuperado con `phase:'acknowledged'` sin segundo POST; lectura inconcluyente de envío que mantiene estado fallido.

## Dependencias que A tiene que entregar

**No hay ruta de reconciliación aprobada en OpenAPI A**; `reconciliationRead` es una **interfaz de integración inyectable** para posterior contrato, jamás evidencia de API disponible. Se requiere endpoint autoritativo **READ-only** de resultado por `requestKey` original + identidad Passenger JWT validada server-side, timestamps/revisión y rechazo cross-user, sin fuente de datos distinta de la persistencia real. `404` no prueba rollback. Requerir pruebas de doble envío y ACK perdido, en PostgreSQL real, antes de cerrar gate `CLIENT_LIVE_BOOKINGS` G61. Se requieren IdP, HTTPS DNS aprobado y QA con dos dispositivos sintéticos.

## Certificación y continuidad R58

Solicitar 3 workflows sobre el **mismo SHA final**: Architect B ownership, Admin QA y two-app isolation (Node, TypeScript, Expo web Cliente + Driver). Si falla Driver A, registrar issue #9 sin pisar propiedad. CI verde NO es GO comercial: G61 tiene 17 gates P0 sin evidencia de lanzamiento.

**R58 siguiente:** reemplazar estado `failed` opaco por UX accesible de `conciliación pendiente` sin botón POST; permitir consulta explícita solo tras contrato de lectura A; seguimiento de estados de reserva con `serviceId` propio y corrección de autorización entre cuentas. Ningún merge, LIVE, despliegue, VPS, PSP ni datos reales sin orden Owner.
