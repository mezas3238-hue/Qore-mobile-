# Arquitecto B — Incremento de cancelación segura Cliente (23/10/2026)

## Alcance real
- `apps/movete-cliente/app/seguimiento.tsx`: UX de doble confirmación. Solo aparece cuando el contrato STAGING se habilita expresamente y hay sesión Passenger con viaje cancelable `searching/assigned/arriving`. Por defecto continúa **deshabilitado**.
- `expo-crypto` SDK 57 (`~57.0.3`) proporciona `randomUUID()` del sistema operativo. No hay `Math.random`, identificadores generados a partir de hora ni fallbacks inseguros.
- `secure-cancel-key.mjs`: validación estricta UUIDv4, negativa segura si el módulo del SO no responde.
- `ride-cancellation.mjs`: a partir de timeout o error 409 impide preparar otro `requestKey`. Reintento explícito conserva la misma clave. ACK persistido tampoco admite segundo intento.
- `client-experience.mjs`: después de ACK o 409 ejecuta relectura por `rideStatus` autoritativo; si falla declara `statusRefreshed=false`. Nunca supone reembolso, comisión ni cancelación visible por respuesta POST.
- En UI no se mantiene ninguna clave de token ni se generan importes. No hay integración de pagos, push, SOS ni navegación real.

## Pruebas y condiciones
- Nuevos escenarios de validación criptográfica, reintentos con misma clave, bloqueo de eventKey duplicado, 409 con re-fetch y 200 sin estado optimista.
- El backend A debe certificar JWT/RLS y disponibilidad STAGING antes de activar `enabled` y `contractCertified`. Un build Expo web NO es prueba en Android/iOS ni test integrado real.
- No modificar `apps/movete-driver/**`, backend, SQL, workflows ni archivos fuera de propiedad B. PR #8 DRAFT, NO MERGE / NO LIVE.

## Hallazgos pendientes
- Verificar cancelación concurrente e idempotencia en PostgreSQL en pruebas controladas por A.
- Probar accesibilidad Android física, confirmar presencia del módulo Expo Crypto nativo y flujos E2E con Auth certificada.
- Completar lectura de status con gateway de red verificado y contract DTO; actualmente `rideStatus` puede ser simulación en QA.
