# QORE Mobile — Arquitecto A · G48/A29: delegación SQL de privilegio mínimo y sesión verificada (QA)

**Fecha:** 23 de octubre de 2026 · **Rama:** `feature/mobility-monorepo-isolated-20261016` · **PR A:** #7 DRAFT · **PR B:** #8 DRAFT, sin editar.

## Decisión arquitectónica

G46 revocó las tablas y RPC históricas de comercio G6/G9/G44; G47 revocó las RPC antiguas de documentos Driver. Una aplicación no puede restablecer `EXECUTE TO service_role` para evitar esas restricciones. **G48 agrega un camino de delegación de sólo lectura, exclusivamente en PostgreSQL 16 descartable, sin convertirlo en un servicio real.**

El problema que resuelve: un `_actor_id` o `_session_id` recibido por HTTP nunca constituye autoridad. Sólo el OWNER de la base de datos QA puede emitir un comprobante opaco tras constatar un grant G42 sintético; un nuevo rol `mobility_g48_gateway_ci` **NOLOGIN/NOINHERIT** no puede conectarse ni generar pruebas, leer tablas ni invocar RPC antiguas. Recibe `EXECUTE` de **tres funciones específicas** que exigen un comprobante de un solo uso. No hay rol de servicio con permisos universales.

### Implementado

1. **`G48_SCOPED_DB_DELEGATION_POSTGRES_CI_ONLY.sql`**: guard explícito `qore_disposable_chain`, `qore_ci_disposable_chain` y prerequisitos G42/G44/G47; `CREATE ROLE mobility_g48_gateway_ci NOLOGIN NOINHERIT`. Las tablas privadas `mobility_stage_g48_delegation_proofs` (hash SHA-256 de UUID aleatorio, identidad y sesión, alcance, recurso, caducidad 30 s, `consumed_at`) y `mobility_stage_g48_ticket_audit` guardan sólo metadatos sintéticos, no tokens JWT, secretos, documentos ni URL. Trigger impide UPDATE/DELETE del log.
2. **Emisión owner-only:** `mobility_stage_g48_mint_owner_attested_qa(actor,session,iat,purpose,resource)` solo invocable por propietario local de CI. Valida el bloqueo transaccional G42, rol exclusivo Driver o passenger, y recurso autorizado antes de generar un UUID aleatorio; almacena **únicamente el SHA-256 del UUID**. Tipos `DRIVER_STATUS`, `DRIVER_LEASE_PROBE`, `BUYER_CATALOG_PAGE`. Esta función **NO está conectada a un verificador Auth real** y jamás debe exponerse a clientes.
3. **Consumo privado `mobility_stage_g48_consume_ticket_qa`:** hace `SELECT ... FOR UPDATE` del hash, comprueba alcance, TTL 30 s, ausencia de consumo, session grant vigente en G42 **bloqueado en la misma transacción**, rol único y recurso; marca consumo y añade evento inmutable. Sin prueba, no ejecuta lectura. El rol delegado **NO** puede llamarla directamente.
4. **Tres consultas DB de solo lectura** para `mobility_g48_gateway_ci`:
   - `mobility_stage_g48_driver_status_qa(ticket)` reutiliza el estado sanitizado G17 sin paths, hash, bucket, contenido ni URL.
   - `mobility_stage_g48_driver_lease_probe_qa(ticket)` reutiliza G47, sin enlaces firmados ni bytes, condicionado a sesión G42 + lease Driver vigente.
   - `mobility_stage_g48_buyer_catalog_page_qa(ticket,expectedRevision,after)` reutiliza G44, con precios del servidor en PYG, branch específico, validación de revisión y **100 artículos por página, sin límite global del catálogo**. Checkout, cobertura legal y producción siempre falsos.
