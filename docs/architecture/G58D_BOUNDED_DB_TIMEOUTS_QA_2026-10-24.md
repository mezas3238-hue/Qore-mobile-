# QORE Mobile — G58D / A44: conexiones SQL acotadas y timeouts

**Fecha:** 24 octubre 2026. **Repo:** mezas3238-hue/Qore-mobile-. **Owner técnico:** Arquitecto A.
**Ambiente:** CI local desechable y QA sintética exclusivamente. **PR #7/#8 DRAFT. Sin LIVE, merge ni deploy.**

## Alcance realmente construido

1. `server/g58d-bounded-sql-leases-qa.mjs`: guard de adquisición y consultas SQL. Capacidad máxima 4 conexiones simultáneas en G58B, rechazo inmediato de nuevas solicitudes cuando se agota la capacidad, timeout de adquisición 800 ms y de consulta 2500 ms. Tiempo excedido, error SQL o entrada de query inválida **envenenan** el préstamo y fuerzan `release(true)` (destrucción del cliente al devolverlo al pool). La conexión no regresa libre y reutilizable si una consulta sigue pendiente. Una conexión que llegue *después* de vencer el plazo se destruye al llegar. No existen credenciales embebidas ni acceso remoto.
2. `server/g58-delegated-chat-sql-qa.mjs`: además de la allowlist cerrada de G49/G56/G57, configura dentro de la misma transacción los límites SQL `statement_timeout=2500ms`, `lock_timeout=500ms` y `idle_in_transaction_session_timeout=3500ms` antes de `SET LOCAL ROLE`. Se restablecen con COMMIT o ROLLBACK; nunca vienen del usuario HTTP. El ejecutor valida la identidad SQL efectiva, la base `qore_disposable_chain` y el nombre de aplicación, y rechaza cambios de rol/BD.
3. `server/g58b-local-auth-chain-qa.mjs`: incorpora guard G58D al circuito G42 JWT firmado → usuario y sesión/grant independientes → rol único → rate gate G58C → ticket sintético → SQL delegado → cinco rutas localhost G58. No expone el guard, la conexión SQL, el emisor de tickets ni secretos en HTTP.
4. `server/g58d-bounded-sql-leases-qa.test.mjs`: capacidad, adquisición tardía descartada, timeout SQL con conexión envenenada y `release(true)`, prohibición de COMMIT posterior al timeout en cliente simulado, limpieza idempotente y denegación de modo LIVE. El test del ejecutor confirma tres `SET LOCAL` antes del rol delegado.
5. `server/g58d-disposable-sql-timeouts-ci.py`: prueba contra PostgreSQL16 verdadero en **localhost**. Comprueba los tres límites de transacción bajo el rol SQL Passenger, recuperación después de cancelación por `statement_timeout`, un bloqueo de advisory lock entre dos conexiones donde `lock_timeout` vence, ROLLBACK y recuperación del cliente, y que `SET LOCAL` no persiste tras terminar transacción.
6. Workflow `.github/workflows/mobility-g4-postgres-disposable.yml`: agrega al final de la cadena la prueba PostgreSQL16 de G58D.

## Límites deliberados

Este código es un **control sintético local**, no un pool productivo. El login PostgreSQL productivo no está definido ni aprovisionado con privilegios mínimos; G58B todavía usa emisor de tickets y provider simulados, aunque JWT en CI sea firmado con una clave temporal. El backend no se ha conectado a Supabase real ni a móviles Android/iOS. No habilitar un HTTP público ni el chat comercial por pasar CI.

Un timeout que coincida con la fase COMMIT real deja resultado de transacción **indeterminado** desde la perspectiva del cliente. Nunca afirmar que una respuesta de error implica rollback confirmado o reintentar automáticamente un envío de mensaje sin idempotencia por requestKey. Para la fase comercial, usar cancelación real de PG, timeouts de infraestructura, correlación sin PII, pruebas de caída de conexión y verificación de persistencia posterior al timeout.

## Lo siguiente (G58E / A45)

- Emisor de tickets con autorización real de proveedor y sesión, vía backend con credenciales separadas y auditadas, **no** funciones owner-mint de fixture.
- Driver de conexión PostgreSQL con login propio de gateway, grants mínimos, pool con cancelación PostgreSQL comprobada y aislamiento en STAGING autorizado.
- Riesgos de HTTP slowloris, límites de headers/body y request deadlines; respuesta segura sin filtrar JWT, sesión o mensajes.
- Conflictos/reintentos idempotentes de envíos e historial, contabilidad de límites de solicitudes distribuida y auditoría de revocación.
- Conectar UI Driver únicamente cuando existan autenticación real/servidor seguro y pruebas físicas. UI Cliente/Admin sigue siendo responsabilidad exclusiva de B.
- Para cerrar CI, exigir PostgreSQL, Node, Expo y aislamiento **SUCCESS sobre exactamente el mismo SHA**. No inferir LIVE.

**Gobernanza:** No fusionar PR #7/#8, no tocar B, no publicar credenciales, no VPS, no pagos ni LIVE sin orden Owner.
