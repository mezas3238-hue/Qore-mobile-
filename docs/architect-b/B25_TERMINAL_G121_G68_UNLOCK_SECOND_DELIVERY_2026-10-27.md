# Arquitecto B25 — habilitar segundo envío QA después de prueba terminal G121 + G68

27 octubre 2026 · QORE Mobile · PR #8 DRAFT · No LIVE · Cliente Android/iOS.

## Fallo funcional identificado
La persistencia B19 y B23 protege contra pedidos duplicados, pero antes no ofrecía **ningún mecanismo seguro de liberar las claves** después de una entrega finalizada. El teléfono quedaba con `G5 requestKey` y `G7 quoteRequestKey` pendientes por tiempo indefinido; incluso una entrega correctamente terminada no permitía preparar un segundo envío.

Además, el G121 de A devuelve estados `requested, accepted, picked_up, delivered, disputed, returned, cancelled`, pero el lector Cliente B17 rechazaba todo excepto `requested`. Tras reiniciar el dispositivo cuando el envío avanzó, Cliente no podía reconciliar el identificador original.

## B25 implementado
1. `g121-delivery-registration-gateway.mjs` acepta **los siete estados documentados por A**, manteniendo contrato exacto de 9 campos, identidad `ownerId`, `requestKey`, vehículo AUTO/MOTO y revisión. No convierte `delivered` en comprobante de entrega: sigue siendo lectura de registro.
2. `g68-terminal-delivery-release.mjs` exige **G121 fresco + G68 fresco**, ambas respuestas de la misma sesión Passenger, mismo `deliveryId`, `requestKey`, vehículo y dueño, estados concordantes `delivered` o `returned`, prueba `proofVerified===true`, revisión monotónica y entrada del mismo historial privado vigente. Rechaza `requested`, `accepted`, `picked_up`, `cancelled`, `disputed` o G68 sin prueba final.
3. Keychain/Keystore: `NativeDeliveryRecoveryStore` y `NativeG126QuoteRecoveryStore` ahora permiten **borrado por comparación estricta de identificadores originales**, en cola serializada, nunca `delete(ownerId)` a ciegas. Primero se borra la clave G7 y **solo después** la G5; si hay fallo parcial, G5 sigue bloqueando nuevos envíos hasta lograr conciliación. Nunca se toca un registro de otro `deliveryId`.
4. `ClientExperience.finalizeDeliveredDeliveryQa()` vuelve a consultar ambos GET autorizados antes de limpiar datos opacos locales; controla sesión, mutación e historial durante cada paso. Después de borrar, relee la ausencia en almacenamiento seguro, limpia la mutación local, y permite preparar **otro borrador QA**. No borra el servicio, la prueba, la tarifa, el pago, el ledger ni historial del servidor.
5. `app/envios.tsx` muestra `Cerrar envío de prueba finalizado y preparar otro` solamente si el Cliente ya verificó ambas pruebas terminales; revalida al tocar. Permanece **invisible** en la app sin rutas G121/G68 habilitadas.

## Obligaciones externas que impiden LIVE
- G121/G68 deben estar montados en STAGING real con RLS y JWT Passenger verificables; CI PG16 simulada no equivale a despliegue.
- La devolución final exige prueba G68; no basta botón Driver ni un `G121 delivered`.
- G68 `delivered` puede avanzar a disputa; liberar un **cerrojo local** no modifica ledger, precios históricos ni proceso de reclamación posterior.
- A G129 Geoapify Free logró una única petición real de ruta pero faltan geocodificación/cobertura, peajes, cuota atómica, política Owner, precotización anterior a reserva y viaje completo B↔A↔C↔D.
- Comisiones Owner configurables en los cinco servicios (COMMERCE por categoría todavía incompleto).
- Sin merge, despliegue Render/Supabase, cuentas con pagos, PSP ni publicación Stores.

## Evidencia
`g68-terminal-delivery-release.test.mjs` cubre FINALIZE QA → preparación de segundo envío, devolución, Owner/vehículo/mutación falsos, token rotado, comprobante no final, error almacenamiento, cotización de otro envío. Adjuntar CI exacta al issue #16.
