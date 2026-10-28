# QORE Mobile — B24 · Registro de envío QA con prueba independiente de propiedad

Fecha: 27 octubre 2026 · Arquitecto B Cliente · PR #8 DRAFT · NO comercial

## Entrega funcional
Se integran los **contratos reales** de A para registro QA de entrega AUTO/MOTO:
- `POST /v1/staging/sender/deliveries/request` G5 crea la fila de QA por `requestKey` G5 y tipo `AUTO/MOTO`, después de que B19 haya guardado la clave en SecureStore. La respuesta 201 G5 tiene solo cinco campos y **no** acredita propietario/requestKey/vehículo; no se proyecta como booking.
- `GET /v1/staging/sender/deliveries/requests/{requestKey}` G121 comprueba con JWT del mismo Passenger, misma revisión, `ownerId/requestKey/deliveryId/vehicleKind/revision` y estado serverPersisted. Sólo ese readback permite a la capa de mutaciones publicar `acknowledged` con DTO estricto de QA. No es reparto comercial, precio ni pago.
- Si POST G5 pierde ACK, queda `failed` con misma `requestKey` segura y el Cliente dispone de conciliación **SOLO GET** G121. Un 404/409/503 o body falso no genera otro POST.
- La pantalla `app/envios.tsx` puede mostrar sólo bajo certificados independientes una acción `Registrar envío de prueba QA (sin repartidor)` sobre borrador preparado. Además exige tags QA oficiales `[A-Z_]{3,40}` de zona, nunca direcciones de texto, y rechaza input inválido antes de red. El botón comercial `Cotizar y solicitar repartidor` sigue DESACTIVADO.
- Envío QA reconocido sigue permitiendo consulta G121, cotización/consentimiento B18 de la misma ID (bajo su autorización separada), sin interpretar aceptación como Driver asignado.

## Banderas OFF por defecto, separadas de G121/G122/G126
`EXPO_PUBLIC_G5_QA_REGISTRATION_APPROVED`, `EXPO_PUBLIC_G5_CONTRACT_VERIFIED`, `EXPO_PUBLIC_G5_EXTERNAL_RUNTIME_VERIFIED`, `EXPO_PUBLIC_G5_PASSENGER_RLS_VERIFIED`, `EXPO_PUBLIC_G5_OWNER_TARIFF_GATE_VERIFIED`.
Además G121 requiere `EXPO_PUBLIC_G121_OWNER_APPROVED`, `EXPO_PUBLIC_G121_CONTRACT_VERIFIED`, `EXPO_PUBLIC_G121_EXTERNAL_RUNTIME_VERIFIED`, `EXPO_PUBLIC_G121_PASSENGER_RLS_VERIFIED` y URL HTTPS Render fijada. Sin estos contratos, cero POST G5.

## Limitaciones
La App QA de hoy recibe **direcciones libres**, pero A G5 reconoce sólo tags de prueba (no GPS/Place ID/verificación de zona); el botón de registro QA exige explícitamente tags válidos y está deshabilitado en todos los entornos no certificados. A G128/G129 Geoapify llegó a UNA consulta real de prueba, pero **aún faltan** cuota durable, geocodificación real, cobertura/peajes, tarifas oficiales antes de booking, G38/G71, Driver/Administrador/ledger de misma ID. No liberar comercial ni solicitar repartidor por un G5 de QA. No mentir ETA/Disponibilidad ni aplicar tarifas de Bolt.

Comisiones (mandato Owner): siguen configurables por servicio en Backend/Admin; 10% subsidio sólo pasajeros y COMMERCE categoría aún pendiente A/D. Sin merge, despliegue, pagos, Store ni gastos.

## Tests
`g5-g121-verified-delivery-booking-gateway.test.mjs` simula red con DTOs **reales** A G5 y G121; verifica SOLO POST+GET, rechazo de G5 201 espurio/cambio AUTO-MOTO/owner/tokens, fallo de red + readback independiente, persistencia B19 antes del POST, no reenvío tras éxito, sin comerciales. Evidencia CI Github Actions del commit B24 en issue #16.
