# G42 — JWT público fijado + autoridad de sesión/revocación (QA solamente)

**Arquitecto A, 23-10-2026.** Continuidad de G41, sin tocar rama B.

## Implementado
1. `g42-provider-pinned-jwt-auth-qa.mjs`: verifica la firma JWS de acceso mediante **claves públicas JWK fijadas** en un Map del servidor, `kid` y algoritmo ES256 / RS256 (RSA >=2048) / EdDSA. Emisor URL HTTPS exacto terminado en `/auth/v1`, audiencia `authenticated`, `role=authenticated`, `sub` y `session_id` UUID, límites iat/nbf/exp y TTL <= 1 h, JSON/base64url canónicos. Rechaza cambios de firma, keys privadas en configuración, URL `jku`, `alg=none`, confusión alg/kid y antiguos kid removidos. Las claves privadas de los tests se crean **en memoria**, jamás en GitHub. La exigencia de JSON canónico es un contrato restrictivo QA; se debe comprobar compatibilidad con serialización de JWT reales antes de uso externo.
2. Adaptadores reutilizables para G27/G39/G40/G41: `verifyAccessToken`, `verifySessionNotRevoked`, `verifyBackofficeMfa` dependen de autoridad **independiente del token** `readProviderUser`, `readProviderSession`, `readPrivateSessionGrant`. La marca `aal2` presente en JWT no concede MFA: la sesión del proveedor debe informarlo con expiración y fecha verificadas. No se confía en `app_metadata.roles` para Admin. Los adaptadores reales de lectura de proveedor y JWKS pinning aún deben configurarse de forma segura; no hay conexión de credenciales reales ni HTTP.
3. PostgreSQL 16 descartable `G42_PROVIDER_SESSION_REVOCATION...`: tabla privada, RLS y DML totalmente revocado incluso a `service_role`. Solo el database-owner de CI siembra sesiones sintéticas. RPC `mobility_stage_g42_session_active` deniega la ausencia de registro, actor distinto, sesión revocada, expirada o emisión del token anterior a la fecha de autorización. El RPC `mobility_stage_g42_lock_session` mantiene `FOR SHARE` dentro de una **misma transacción** de una operación protegida; una comprobación HTTP separada no constituye un candado transaccional.
4. Pruebas Node de firmas ES256/RS256/EdDSA, actor/cuenta/sesión/MFA, rotación, provider outage, DB outage, e integración *de laboratorio* con G41. Pruebas PostgreSQL de grants/revocaciones reales, TTL, derechos DML y cross-user.

## Riesgos pendientes, sin afirmación de disponibilidad real
- **No hay todavía emisor de Auth conectado**, JWKS obtenidas en forma segura del proveedor autorizado ni pruebas de tokens reales. Las claves usadas para QA son efímeras sintéticas. No hay credenciales, ni secretos en el repo.
- La persistencia real de `auth.sessions` en Supabase no equivale a este registro sintético; se requiere un sincronizador firmado y proveedor/usuario verdaderamente aprobado, permisos de cuenta y revocación de la autoridad upstream.
- El registro está **inherentemente cerrado** a nuevas sesiones: no existe operación insertable por service_role; falta implementar el provisionador independiente y políticas de revocación de usuario/administrador.
- En una futura operación con efecto persistente, el servidor deberá ligar `g42_lock_session` a la misma transacción de la mutación (no basta un check anterior). Backend G41 es sólo lectura eventualmente consistente.
- MFA AAL2 debe venir de proveedor real, no solamente de `JWT.aal`. HTTPS STAGING, validación contra identidad real, RLS y pruebas adversariales en entorno aprobado continúan pendientes.

**Gobernanza:** NO LIVE/NO MERGE/NO deploy/NO SQL remoto. PR #7 DRAFT; B conserva Cliente/Admin Web separados.
