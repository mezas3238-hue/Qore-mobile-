# B22 — Recuperación G126 de la cotización ORIGINAL de envío AUTO/MOTO

26 oct 2026 · Arquitecto B · PR #8 DRAFT · no producción.

## Dependencia A confirmada
En HEAD A d0743e5194e694591417361fc36f41bb018323d7, G126 PostgreSQL16 certificó `mobility_stage_g126_recover_cargo_quote_qa(senderId,deliveryId,originalRequestKey)`: el endpoint G7 POST, al recibir de nuevo la MISMA `requestKey`, verifica si ya existe la cotización previa de esa entrega para el mismo emisor, clase de vehículo, regla G124, evidencia G125, distancia, duración, peajes y tiempo original; si sigue vigente la devuelve **sin volver a consultar al proveedor de rutas**. Nunca debe dar permiso de despacho ni de cobro. CI SQL/HTTP A: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40425767535 . Datos y ruta CI **sintéticos**, no prueba proveedor Routes real.

## Cambio funcional B22
- `g122-delivery-price-consent-flow.mjs`: conserva en memoria de la sesión el `quoteRequestKey` generado para la primera petición autenticada G7. En respuesta ambigua `quote_unknown`, prohíbe generar otra clave; sólo permite **una** recuperación explícita por el usuario si `g126OriginalKeyRecoveryVerified===true`, usando el **mismo** POST a G7 `/v1/staging/fares/quote` con exactamente `{requestKey,fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId}`. G126 recupera o valida el precio original; B vuelve a verificar todo el DTO G7, owner, deliveryId, importe/version/TTL/split. Error HTTP 409 / token rotado / actor ajeno / cuerpo forjado dejan estado bloqueado después de ese único intento. Nunca hay bucle o retry automático.
- `client-experience.mjs` permite `recoverOriginalDeliveryQuote()` sólo con la misma G121 privada del mismo `deliveryId`, account/JWT y mutación fallida original. `BookingRecoveryPanel.tsx` muestra acción QA explícita, no confunde consentimiento con pago. `ClientRuntime.tsx` flag extra **OFF por defecto** `EXPO_PUBLIC_G126_ORIGINAL_KEY_RECOVERY_VERIFIED`, independiente de G121/G122/tarifa/ruta.
- `g126-delivery-quote-recovery-client.test.mjs`: tests directos e integración real de módulos B19 (SecureStore simulado) → G121 GET → G7 POST ACK perdido → G126 mismo key → G122 aceptación; falsificación, conflicto, JWT, errores, sin crear otro pedido.
- La cotización **no se guarda en SecureStore**: cuando se termina el proceso en plena pérdida de G7 ACK, sigue bloqueada la recuperación desde cero hasta disponer de contrato independiente idempotente documentado para persistencia del quoteKey. No fingir resolución completa de cierre inesperado en esa etapa; B19 cubre el primer pedido G5.

## Gate comercial
No proveedor de rutas real, ni tarifario definitivo configurado ni COMMERCE global, ni emisión de permiso legal G38/G71, ni certificado externo STAGING. No hay cambios de porcentajes ni tarifa local. **No MERGE, LIVE, recursos de pago, ni despliegue.**
