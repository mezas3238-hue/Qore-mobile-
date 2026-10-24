# QORE Mobile — Arquitecto B, R63 · custodia del remitente vinculada a historial vigente

**Corte:** 2026-10-24 · Rama B `feature/mobility-cliente-admin-parallel-20261022` · PR #8 **DRAFT**, no merge/no LIVE.

## A verificado y límite de contrato

- PR #7 HEAD leído al iniciar R63: `a208b651fe6f25faa2eb2d7e8522ae26de0cf592` (G66).
- G66 expone lógica de **courier privado Driver** `GET /v1/staging/courier/deliveries/{deliveryId}/custody`; rechazar cualquier uso desde Passenger.
- OpenAPI de A a ese corte `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` en versión `1.0.0-g57`, blob `87429af570cead4fba85a609b8f374d3748040d8`, no define GET `/v1/staging/sender/deliveries/{deliveryId}/custody` tipado/verificado ni runtime HTTPS montado.
- Documento G66 pide a G67 prueba independiente cifrada y autoridad verificable. Ni prueba sintética ni UUID de `proofRef` certifican una entrega real.
- Para integrar después, **solo A** debe publicar GET sender-scoped autorizado por JWT Passenger y owner de entrega en DB, revisión/estado/proofVerified certificado, errores tipados y HTTPS STAGING permitido. Registrar dependencia en issue #9.

## Cambio implementado exclusivamente en rutas de B

1. `apps/movete-cliente/src/domain/sender-custody-flow.mjs`: despejar la evidencia anterior **antes** del nuevo GET, sin perder el control de regresión monotónica `revision` del mismo envío.
2. `apps/movete-cliente/src/domain/client-experience.mjs`: anclar la evidencia al `ownerId`, `deliveryId` y `revision` del ítem del historial propio con TTL vigente. Si desaparece el ítem, cambia la revisión, caduca la página, se reemplaza el historial o rota la sesión/JWT, destruir el estado de custodia y cancelar el resultado tardío.
3. Evitar dos lecturas concurrentes que sobreescriban el ancla del primer GET: el segundo intento no emite transporte adicional ni cambia el `deliveryId` autorizado.
4. `apps/movete-cliente/src/domain/r63-sender-custody-history-guard.test.mjs`: diez ensayos con respuestas puramente sintéticas para TTL, cambio de historial, incremento de revisión, dos envíos, respuesta post-reset, expiración intra-GET, JWT girado, cuenta cruzada, intento no autorizado y concurrencia de doble GET.

## Garantías y alcance real

- La certificación de estos cambios será QA de código exclusivamente; consultar los tres workflows del SHA final de PR #8, no referenciar CI de otro commit como evidencia nueva.
- **No** se cambió Driver/Node/PostgreSQL/OpenAPI/infra; no se abrió HTTPS ni se desplegó la API; no hay aplicación instalada ni prueba de entrega real.
- Gates `enabled`, `contractCertified`, `stagingRuntimeVerified` permanecen opt-in explícitos, default OFF. Las pruebas ejercitan solo inyecciones QA. No deben activarse por documentación o por CI verde.
- **NO_GO**: 17 requisitos críticos y 20 flujos operativos del handoff R60 pendientes de certificación independiente.

## Próximo desbloqueo funcional

A certifica AUTH Passenger, GET sender custody por SQL con scope exacto y `proofVerified` de fuente independiente; después B añade adaptador HTTPS seguro, integra UI histórica y valida en un mismo STAGING persistente con Driver y Admin, revocación y dos dispositivos físicos. En ausencia de esa dependencia B puede avanzar en KYC/Admin, pedidos y pruebas de sesión sin editar archivos A.

**Prohibiciones:** NO MERGE, no deploy, no producción, no PSP, no PII real y no inventar éxito de E2E.
