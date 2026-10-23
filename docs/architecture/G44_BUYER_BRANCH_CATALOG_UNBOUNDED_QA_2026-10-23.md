# QORE Mobile — G44 / A25 · descubrimiento de sucursales y catálogo Buyer por cursor
**Corte:** 2026-10-23 · **Responsable:** Arquitecto A · **PR #7 DRAFT**.

## Avance ejecutado
1. **SQL PG16 descartable**: `G44_BUYER_DISCOVERY_CATALOG_POSTGRES_CI_ONLY.sql` agrega mapeo sintético sucursal→zona G31+municipio+servicio y `catalog_versions` por sucursal. Ninguna fila de zona comercial se considera legalmente elegible: G31 mantiene `eligible_by_policy=false`; el DTO lo refleja. No derivar municipio automáticamente de una etiqueta de pickup.
2. **Versionado transaccional**: triggers invalidan el cursor cuando cambia stock, precio, artículo, estado sucursal, comercio, mapeo o zona. Lectura privada toma bloqueo `FOR SHARE` sobre revisión e invoca `G42_lock_session` DENTRO de su propia transacción. La siguiente página exige revisión igual; cualquier cambio provoca `G4409` (HTTP 409 mediante gateway).
3. **SQL privados**: `mobility_stage_g44_buyer_branches_page` y `mobility_stage_g44_buyer_catalog_page`. Requieren identidad `passenger` exclusiva, sesión provider-sourced G42 aún vigente, sucursal aprobada y mapeada; ambos limitan a **100 filas por respuesta, no total global**. Sin permisos públicos. `service_role` tiene ejecución de funciones restringida, no DML sobre mapeo/versiones; siguen pendientes las restricciones de DML históricas G6/G9 antes de LIVE.
4. **Node**: `g44-buyer-catalog-qa.mjs`, `createG44BuyerCatalogQa`; contrato inyectable con JWT firmado/identidad y rol server-side, revocación independiente, rate limit, firma HMAC SHA256 de cursor ligada a proyecto, actor, sesión, ruta, municipio/servicio o sucursal y versión. Keys actuales/anteriores para rotación, TTL 60 s, clave jamás expuesta. Rechazo de datos extra, importes/stock falsos, productos diferentes a `GENERAL` y `PHARMACY_OTC`; ninguna prescripción.
5. **Compatibilidad G42**: el adaptador de Auth devuelve ahora `tokenIatMs` certificado por JWS, imprescindible para el bloqueo SQL de sesión. No leer iat del body de Cliente.
6. **OpenAPI 1.0.0-g44** introduce `GET /v1/staging/buyer/branches` (municipality, serviceKind, cursor) y `GET /v1/staging/buyer/branches/{branchId}/catalog` (cursor). Ambos `x-qore-runtime-wired:false` y `x-qore-qa-only:true`; esquema respuesta sellado, `orderEnabled:false`, `eligibleByPolicy:false`, `productionEnabled:false`.
7. **Pruebas**: SQL `G44_BUYER_DISCOVERY_CATALOG_ASSERT_POSTGRES_CI_ONLY.sql` recorre 205 ítems (100+100+5), prueba aislamiento de sesión/actor, privilegios, mapeo y versión caducada. Node prueba 13.000 ítems en 130 páginas, 241 sucursales, HMAC actor/sesión/sucursal/filtro/rotación, reintentos, 409 por cambio versión, inyección PII, página vacía y outages. CI PG incorporado al workflow global. Consultar el SHA exacto de cada acción al certificar.
   
## Límites de G44 — NO aparentar un catálogo comercial activo
- PostgreSQL de CI es descartable y usa identidades/documentos/stock sintéticos; G44 no ejecutó SQL remoto y no levantó HTTPS.
- G31 no tiene geocerca legal/permiso asegurador certificado: `coverage_status=ACTIVE` no permite pedidos, asignación o checkout. La API de G44 devuelve información de diagnóstico QA, no productos comprables.
- La comprobación de revocación externa en el gateway es preliminar; la autoridad definitiva de lectura reside dentro de la transacción de la DB. Integración provider Auth real todavía bloqueada por configuración/autorización G46.
- No existe validación real de comercio, stock, IVA, pagos, soporte ni logística comercial en LIVE. Versionado de catálogo no es garantía de precio al pagar; G45 recalcula y reserva con transacción propia.
- No se tocó `apps/movete-cliente/**`, `apps/movete-admin/**` ni `docs/architect-b/**`, ni se habilitaron flags B. El Cliente B conserva catálogo/checkout OFF hasta STAGING HTTPS certificado y E2E cruzado.
- Mantener **PR #7 y #8 DRAFT, NO MERGE, NO DEPLOY, NO LIVE, NO VPS, NO PSP ni datos personales auténticos**.

## Próximo bloque A sin espera
**G45**: pedido comprador durable con `requestKey`, `catalogVersion`, locks concurrentes sobre catálogo/stock, comprobante server-priced en PYG, idempotencia 409, cantidades, stock y compensación/cancelación simulada sin PSP. Antes, auditar G6 de mutaciones directas concedidas a `service_role` y retirar atajos tras reubicar funciones privilegiadas seguras, sin romper contratos G9.
**G46**: Auth/STAGING HTTPS real solo cuando Owner lo autorice; credenciales fuera del repo y pruebas reales JWT/RLS/revocación/roles antes de activar B.
**Issue #9**: transferir contrato OpenAPI y SHA/CI al B. No prometer runtime verificado por CI sintética.
