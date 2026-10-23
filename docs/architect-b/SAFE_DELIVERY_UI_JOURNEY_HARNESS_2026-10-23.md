# Movete Fácil — B26 harness UI seguro de envíos AUTO/MOTO

**Fecha:** 23 de octubre de 2026
**Ámbito:** Arquitecto B; Cliente Passenger, QA sintética y operaciones remotas OFF.
**Estado:** pruebas locales completas; GitHub Actions del commit B26 pendientes al redactar.

## Objetivo

Cerrar B-03 con un recorrido verificable de envíos de carga:

`editar → validar reglas → preparar borrador temporal → mostrar no enviado → bloquear servidor/offline → descartar`

La implementación no solicita repartidor, no asigna `deliveryId`, no muestra GPS y no incorpora nombre o teléfono del destinatario.

## Implementación

Nuevo `safe-delivery-ui-harness.mjs`, que usa `validateDeliveryForm`, `prepareLocalDeliveryRequest` y las APIs públicas de `client-experience`.

- MOTO se limita a carga de hasta 10 kg.
- AUTO admite hasta 100 kg según el validador existente.
- Dimensiones son enteros positivos de hasta 200 cm; no acepta decimal ni exponente.
- Categorías permitidas siguen el contrato local aprobado; artículos restringidos se rechazan.
- `recipient` permanece `null`: este flujo no modela ni persiste PII de destinatario.
- `deliveryId`, `courier` y `gps` permanecen `null`.
- Offline devuelve `OFFLINE_NO_REQUEST_SENT`; online sin contrato devuelve `DELIVERY_CONTRACT_PENDING`.
- En ambos casos `serverRequestSent=false` y no existe llamada a red.
- Rotación JWT remueve ruta, feedback y borrador temporal mediante `privateViewRevision`.

## Pruebas añadidas

1. MOTO válida: preparar y descartar, una requestKey, cero red, cero repartidor/destinatario.
2. Sobrepeso MOTO, dimensión >200, restringido, decimal y exponente: bloqueo antes de UUID.
3. Offline y contrato pendiente: estados explícitos sin transmisión.
4. Rotación JWT: limpieza de ruta y borrador visible.

## Evidencia local

- Cliente: **208/208 tests PASS**, 0 FAIL.
- TypeScript: SUCCESS.
- Expo web export: SUCCESS.
- Cuatro pruebas nuevas; las 204 anteriores permanecen activas.

## Límites

- No existe receipt/status de entrega tipado y certificado por A; no se crea gateway de estado ficticio.
- No es prueba Android táctil ni autoriza datos de destinatarios reales.
- No certifica capacidad de zona, precio, repartidor, entrega, firma, foto, notificación ni prueba de recepción.
- Siguiente trabajo B independiente: B-04 comercios, restringido a catálogo/stock versionado y checkout DEMO sin compra live.