5. **Node `g48-scoped-db-gateway-qa.mjs`**: recibe verificador de JWT proveedor independiente, revocación y rol exclusivos, limitador, simulador privado de emisión owner-only y RPC delegado. El cliente no entrega actor, sesión, rol, hash, bucket, precio ni comprobante; el Node sólo entrega DTOs sellados de lectura. Todos los errores fallan cerrados. Se crea exclusivamente con `environment:'isolated_staging',localQaOnly:true,liveEnabled:false`.
6. **OpenAPI `1.0.0-g48`** añade tres contratos futuros sin HTTP montado: `GET /v1/staging/driver/documents/status-g48`, `POST /v1/staging/driver/evidence/probe-g48`, `GET /v1/staging/buyer/branches/{branchId}/catalog-g48`. Cada uno declara `x-qore-runtime-wired:false`, `x-qore-qa-only:true`, `x-qore-owner-attestation-synthetic-only:true`. Los flags globales `x-qore-g48-runtime-wired:false` y `x-qore-g48-provider-to-db-proof-wired:false` evitan presentarlos como servicios reales.

## Pruebas reproducibles

- `G48_SCOPED_DB_DELEGATION_ASSERT_POSTGRES_CI_ONLY.sql`: comprueba que el rol NOLOGIN no tiene acceso a siete tablas base, RPC de emisión, G17/G47/G6 ni grants directos; sólo ejecuta tres consultas de lectura. Comprueba Driver y Buyer exclusivos, precios autoritativos 12.500 Gs, scope incorrecto, consumo único, auditoría inmutable y revocación G42.
- `g48-scoped-db-delegation-race-ci.py`: dos conexiones PostgreSQL simultáneas, rol delegado, misma prueba → **una lectura SUCCESS, otra G4804**; emite otra prueba y revoca sesión antes de consumirla → G4801 sin nueva lectura. No usa identidad real.
- `g48-scoped-db-gateway-qa.test.mjs`: rechazo de JWT no verificado, sesión revocada, roles mixtos, filtros falsos, token de alcance ajeno, caducidad, comprobantes extendidos/alterados, precio inventado, PII y flags LIVE.
- `g48-delegation-openapi-contract.test.mjs`: bloquea regresiones que monten las rutas, autoricen actor, PII, archivos o producción.
- La cadena PostgreSQL CI instala G48 **después de G47**. Ninguna prueba toca entornos externos ni concede permiso a `service_role` en producción.

## Riesgos que siguen abiertos

1. **Puente proveedor Auth no conectado.** La función owner-only de emisión obtiene identidades sintéticas del fixture y no prueba que un JWT real provenga del proveedor. No convertir un `G48 PASS` en autorización de sesión real. El rol delegado NOLOGIN aún no tiene credencial de servicio, proxy SQL, ni conexión TLS.
2. **Sólo lectura.** Los flujos de compra, gestión de comercios G6/G9, subida/revisión documental G17 y concesión de enlaces a contenido permanecen bloqueados; abrirlos requiere RPC de escritura específicas con pruebas transaccionales propias y autorización formal.
3. **No existe HTTPS STAGING real autorizado.** Para ello faltan credenciales externas seguras, issuer/audience/JWKS reales, rotación, mapeo de sesión y AAL2, política RLS, herramienta de despliegue y autorización expresa Owner. No configurar infraestructura o secretos sin aprobación.
4. **Privacidad y cumplimiento**: Paraguay, retención KYC, cifrado Storage, scanner AV real, regulación de movilidad y geofencing, políticas de consentimientos/descarga necesitan validación legal y técnica antes de trabajo con documentos o pasajeros.
5. **Coordinación Arquitecto B**: no consumir rutas G48 como si fueran endpoints activos ni activar `checkout`, `catalogReadReady`, `runtimeReady`, ni modificar Driver. B conserva exclusivamente Cliente + Admin; A conserva Node/SQL/Driver y su propia documentación. Issue #9 contiene el traspaso.

### Próximas unidades

**G49** diseño e implementación QA de *grant-service* autenticado por proveedor (comprobación criptográfica, scopes y revocación) sin usar permisos heredados y sin habilitar remoto. **G50** ensayos end-to-end sintéticos de flujo Cliente–Admin–Driver; integración Lovable UI sólo tras infraestructura operativa y orden Owner.

**Gobierno invariable:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP, NO PII real, PR #7/#8 DRAFT.
