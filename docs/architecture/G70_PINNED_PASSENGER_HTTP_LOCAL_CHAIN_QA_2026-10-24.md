# QORE Mobile / Movete Fácil — G70 A59
## Cadena HTTP local firmada para custodia privada del remitente (QA)

**Corte:** 24 octubre 2026 · Arquitecto A · PR #7 DRAFT · NO LIVE / NO MERGE / NO DEPLOY.

### Motivación y resultado
G67 validó atomicidad de comprobantes y G68/G69 implementaron la lectura privada de envíos desde PostgreSQL16 con grants mínimos y atestación de un solo uso. **G70 conecta ahora en QA un JWT ES256 firmado de laboratorio, validación independiente de sesión G42 y rol Passenger, emisión sintética owner y canje G69 mediante un servidor HTTP real enlazado exclusivamente a `127.0.0.1`.**

El servidor no es una API HTTPS pública, no usa proveedor externo, no aloja aplicaciones, no usa cuentas reales y no habilita entrega ni pago comercial. Las bases reales de PostgreSQL16 de G67/G69 y la cadena HTTP firmada G70 se prueban en workflows complementarios; **el exchange SQL del test HTTP es un double en memoria**, no una misma base persistente desplegada.

### Código entregado

- `apps/mobility-expo/server/g70-pinned-sender-local-chain-qa.mjs`: compone `createG42PinnedJwtVerifier` con `issuer/audience/kid/JWK` fijos y firma ES256/RS256/EdDSA, `createG42ProviderSessionAdapters` con consultas independientes de usuario/sesión/grant privado, rol Passenger exclusivo, `createG69TrustedSenderReadQa` y transporte HTTP G70. No confía en `app_metadata` ni en rol del JWT como autorización final.
- `apps/mobility-expo/server/g70-sender-custody-loopback-qa.mjs`: solo escucha en `127.0.0.1` puerto efímero. GET exacto `/v1/staging/sender/deliveries/{deliveryId}/custody`; URL sin query/percent/redirect, métodos y body no autorizados, Host no loopback, cookies/Origin/Referer, cabeceras Authorization duplicadas y JWT ausente son rechazados. Respuesta sellada de 11 claves B R65: estado/revisión/propiedad/G67 proofVerified sin `proofRef`, GPS, teléfonos, driverId ni secretos; incluye no-store y políticas de caché/HTML seguras.
- Tiempo límite propio de lectura privada (2200 ms); ante timeout u outcome desconocido no reintenta automáticamente la operación con un token de un solo uso ni afirma que la prueba SQL no se consumió. Rate/capacidad y conexión están restringidos al laboratorio.
- `apps/mobility-expo/server/g70-pinned-sender-local-chain-qa.test.mjs`: abre un servidor HTTP Node real, firma JWT con clave privada generada solo en el proceso de pruebas, realiza `fetch` contra 127.0.0.1, valida G42 sesión y rol independientes, scope privado, prueba emitida/usada una vez, firma manipulada, JWT expirado, audiencia/issuer falsos, Driver y Passenger ajenos, revocación, método/URL/body/headers, DTO SQL adulterado, PII y fallos de backend.
- G69 continúa dando lectura delegada con `mobility_g69_execute_ci` NOLOGIN y `proof_hash` SHA256 a través de PostgreSQL16 disposable. Las pruebas PG reales de dos conexiones viven en `g69-sender-custody-scoped-read-race-ci.py`.

### Limitaciones y seguridad

1. **Ruta HTTP local NO equivale a HTTPS STAGING real.** La especificación OpenAPI G69 sigue marcando `x-qore-runtime-wired:false`; no cambiarla a true ni activar los opt-ins Cliente de B sin pruebas externas, IdP proveedor, API TLS y base duradera autorizada.
2. El ejemplo firmado de laboratorio **no es una cuenta de Supabase ni un JWT de producción**. Ningún secreto, clave privada o `service_role` se añade al repositorio.
3. El emisor de `proof` del test es sintético privado. No exponer una ruta de emisión o SQL mint a la app Cliente, a Driver o a un navegador.
4. La función G69 debe seguir comprobando `sender_id=JWT.subject`, `delivery_id`, sesión G42 tomada hasta COMMIT y prueba G67. La cadena Node valida esas responsabilidades separadas antes de canje, no sustituye el fence SQL.
5. Una respuesta HTTP 503 por pérdida de canje de autorización no equivale a una entrega revertida ni justifica un segundo mutador comercial.
6. La app Driver no incorpora lógica de Cliente; el Arquitecto B mantiene `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`, PR #8 DRAFT.

### Regresión/certificación

Ejecutar **en el mismo SHA** las cuatro matrices: PostgreSQL disposable, Node STAGING, Expo y aislamiento nativo de las dos apps. CI SUCCESS certifica laboratorios y SDK de interfaces, no usuarios/teléfonos ni comercialización.

### Próxima prioridad

**G71**: preparar y cerrar un protocolo verificable de despliegue de **HTTPS STAGING autorizado** (DNS/TLS y rotación de secretos, provider JWKS realmente pinneado, sesión G42 ligada al DB, permisos RLS y falsaciones 401/403/429/503, métricas sin PII). Seguir escribiendo validadores y manifiestos QA mientras proveedor externo no esté aprobado. Una vez autorizado, validar en **dos teléfonos físicos** Cliente y Driver viaje AUTO y delivery con GPS consentido, historia/chat y comprobantes reales cifrados. Sin autorización no desplegar ni pedir tráfico real.

**El lanzamiento comercial sigue NO_GO 0/17 gates.** NO MERGE, NO LIVE, NO VPS, NO PSP, NO PII real, NO secrets, NO cambio de rama B sin orden Owner.
