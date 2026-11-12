# G320 — Adjudicación atómica de casos de Soporte

**Corte:** 12-nov-2026. **Owner de módulo:** Arquitecto C · issue #120.
**Encadenamiento:** G301 #104 → G309 #116 → G311 #121 → G312 #126 → G313 #132 → G314 #137 → G320.

## Qué aporta G320

1. Una acción `Tomar caso`, visible exclusivamente cuando el portal autorizado tiene un usuario Support válido y el ticket permanece `OPEN`, sin asignación, y de prioridad `NORMAL/HIGH`.
2. La llamada cliente usa solo `ticket_id` y `idempotency_key`. **No admite actor, rol, teléfono, estado, datos personales ni cantidad de dinero.** Se mantiene oculta por `VITE_QORE_SUPPORT_CLAIMS_APPROVED=false`.
3. Una futura Edge Function `qore-support-claim` valida primero el token con Supabase Auth y asocia usuario y sesión real; `QORE_SUPPORT_CLAIMS_ENABLED=false` por defecto. **No desplegada**.
4. La función SQL G320 (borrador) verifica en una transacción que el agente siga activo, con Owner aprobador activo, Auth AAL2+TOTP de sesión vigente, ningún rol paralelo, y que el ticket esté libre y en estado `OPEN`. Filas de autoridad con `FOR SHARE`, ticket con `FOR UPDATE`.
5. El ticket se asigna y en la misma transacción se inserta evento mínimo `claim_id, ticket_id, agent_id, idempotency_key, claimed_at`. La tabla de eventos es append-only; unicidad por ticket.
6. Los tickets críticos NO se adjudican por la cola ordinaria: requieren ruta específica del responsable de seguridad, aún pendiente.
7. Reintentos del mismo empleado con misma clave no vuelven a escribir; otro empleado o una clave distinta no heredan adjudicación.
8. El frontend no asume la adjudicación a partir de una respuesta HTTP: vuelve a solicitar la bandeja y solo la muestra como asignada si la lectura autorizada coincide.

## Pruebas previstas

- `g320-support-claim-disposable-ci.sql`: Auth sintética, Staff A/B, Owner, AAL1, sesiones caducadas, RLS, denegación a navegador, prioridad crítica, idempotencia y auditoría de caso.
- `g320-support-concurrent-claim-ci.sh`: **dos sesiones PostgreSQL separadas** compiten por el mismo ticket con la primera transacción abierta y bloqueo de fila; solo una puede terminar con `CLAIMED`; evento único.
- `support-claim-contract.test.mjs`, `support-claim-gateway.test.mjs`, `support-claim-http.test.mjs`: entrada estricta, CORS, Auth, segundo factor, recibos con 3 campos, revocación y gate OFF.
- Deno check y compilación de `apps/movete-soporte` aislada.

## Estado real y bloqueos

Supabase STAGING fue verificado `ACTIVE_HEALTHY` pero tiene **0 tablas de Soporte, 0 Owners activos, 0 MFA TOTP verificados y 0 Edge Functions** a la inspección realizada. NO se ha aplicado SQL G301/G312/G313/G314/G320 ni desplegado código Edge.

**Gate crítico para desplegar:** certificación de cuenta Owner AAL2 y staff individual, revisión de funciones `SECURITY DEFINER` en esquemas privados y públicos, sin grants a `authenticated/anon`, matriz de revocación con cuentas reales QA, disponibilidad/retención/auditoría, protección de contraseñas comprometidas, y aprobación del integrador. El PR #138 de integración móvil/comercio es ajeno a este trabajo; no introducir conflictos cruzados.

La adjudicación no constituye responder, resolver, cancelar una carrera, aprobar un documento, disparar un SOS ni reembolsar dinero. **NO LIVE, NO MERGE, NO DEPLOY, NO PSP.**
