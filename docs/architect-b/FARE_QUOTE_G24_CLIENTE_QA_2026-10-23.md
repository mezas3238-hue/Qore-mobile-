# Arquitecto B — G24 Cotización server-side en guaraníes, 23 octubre 2026

### Código nuevo QA
- fare-quote-gateway.mjs: POST /v1/staging/fares/quote con JWT Passenger, HTTPS pinned, sin precio ni comisiones enviados por el móvil. Valida ServerPricedQuoteV1 y recibo G7 coincidente, caducidad y owner.
- fare-quote-flow.mjs: serialización antes del primer await, requestKey estable en timeout, retry explícito, limpia si logout/token cambia, no acepta ACK de usuario viejo.
- client-experience + cotizacion.tsx: uso opcional, OFF por defecto; cita en la UI un viaje propio previamente confirmado por GET. Muestra solo la tarifa que aceptó quote-view, expira por TTL.
- Nuevas pruebas unitarias adversariales y composición E2E sintética (no son STAGING real).

### Dependencia del Arquitecto A
El contrato FareQuote exige subjectId UUID de servicio ya existente. Para experiencia 'cotizar antes de buscar conductor' se necesita contrato prequote/draft, que cree un ID sin despachar viaje y sin cargo; B no puede inventarlo. Hay que resolver el orden cotización → aceptación del usuario → despacho antes de habilitar UX comercial.

### Límites
Sin JWT/RLS real, HTTPS STAGING remoto, pagos, PSP, precios LIVE, ni despliegue. PR #8 DRAFT, NO MERGE, separación Cliente/Driver/Admin.
