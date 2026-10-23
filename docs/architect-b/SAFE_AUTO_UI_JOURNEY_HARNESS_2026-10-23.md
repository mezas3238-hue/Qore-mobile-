# Movete Fácil — B25 harness UI sintético del viaje AUTO seguro

**Fecha:** 23 de octubre de 2026
**Ámbito:** Arquitecto B; Cliente Passenger QA, sin backend ni operación comercial.
**Estado:** pruebas locales completas; GitHub Actions del commit de este bloque pendientes al redactar.

## Objetivo

Certificar el recorrido visible que hoy sí puede ofrecer el Cliente sin engañar al pasajero:

`editar ruta → revisar localmente → preparar borrador → visualizar “no enviado” → descartar`

La prueba termina antes de precotización, aceptación de precio y búsqueda de conductor porque esos pasos dependen de los contratos A-02/A-03. El harness nunca inventa precio, cobertura, GPS, conductor, reserva ni dispatch.

## Implementación

Nuevo `safe-auto-ui-harness.mjs`, ejecutado sobre las APIs públicas de `client-experience`:

- valida viaje Passenger únicamente en AUTO;
- admite Económico, Confort y XL como preferencias, sin prometer disponibilidad;
- genera `requestKey` solamente después de Auth y revisión válida;
- representa etapas `EDITING`, `REVIEWED_LOCAL`, `PREPARED_NOT_SENT` y `SERVER_RESULT_PENDING`;
- deja `canQuote=false` y `canSearchDriver=false` mientras falta el contrato backend;
- expone `serverQuote=null`, `assignedDriver=null` y `gps=null`;
- permite descartar únicamente un borrador `ready` que nunca salió a red;
- sincroniza `privateViewRevision`, borrando ruta/feedback al rotar JWT o cerrar sesión.

El harness es headless y determinista: prueba el contrato de experiencia sin depender de un navegador ni afirmar que la exportación web equivale a Android/iOS.

## Casos probados

1. Sin Auth: la revisión local funciona, pero no prepara request ni llama a red.
2. Con Passenger sintético: preparación y descarte conservan cero llamadas de red y una sola clave.
3. Ruta origen/destino equivalente: se rechaza antes de generar clave.
4. Rotación JWT: desmonta el borrador visible y borra ruta/feedback de la sesión anterior.
5. Intento de continuar a cotización/conductor: `PREQUOTE_AND_DISPATCH_CONTRACT_PENDING`.

## Evidencia local

- Cliente: **204/204 tests PASS**, 0 FAIL.
- TypeScript: SUCCESS.
- Expo web export: SUCCESS.
- El bloque agrega 4 pruebas; no elimina ni relaja las 200 existentes.

## Límites

- No es prueba táctil en Android/emulador ni accesibilidad con lector de pantalla.
- No certifica Auth real, OpenAPI desplegada, precio, rutas, oferta de conductores ni idempotencia en DB.
- No habilita botones de cotización/búsqueda. Las operaciones remotas siguen OFF.
- Siguiente bloque seguro: B-03, recorrido equivalente para envíos AUTO/MOTO de carga, errores/offline y privacidad de destinatario.

