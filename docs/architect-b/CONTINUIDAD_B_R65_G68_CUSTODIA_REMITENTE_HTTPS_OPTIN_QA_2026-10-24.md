# QORE Mobile — Arquitecto B R65 · adaptador HTTPS privado de custodia sender G68

**Fecha:** 24 de octubre de 2026 (PY) · PR #8 DRAFT, rama B `feature/mobility-cliente-admin-parallel-20261022` · desarrollo seguro sin LIVE.

## Evidencia A realmente leída en este corte

- PR #7 HEAD: `04245a72518a66cc09298da371a9b45072d3617e` (G68).
- `docs/architecture/G68_SENDER_PRIVATE_DELIVERY_CUSTODY_QA_2026-10-24.md` (blob `28db0f34f3473ace948fe70d0343d6a019bd5691`).
- Node A `g68-sender-custody-status-qa.mjs`: ruta lógica **GET /v1/staging/sender/deliveries/{deliveryId}/custody**, JWT Passenger, sesión G42 no revocada, remitente derivado del token y query PostgreSQL `id + sender_id`, comprobante G67 privado.
- G67 asegura prueba atómica solamente en SQL CI disposable, no evidencia comercial.
- OpenAPI A actual `1.0.0-g57` (blob `87429af570cead4fba85a609b8f374d3748040d8`) **todavía no publica** esta ruta ni su respuesta; la función G68 NO está montada en HTTPS público.
- HEAD A: 4/4 SUCCESS GitHub Actions QA, HEAD B previo R64: 3/3 SUCCESS.

## Implementación concreta exclusiva de B

1. `apps/movete-cliente/src/domain/sender-custody-http-gateway.mjs` y `.d.mts`: transporte HTTPS de **GET** con host fijado, no redirects, no credenciales en URL, sin body/PII, `Authorization: Bearer` Passenger, `cache:no-store`, respuesta UTF-8 acotada, Abort y reloj límite, revalidación de actor/JWT/revisión antes y después del body.
2. Requiere conjuntamente `enabled`, `contractCertified`, `stagingRuntimeVerified`, **`g68SenderContractCertified`**; **false por defecto**. No interpretar la existencia del archivo G68/CI verde como permiso para ponerlos a true. No se configuró endpoint ni token real.
3. Rechaza toda clave DTO adicional (proofRef, courierId, teléfonos, hash, GPS), dueño ajeno, flags LIVE, cambios de estado/revisión y evidencia de entrega no certificada. 401/403 revocan sesión **solo** si el JWT es el mismo después del fetch.
4. `apps/movete-cliente/src/domain/client-experience.mjs/.d.mts`: `senderCustodyHttpOptions` opcional. Se enlaza al lector propio R62-R63 con historial TTL/revisión únicamente si existe runtime explícitamente habilitado; `senderCustodyOptions` tradicional y configuración HTTP concurrentes producen OFF (no doble autoridad).
5. `sender-custody-flow.mjs` ahora exige `proofVerified:true` para **disputed**, además de `delivered`/`returned`, concordante con A G68. `cancelled` nunca comunica prueba positiva.
6. `sender-custody-http-gateway.test.mjs`: 12 tests adversariales de transporte/DTO, inyección, tiempos, revisiones, rol, errores y privacidad.
7. `r65-g68-sender-http-integration.test.mjs`: 7 tests en composición real de `ClientExperience`: default OFF, flujo sintético autorizado, doble fuente rechazada, proof faltante, 403, TTL/JWT y cuenta cruzada.

## Alcance de certificación

El test inyecta un `fetchImpl` sintético; no accede a una URL real, no prueba sesiones G42 en un entorno durable ni prueba entrega física. CI debe ser **3/3 SUCCESS en el mismo HEAD final** (propiedad B, Admin QA y aislamiento Cliente/Driver). **NO** convertir `qaOnly` en entrega real o finalizar `DELIVERY_MERCHANTS`.

## Bloqueos remanentes y acciones de A

- Publicar OpenAPI versionado con schemas **G68** y códigos 401/403/404/429/503, una implementación HTTP montada y revisada con origen HTTPS certificado, Auth Passenger JWT real, G42 y G67 en misma DB STAGING persistente autorizada.
- Evidencia anti-IDOR, dos cuentas, JWT revocado/rotado, dos conexiones de SQL, entregar y GET sender sin exponer proofRef y prueba de fallo de servidor/desconexión.
- Identificar commits/hashes exactos de backend, ratificar costo/proveedor por Owner cuando aplique. Sin estos no habilitar flags, ni afirmar certificación funcional.

**No cambios A:** Driver, Node, SQL, OpenAPI, workflows o root. **No merge, deploy, LIVE, PSP, documentos reales ni secretos.** NO_GO comercial; continúan los 17 P0/20 recorridos E2E del handoff.
