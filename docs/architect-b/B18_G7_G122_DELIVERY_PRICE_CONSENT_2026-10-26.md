# Arquitecto B18 — G7 y G122: revisión y consentimiento de tarifa ENVÍOS

26 octubre 2026 · PR #8 DRAFT · QA exclusivamente

## Capacidad
En Cliente, solo tras recuperar con A G121 una solicitud propia `AUTO` o `MOTO` (`deliveryId` original), obtener con un POST autenticado G7 `/v1/staging/fares/quote` la cotización autoritativa del servicio `DELIVERY`. Validar totalidad, PYG, quoteId, sujeto, owner, TTL, versión y elementos del recibo G7. Mostrar el importe exacto para aceptación humana explícita y enviar G122 `POST /v1/staging/sender/deliveries/quotes/confirm` con un `confirmationKey` nuevo, monto y versión. Aceptar exclusivamente el DTO exacto QA con `paymentAuthorized:false`, `dispatchEnabled:false`, `serverPersisted:true`, ID del mismo envío/quote/actor/vehículo y `confirmed_qa`.

## Cortafuegos
1. Arranca **desactivado**: habilitar solo con certificados independientes externos del propietario, backend, RLS, Owner tariff real, routing real y cerca G123 SQL. Una prueba PG16 localhost, una ruta inventada, o datos sintéticos NO habilitan venta.
2. Precio sale exclusivamente de G7; nada calculado en móvil. `AUTO` y `MOTO` usan el mismo `fareMode:DELIVERY` pero G122 devuelve y obliga a cotejar el vehículo ligado a G121 y a la regla comercial SQL. No aplicar porcentajes de pasajeros a envíos.
3. Un POST G7 con fallo/ACK ambiguo bloquea otro quote POST; un POST G122 incierto bloquea confirmación adicional. No hay aún GET reconciliador G122. `confirmationKey`/precio jamás se alteran o repiten automáticamente.
4. Panel muestra "QA", sin cobro, despacho ni repartidor; el botón principal `Cotizar y solicitar repartidor` permanece OFF.
5. Se borran estados al salir o rotar sesión; no persistir precios privados o tokens en archivos.

## Dependencias A pendientes para recorrido comercial real
- **Precotización previa al pedido** con origen/destino geo verificados, disponibilidad territorial y tarifa Owner de ENVÍOS AUTO/MOTO, no solo cotización posterior a G5.
- Alta de reserva y consentimiento en una transacción con ledger, sin PSP implícito y sin doble descuento.
- GET idempotente para resolver G7/G122 ACK incierto.
- E2E unificado PostgreSQL16 B→C→D, G38 territorial, G71 KYC vigente y despliegue STAGING bajo aprobación Owner.

Sin merge, sin deploy, sin LIVE, sin pagos. Certificación se adjunta en #16.
