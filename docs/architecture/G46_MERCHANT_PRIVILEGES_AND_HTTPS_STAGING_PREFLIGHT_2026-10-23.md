# QORE Mobile — Arquitecto A · G46: Privilegios mercantiles / cierre de cutover HTTPS STAGING

**Fecha:** 2026-10-23 · **PR:** #7 DRAFT · **rama A:** `feature/mobility-monorepo-isolated-20261016` · **aplicaciones B:** no modificadas.

## Objetivo y resultado

G46 auditó la brecha entre la infraestructura sintética G6/G9/G42–G45 y un servicio comercial seguro. **No autorizó HTTPS STAGING, producción, LIVE, PSP ni migró SQL remotamente**.

### Hallazgo P0: atribución de identidad histórica insuficiente

- G6 entrega `service_role` `SELECT/INSERT/UPDATE` sobre comercios, ramas, artículos, órdenes, líneas y `EXECUTE` sobre `mobility_stage_merchant_order_request`, `merchant_order_transition`, `merchant_order_attach_delivery`.
- G9 agrega eventos de gestión y cuatro RPC de administración con `_owner_id`, `_admin_id` o `_actor_id` proporcionados por el invocador. Si se conecta un backend mal configurado y le permite a un usuario suplantar esos parámetros, `service_role` puede saltarse RLS. La pertenencia de un UUID a `user_roles` no demuestra que el llamante sea ese usuario.
- G44 exponía también lectura de catálogo con `_buyer`, `_session` y `_iat_ms` en parámetros al `service_role`, todavía sin HTTPS/JWT real verificados.
- **Bloqueo seguro:** no exponer esas rutas ni las funciones con parámetros de identidad autoafirmados. No declarar que pasar Node+CI demuestra seguridad para usuarios externos.

## Cambios ejecutados

1. **`G46_MERCHANT_COMMERCE_PRIVILEGE_LOCKDOWN_POSTGRES_CI_ONLY.sql`**: migración aditiva después de G45 que revoca toda lectura y DML de los ocho objetos de comercio a `PUBLIC,anon,authenticated,service_role`. Revoca EXECUTE a once funciones (G6 3, G9 4, G44 2, G45 2). La propiedad DB desechable retiene sus poderes de mantenimiento; NO se concede nueva autoridad al servicio.
2. **`G46_MERCHANT_COMMERCE_PRIVILEGE_ASSERT_POSTGRES_CI_ONLY.sql`**: 8 tablas × 3 roles × 7 tipos de privilegio = **168 verificaciones de ausencia**, y 11 funciones × 3 roles = **33 pruebas de ausencia de EXECUTE**. Las lecturas, escrituras de stock y llamada directa RPC probadas bajo `SET ROLE service_role` fallan con `insufficient_privilege`. Comprueba que propietario conserva la autoridad QA.
3. **CI `mobility-g4-postgres-disposable.yml`** ahora instala también G9, que antes no se incluía en la cadena real de pruebas, después de G45 y justo antes de G46. Sólo entonces ejecuta cierre y ataque. No existe migración hacia servicio externo.
4. **`g46-merchant-staging-preflight-qa.mjs`**: diez evidencias consultadas por siete inspectores independientes del servidor. Cada observación debe corresponder al mismo SHA y haberse obtenido en un plazo de 60s. Rechaza datos fuera de contrato y jamás reproduce secretos/PII en su resultado. Incluso un checklist de laboratorio totalmente positivo devuelve `activationPermitted:false`, `httpsStagingConnected:false`, `clientRuntimeEnabled:false`, `paymentEnabled:false`. El módulo no visita sitios ni crea servicios.
5. **`g46-merchant-staging-preflight-qa.test.mjs`** prueba ausencia de aprobación, TLS, JWT, revocación, RLS transaccional, permisos, acreditación legal de zona, prohibición de pagos, secreto fuera del repositorio y flags; caducidad y SHA cruzados.
6. **OpenAPI `1.0.0-g46`**: `x-qore-merchant-commerce-promotion-authorized:false`, `x-qore-merchant-runtime-ready:false` y `x-qore-g46-database-privilege-lockdown-ci-only:true`; GETs G44 y POSTs G45 permanecen expresamente `x-qore-runtime-wired:false`. `g46-merchant-cutover-contract.test.mjs` añade regresión CI.
7. Tests G45 anteriores se adaptaron para permitir evolución del número de versión OpenAPI sin relajar la validación de DTO y respuesta sellada.

## Trade-off y dependencias sin ocultar

- **G6/G9 y GET G44 no son invocables ahora desde `service_role` en PostgreSQL de cadena G46.** Es deliberado: un runtime cliente real es inseguro hasta integrar identidad de proveedor en cada transacción con una función privada fuertemente tipada. G45 también continúa owner-only QA.
- Para hacerlos operativos legalmente en STAGING real, diseñar rol servidor dedicado de privilegio mínimo (no `service_role` universal), JWT de proveedor verificado en HTTPS con JWKS, issuer/audience/pinning, lectura de sesión activa y revocación, identidad vinculada y autorización de rol/merchant a nivel SQL; escribir funciones privilegiadas específicas que jamás acepten `actor_id` libre del cliente y revocar rutas viejas. Luego probar 2 conexiones, recálculo PYG, revocación concurrente, idempotencia, límites RLS y staging HTTPS auténtico.
- Persistencia de KYC, secreto, PII, actividad GPS, contratos legales y elegibilidad comercial requieren expedientes reales autorizados, storage con cifrado/retención y políticas locales. No introducir documentación auténtica en CI.
- Las dos apps Driver y Cliente siguen **separadas**. B conserva Cliente/Admin y se comunica mediante issue #9; A sólo cambia su dominio y documentos propios.
- Próximo paso sin bloqueo de código: **G47** inventario y política de storage seguro de documentos Driver (staging sintético, hashes, metadatos, TTL de acceso, revocación y auditoría); **G48** funciones por rol acotado y prueba de permisos/sesiones antes de cualquier cutover.
- Bloqueador de despliegue: falta orden explícita del Owner para conectar una cuenta Auth/STAGING real, dominios/credenciales seguros y fuente externa de certificados/documentos. No inventar disponibilidad ni permiso.

## Política Owner invariable

**NO MERGE, NO LIVE, NO VPS, NO DEPLOY, NO PSP, NO PII real.** PR #7 y PR #8 DRAFT. Éxito en PostgreSQL CI no convierte en operativas las aplicaciones. Registrar siempre SHAs y los cuatro workflows del **mismo SHA**.
