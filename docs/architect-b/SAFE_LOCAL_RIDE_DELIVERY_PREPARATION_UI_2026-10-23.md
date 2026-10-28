# Arquitecto B — Solicitudes Cliente AUTO y envíos como borradores seguros

23/10/2026 · PR #8 DRAFT · Cliente Mobile

## Construcción
- `client-request-preparation.mjs`: construye cuerpos exactos del OpenAPI A G11 para `rideRequest` y `deliveryRequest` con UUIDv4 del sistema operativo, tras validación de ruta, categoría, peso, dimensiones y restricciones. Sin precio, distancia, GPS ni tokens; no envía nada por red.
- Vistas reales `app/viaje.tsx` y `app/envios.tsx`: pasos revisar → preparar con Passenger autenticado → mostrar estado local → descartar. Edición de datos bloqueada mientras el borrador está preparado para impedir que el usuario vea algo distinto al cuerpo inmutable. No se permite el despacho ni el pago.
- `client-experience.discardPreparedMutation`: únicamente borradores `ready` nunca enviados, con `operation` y `requestKey` coincidentes. No borrar nunca `in_flight`, `retryable`, `failed` ni `acknowledged`; si hubo timeout hay que conciliar para evitar duplicados.
- Las vistas borran direcciones, categorías y medidas locales en cambio de cuenta; sin almacenamiento persistente.

## QA y límites
- Payload exacto para viaje AUTO y envío en MOTO carga/AUTO; 5 categorías, peso máximo de MOTO 10 kg, AUTO 100 kg, dimensiones 1-200 cm, sin fármacos con receta ni productos restringidos.
- Rechazo de formatos numéricos ambiguos `''`, exponentes, negativos y decimales; sin Math.random ni UUID sintético.
- Pruebas de descarte justo antes del envío y no descarte tras timeout o 201.
- El botón que buscaría conductor/repartidor permanece **OFF** porque A no certificó `quote-before-dispatch`, DTO negocio para request, Auth/RLS ni STAGING externo. El montaje en Lovable se realizará después del cierre de infraestructura.
- No nuevos endpoints inventados, NO MERGE/NO LIVE, sin tocar A/Driver/workflows.
