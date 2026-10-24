# QORE Mobile — G43 / A24: revocación transaccional y reconciliación de sesión (QA aislado)
**Fecha:** 2026-10-23 · **Owner de código:** Arquitecto A · **Alcance:** backend/sql/CI; no Cliente ni Admin B.

## Decisión de seguridad
Un JWT firmado, una consulta HTTP `verifySessionNotRevoked` y una lectura G42 previa **no bastan** para permitir una mutación: el proveedor puede revocar antes del commit. La operación que cambie un estado debe bloquear la fila de sesión con `mobility_stage_g42_lock_session` dentro de la **misma transacción PostgreSQL** que su efecto. El evento de revocación debe actualizar esa misma fila, esperando el bloqueo o ganando antes de él.

## Entregado y verificado por tests aislados
- `apps/mobility-expo/docs/backend/staging_only/G43_TRANSACTIONAL_SESSION_FENCE_POSTGRES_CI_ONLY.sql`: tabla de efectos QA **desconectada** de viajes, KYC, pedidos e incidentes; función de prueba `mobility_stage_g43_guarded_probe` ejecuta G42 lock y efecto en la misma transacción.
- `G43_TRANSACTIONAL_SESSION_FENCE_ASSERT_POSTGRES_CI_ONLY.sql`: sin grants de INSERT/EXECUTE a browser ni `service_role`, rechaza actor ajeno, token anterior al grant y revocación; efectos rechazados ausentes.
- `apps/mobility-expo/server/g43-session-revocation-race-ci.py`: dos sesiones PostgreSQL de verdad; verifica operación→revocación (revocación espera commit) y revocación→operación (operación espera y fracasa). Comprueba efectos confirmados finales.
- `apps/mobility-expo/server/g43-provider-session-reconciliation-qa.mjs`: contrato inyectable QA de dos lecturas independientes al proveedor (usuario y sesión), revisión monotónica y callback de persistencia con compare-and-swap requerida. No acepta `aal2` autodeclarado en JWT, identidad distinta, datos caducos ni caída del proveedor. **No contiene cliente de Auth ni ejecuta SQL remoto.**
- `g43-provider-session-reconciliation-qa.test.mjs`: observación activa/revocada, expiración, replay de revisión, suplantación, MFA no comprobada, corte upstream, falta de CAS y bloqueo en LIVE.
- Workflow PostgreSQL descartable actualizado para ejecutar SQL y ambas órdenes de carrera. Tests Node capturados automáticamente por `node --test *.test.mjs`.

## Riesgos y límites INNEGOCIABLES
1. `mobility_stage_g43_guarded_probe` es SOLO un fixture de laboratorio invocable por el propietario de la DB descartable. **No** se concede a `service_role`; conocer los UUID no autentica a un actor.
2. El adaptador Node `createG43ProviderSessionReconcilerQa` recibe proveedores privados **inyectados**, no hay cuenta/proveedor auténtico montado, ni garantizamos monotonicidad duradera sin implementación del callback CAS en la transacción.
3. Los campos provider `observedAtMs`, `revision`, `assuranceLevel` y `mfaVerifiedAtMs` son fuentes **sintéticas**; su equivalente real debe auditarse contra la API auténtica antes de confiar en él.
4. G40 POST/GET y G41 GET **NO** están conectados con este fencing; sus OpenAPI continúan `x-qore-runtime-wired:false`, igual que cualquier enlace de la app B. Un resultado verde no crea STAGING HTTPS ni intervención de emergencia.
5. Revocación concurrente es una propiedad del **protocolo de la base**, no garantía de la capa de Auth real. Para alcanzar G46 se requiere proveedor autorizado, JWT/JWKS auténticos, AAL2 genuino y un comando de mutación final con identidad verificada y bloqueo en la misma transacción.
6. No usar QA owner como rol privilegiado permanente, no conceder escritura directa a `service_role`, no permitir que el navegador firme evidencias de sesión, no publicar tokens ni secretos.

## Criterio CI y próximo paso
Consultar las cuatro Actions del **SHA final** de este gate: PostgreSQL, Node, Expo y aislamiento. No transferir resultados del SHA G42 ni de un commit intermedio. Si aparece error, leer paso exacto y reparar antes de declarar gate verificado.

**A siguiente G44:** GET comprador de sucursales y catálogo con cursor opaco ligado a sesión/branch/filtros/versión, paginación de 100 por página sin límite global, mercancía permitida únicamente, autoridad del servidor y OpenAPI `runtime-wired:false`. **G45** pedido/stock con CAS y idempotencia. **G46** conexión autenticada a STAGING **solo con autorización Owner**. Coordinación por issue #9; jamás modificar código de B, hacer merge, LIVE, pagos o deploy.
