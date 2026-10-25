# R72 — Lectura financiera G94 del mismo viaje AUTO (QA solamente)
Fecha: 2026-10-25. Arquitecto B, PR #8 DRAFT. No MERGE/LIVE.

**Entregable:** después de booking G73 confirmado, subsidio G93 verificado del
mismo Passenger, quoteId, bookingKey y tripId, Cliente ofrece GET privado
`/v1/staging/rider/auto/bookings/{bookingKey}/financial-status`.
El GET no lleva body ni crea booking, pago, refund ni nuevo despacho.
DTO exacto G94 se valida contra recibo G93 y revisión inicial G73:
ownerId, bookingKey, quoteId, tripId, cuatro montos, tripRevision creciente,
tripState ↔ financialState, contabilidad original balanceada,
reversión balanceada solo si cancelado, PSP falso siempre.

La lectura también funciona cuando la cotización expiró DESPUÉS de una
reserva confirmada: un ancla mínima de montos verificados vive solo en RAM
y se revoca con JWT, logout, cambio de usuario o cancelación del draft.
Los cambios de cuenta y los errores limpian todos los montos visibles.

`EXPO_PUBLIC_F1_G94_FINANCIAL_STATUS_VERIFIED=true` exige certificación
independiente de A. OFF por defecto; la disponibilidad G73/G93 no lo habilita.
Contrato A OpenAPI G94 marca **runtime wired=false**, external staging=false.
CI Node de Cliente es simulación: NO demuestra PG externo, PSP ni app instalable.
La pantalla dice expresamente RESERVED/VOIDED/COMPLETED_UNSETTLED_QA,
nunca pagado/devuelto. G94 queda bajo autoridad server-side SQL.

**Bloqueo P0:** A certificar la misma DB persistente
G73 quote→G93 preview→booking→cancel G65/G94→historial G26→Admin G75;
JWT/RLS propio y casos 401/403/404/409/503. Pruebas 2 teléfonos
Android/iOS y ambiente autorizado aún pendientes.
