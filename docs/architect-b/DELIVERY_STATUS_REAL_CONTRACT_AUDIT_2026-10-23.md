# Movete Fácil — B-05 auditoría del contrato real de status de envíos

**Fecha:** 23 de octubre de 2026  
**Fuente:** PR #7 de Arquitecto A, HEAD `346f9dfcbd2fc3a57cb7951c473120bc8571d88d`.  
**Resultado:** bloqueo de contrato confirmado; no se crea un gateway ficticio.

## Evidencia

El OpenAPI `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` declara 47 paths y mantiene versión informativa `1.0.0-g11`.

La operación `GET /v1/staging/deliveries/{deliveryId}/status`, `operationId=getParticipantDeliveryStatus`, define:

- parámetro `DeliveryId` UUID;
- respuesta `200` mediante `#/components/responses/Success`;
- response `Success` con schema `type: object`, sin propiedades requeridas;
- error default mediante el esquema genérico `Error`.

El contrato sí describe el request de creación y las transiciones de delivery, pero eso no define el snapshot autoritativo que la app Cliente debe leer.

## Datos que B no puede inferir

Sin un DTO estricto no se puede certificar:

- que `deliveryId` coincide con la consulta y pertenece al JWT;
- revisión monotónica y estado persistido;
- si una asignación de repartidor fue aceptada de forma atómica;
- qué identidad mínima del repartidor puede mostrarse y cuándo;
- permiso, precisión y frescura de GPS/ETA;
- devolución, disputa, cancelación o entrega confirmadas;
- referencia de prueba de entrega con autorización y retención;
- flags que distingan capacidad staging de operación comercial.

Aceptar un objeto genérico permitiría que la UI presentara campos no certificados o datos de otra cuenta. Por eso B no implementa un projector ni habilita `deliveryStatus` en el gateway genérico.

## Contrato requerido de A

A debe publicar una response versionada y con `additionalProperties:false` que cierre, como mínimo:

1. titular/participante derivado del JWT y coincidencia de `deliveryId`;
2. revisión monotónica, estado permitido y timestamps del servidor;
3. semántica de asignación/aceptación persistida;
4. reglas de exposición de repartidor, GPS, ETA y su frescura;
5. metadata segura de prueba de entrega, sin URL pública ni PII innecesaria;
6. reconciliación tras timeout y respuestas 401, 403, 404, 409, 410, 429 y 503;
7. flags inequívocos de entorno y habilitación comercial.

B podrá crear el gateway dedicado cuando esos campos existan en el contrato de A. Hasta entonces la UI conserva `deliveryId`, `courier` y `gps` en `null` y no afirma que un envío fue solicitado, asignado o entregado.

## Conclusión

Este es un bloqueo real de integración, no una razón para sustituir el backend por una demo. El resto del trabajo independiente de Cliente/Admin continúa en B-06 y siguientes.
