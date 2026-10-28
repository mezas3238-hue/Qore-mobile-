# QORE Mobile — frontera OpenAPI para la interfaz G11

**Fecha:** 2026-10-22  
**Estado:** contrato STAGING versionado; NO es un despliegue público.

`docs/backend/openapi/movete-facil-staging.openapi.json` define los endpoints
autenticados G2–G10 y fija la frontera que más adelante consumirá Lovable.
Lovable podrá presentar formularios, estados, mapas y paneles; no recibirá
autoridad para decidir identidades, roles, tarifas, distancia, comisiones,
elegibilidad, asignaciones, saldos ni estados persistentes.

El contrato:

- usa OpenAPI 3.1 y bearer Supabase verificado;
- apunta exclusivamente a loopback STAGING;
- sella todos los request bodies con `additionalProperties: false`;
- excluye campos derivados como actor, conductor, precio, comisión y ruta;
- documenta métodos simulados y categorías farmacéuticas solo OTC;
- elimina de la interfaz la aceptación directa por `delivery_id`; G10 exige
  una oferta privada vigente.

`server/g11-openapi-contract.test.mjs` controla cobertura de rutas,
operationIds únicos, aislamiento localhost/no-LIVE y ausencia de autoridad
derivada en cuerpos de cliente. El contrato se mantendrá sincronizado antes de
iniciar el diseño definitivo en Lovable.
