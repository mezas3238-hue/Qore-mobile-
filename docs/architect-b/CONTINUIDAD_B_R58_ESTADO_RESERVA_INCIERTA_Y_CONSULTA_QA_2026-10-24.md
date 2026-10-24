# QORE Mobile — Arquitecto B R58 · UX segura de solicitudes de viaje y envío sin conciliar
**Fecha:** 2026-10-24 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **Rama B:** `feature/mobility-cliente-admin-parallel-20261022` · **PR #8 OPEN DRAFT**.

## Problema P0 resuelto

R57 implementó bloqueo de segundo POST y el contrato inyectable de recuperación por `requestKey`; sin embargo, Viajes y Envíos no exponían al usuario una acción ni un mensaje específico de conciliación. Los estados `failed`, `in_flight`, `acknowledged` quedaban bajo una advertencia genérica, confundiendo un resultado incierto con un viaje inexistente o pagado.

## Código R58
1. `apps/movete-cliente/src/domain/passenger-booking-staging-gateway.mjs` y `.d.mts`: `reconciliationConfigured()` exporta únicamente **booleano**, condicionado a la certificación independiente R57 (`reconciliationContractCertified`, `reconciliationRead`, transporte HTTPS, gates R56), nunca tokens, ids, DTOs privados o host. La consulta está OFF por defecto.
2. `client-experience.mjs`, `.d.mts`: `ClientSnapshot.bookingRecovery:{readReady:boolean,productionEnabled:false}`, forzado `false` en sesión anónima, y actualizado al consultar/logout. `reconcileBooking()` avisa a React al iniciar y terminar, permitiendo mostrar `in_flight` sin segundo toque.
3. `booking-recovery-ui.mjs` y `.d.mts`: proyector puro con comprobaciones contra render anterior y `client.snapshot()` vivo. Actor Passenger UUID, misma cuenta, revisión privada (rotación JWT), operación (rideRequest/deliveryRequest), `requestKey` original UUID, fase y gate de solo lectura. El mensaje nunca contiene teléfono, localización, token, clave de reserva ni mensaje de error bruto. `postReplayAllowed:false` en todos los casos; `failed` no implica rollback, `acknowledged` en QA no implica conductor asignado, precio, cobro o autorización comercial.
4. `src/BookingRecoveryPanel.tsx`: componente React Native compartido con botones y textos accesibles a TalkBack/VoiceOver. Antes de consultar, **vuelve a comparar** `view` con `client.snapshot()` al tocar; exige `failed`, gate `readReady`, mismo actor/revisión/requestKey, y bloquea doble toque. Solo llama `client.reconcileBooking()`, **nunca `client.submit()` ni `retry()`**. Protege feedback de respuestas de otra sesión o viaje.
5. `app/viaje.tsx` y `app/envios.tsx`: sección contextual «Estado de la solicitud anterior». Sin consulta certificada, informa estado bloqueado y razón; con lectura aprobada, habilita «Consultar resultado sin reenviar». No modifica flujos de PSP, Driver ni despacho.
6. `booking-recovery-ui.test.mjs`: **12 pruebas adversariales** de estados, falta de certificación, PII, rotación de cuenta/JWT, requestKey cambiado, fases intermedias y bloqueo de supuesta producción.
7. `passenger-booking-staging-gateway.test.mjs`: **3 pruebas integradas** de ClientSnapshot OFF/ON/logout, estado `in_flight` visible con lectura inconcluyente, y respuesta incierta con lectura revocada. **Total R58: 15 pruebas nuevas**.

## Límites de producción

**R58 es una mejora real del circuito Cliente, no la certificación comercial.** Backend A aún no tiene ruta definitiva de conciliación por `requestKey` aprobada por OpenAPI ni IdP/HTTPS móvil desplegado, por lo que la acción sigue **OFF en la aplicación actual**. No inventar URL ni prometer recuperación real; el backend debe autorizar actor y consulta, persistir respuesta y auditar. Estas pruebas usan datos sintéticos y Expo web QA, no cuentas reales, AAB/IPA firmados o dispositivos físicos.

## Condiciones de CI

Validar **en el mismo SHA final**: `Architect B ownership`, `Admin web QA`, `two app isolation` con Cliente + Driver TypeScript, Node tests y Expo web export. Rechazar el cierre si falla cualquiera, atribuyendo Driver a A solo si logs lo acreditan. PR #8 DRAFT, sin merge/LIVE/deploy/PSP/VPS/PII reales.

## Continuidad R59 y prioridades de terminación

Priorizar integración **Cliente→Backend POST→estado persistido→Driver oferta/aceptación→Cliente tracking**, con `requestKey` conciliable y autorización de ambos roles en HTTPS móvil. Depende de A: IdP/JWKS, gateway STAGING accesible, schemas OpenAPI de ACK/GET reconcile y pruebas de concurrencia PostgreSQL. No seguir acumulando UX trivial; al recibir contratos reales, validarlos extremo a extremo en QA antes de solicitar GO/NO_GO al Owner. Mantener 17 gates P0 actuales NO_GO hasta evidencias de certificación.
