# Movete Fácil — G13/G14/G15: notificaciones privadas, concurrencia y fallback

**Fecha:** 22-10-2026 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **PR:** #7 DRAFT.
**Alcance:** exclusivamente pruebas sintéticas y PostgreSQL 16 desechable, sin LIVE, VPS, SQL remoto, pagos ni dispositivos reales.

## G13 — recuperación protegida de notificaciones

Se añadió `G13_DELIVERY_PUSH_FENCED_DISPOSABLE_CI_ONLY.sql` **después** de G10/G12, junto con `g13-fenced-delivery-push-repository.mjs` y `g13-fenced-delivery-push-worker.mjs`.

1. CLAIM asigna identificador de reclamación `claim_nonce` además de `claimed_by` y `claimed_at`.
2. Una reclamación sin envío iniciado puede ser recuperada después de 12 segundos, solo si la oferta sigue vigente. Cada recuperación rota `claim_nonce`.
3. BEGIN exige el `claim_nonce` vigente, mismo worker, validez temporal y estados de oferta/entrega correctos, antes de autorizar un efecto en proveedor.
4. ACK exige worker + `claim_nonce` vigente + estado BEGIN. No equivale a entrega ni recepción en dispositivo.
5. Una reclamación que ya pasó a BEGIN **no se reintenta automáticamente**, porque el resultado del proveedor podría ser ambiguo. Mantenerla para conciliación y permitir que el repartidor descubra la oferta por polling.
6. Reclamos legacy G12 quedan marcados como potencialmente enviados (fail-closed); los RPC G12 sin nonce pierden permiso `service_role`.
7. Limpieza de vencidos se limita a lotes de 100 con `SKIP LOCKED`, solo para reclamaciones sin BEGIN.

**Límites sin resolver:** ausencia de adaptador/proveedor push real con deduplicación garantizada, confirmaciones desde dispositivo, conciliación de intentos ambiguos y operación de monitoreo. No decir «exactly once» extremo a extremo.

## G14 — competencia de asignación

`server/g14-competing-courier-acceptance-ci.py` prueba con **dos conexiones reales PostgreSQL** y dos repartidores sintéticos habilitados. Ambos compiten por una entrega G5/G10. Se verifica una única aceptación, retirada de la segunda oferta, replay idempotente del ganador y un único evento de asignación.

## G15 — polling independiente del push

`G15_COURIER_PRIVATE_OFFER_POLL_POSTGRES_CI_ONLY.sql` añade el RPC `mobility_stage_poll_courier_delivery_offers(_courier_id)` exclusivo de `service_role`, con filtro de oferta en estado offered, entrega requested, destinatario exacto, caducidad y límite de cinco. No requiere ACK ni recibo push.

`g15-courier-private-poll-repository.mjs` y `g15-courier-private-poll-gateway.mjs` sirven:

`GET /v1/staging/courier/delivery-offers`

El gateway verifica bearer vía Auth, cuenta confirmada, rol driver y límites; **ignora identidades en body/query**. Retorna solo `offerId`, `deliveryId` y `expiresAtMs` por oferta, con `deviceReceived=false` y `pushDelivered=false`; no expone remitente ni GPS. Polling sugerido STAGING: 5000 ms. La ruta quedó conectada al transporte local y al runtime aislado; OpenAPI incluye su esquema de respuesta.

**Condición para usarlo en un entorno aislado autorizado:** instalar/aprobar esquema G15 y verificar disponibilidad de Auth real, sin habilitar LIVE. En ausencia del adaptador, loopback falla cerrado (503).

## Evidencia CI e interpretación

- PostgreSQL G13 y concurrencia independiente G14: las pruebas ejecutan migraciones G1/G2/G3/G4/G5/G10/G12/G13/G15 contra PostgreSQL 16 desechable.
- Node: pruebas del worker, JWT, RPC, respuesta mínima, caducidad, rechazo de suplantación, HTTP real en `127.0.0.1`, OpenAPI.
- Expo: regresión aislada, no prueba de GPS/push en teléfonos.
- El commit `e01e905033902ad312e149f7d675dc34264ec039` tenía PostgreSQL #46, Node #167 y Expo #677 **SUCCESS**. Los commits posteriores de protección explícita contra SQL no desechable requieren un nuevo CI verde antes de declararse cerrados.

## Próximos frentes técnicos sin autorización LIVE

1. Observabilidad agregada y reconciliación de envíos G13 en estado BEGIN ambiguo; nunca reenviar automáticamente sin prueba sólida de idempotencia del proveedor.
2. Validar G15 en clientes Expo Android/iOS simulados, reconexión, backoff, caducidad y desaparición de ofertas aceptadas/rechazadas.
3. Integrar contratos de cancelación, rechazo, reasignación y no-show en AUTO/MOTO/envíos con pruebas de concurrencia y persistencia.
4. Integración comercial completa G6/G9 (inventario/órdenes) con G5/G10 de entrega; pricing separado AUTO/MOTO/envíos; G7 ledger sintético.
5. Seguridad/privacidad: revocación de sesión, límites distribuidos, rotación token, KYC, seguro, legal por zona y dispositivos reales.
6. Integración final Lovable como capa visual, no lógica de autorización o comisiones. Requiere pruebas E2E autorizadas.

**Prohibiciones vigentes:** NO MERGE; NO LIVE; NO VPS; NO SQL remoto; NO pagos, push o despliegues reales sin autorización.
