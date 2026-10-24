# QORE Mobile / Movete Fácil — G68 / A57: custodia privada para remitente

**Estado:** implementación de laboratorio PostgreSQL16 desechable y contrato Node sintético. **NO_GO / NO LIVE / NO MERGE / NO DEPLOY**. Fecha: 2026-10-24. Rama Arquitecto A en PR #7 DRAFT. Interfaz de B en PR #8 DRAFT es intocable por A.

## Problema que resuelve

G66 permite que únicamente el Driver asignado consulte la custodia de un paquete. El remitente con rol Passenger nunca puede reutilizar el DTO/ruta privados del Driver. El Arquitecto B R62 requiere lectura propia y atributos exactos, además de certificación independiente de prueba de entrega G67.

## Código

- `apps/mobility-expo/server/g68-sender-custody-repository.mjs`: lookup restringido en **SQL** por `id=deliveryId AND sender_id=JWT.subject`. Un UUID conocido no equivale a autorización. Lectura acotada de estado, revisión, vehículo y referencia privada solo dentro del backend.
- `apps/mobility-expo/server/g68-sender-custody-status-qa.mjs`: función simulada de `GET /v1/staging/sender/deliveries/{deliveryId}/custody` y rechazo de otra ruta/método/cuerpo/headers ajenos. Requiere verificador JWT pinneado externo, sesión no revocada, rol exclusivo Passenger, límite de peticiones, consulta autoritativa y comprobante G67 verificado por DB. No hay HTTP montado ni URLs públicas.
- `apps/mobility-expo/server/g68-sender-custody-qa.test.mjs`: casos adversariales de scope, proof false, DTO estricto, token, sesión, timeout/fallo de DB, no PII.
- `apps/mobility-expo/docs/backend/staging_only/G68_SENDER_OWNED_DELIVERY_READ_POSTGRES_CI_ONLY.sql`: `mobility_stage_g68_sender_custody_owner_qa` owner-only; usa `mobility_stage_g42_lock_session`, rol Passenger exclusivo, `SELECT ... WHERE id=... AND sender_id=... FOR SHARE`, `mobility_stage_g67_proof_verified_owner_qa` para terminales, y niega permisos SQL a anon/authenticated/service_role. Se prohíbe ejecutar fuera de la DB `qore_disposable_chain` con `application_name=qore_ci_disposable_chain`.

## DTO exacto para Arquitecto B (R62)

```json
{
  "mode": "STAGING_DEMO_ONLY",
  "deliveryId": "uuid",
  "ownerId": "uuid",
  "state": "requested|accepted|picked_up|delivered|disputed|returned|cancelled",
  "revision": 1,
  "vehicleKind": "AUTO|MOTO",
  "assignmentPersisted": false,
  "proofVerified": false,
  "qaOnly": true,
  "productionEnabled": false,
  "liveDeliveriesEnabled": false
}
```

**Datos excluidos:** teléfono, nombre, GPS, remitente/courier privado, ubicación, ruta, media, hash, proofRef, bucket, ticket, credenciales. `proofVerified` deriva únicamente de G67 PostgreSQL; un booleano del teléfono no tiene autoridad. `delivered`, `disputed` o `returned` requieren que el comprobante persista consumido/verificado. La consulta no provoca ack, push ni modificación del envío.

## Dependencias/bloqueos concretos

- G67 canónico SQL debe quedar **SUCCESS** con pruebas de 2 conexiones; 4 workflows en el mismo SHA, sin reinterpretar fallos.
- La función Node es una **ruta lógica**, no un endpoint HTTPS montado. Autenticación real IdP, TLS, secretos/hosting, base persistente y dispositivos físicos E2E requieren autorización y proveedores: **NO_GO** hasta entonces.
- Arquitecto B puede alinear con su DTO R62 y ensayar su mock, pero no activar `contractCertified`, `stagingRuntimeVerified`, ni `enabled` sin evidencia de runtime desplegado. No tocar sus archivos.
- No usar el `service_role` en app Cliente y no abrir grants de lectura de proofs.
