# B16 · Reserva segura AUTO/MOTO Cliente · 26 octubre 2026

Cambio funcional: ningún viaje ni envío queda reconocido solo por HTTP 201. Se exige recibo QA exacto del servidor con owner JWT, requestKey, operación, ID persistente y revisión. Ante timeout, 409 o ACK ambiguo se retiene la clave, se bloquean POST adicionales y solo un GET autorizado de conciliación puede resolver la situación. El controlador entrega un deliveryId propio mediante verifiedDelivery() únicamente tras la verificación del recibo.

**Evidencia:** archivos client-mutations.mjs, client-mutations.test.mjs y client-experience.test.mjs. Cobertura de AUTO/MOTO, segundo toque, sesión revocada, payload 201 falso, GET con otro owner y logout. Estas pruebas NO certifican un envío completo ni un STAGING desplegado.

**Dependencia real de A (#15):** OpenAPI g101 expone POST /v1/staging/sender/deliveries/request, pero carece de una precotización de envío AUTO/MOTO con precio en Gs previo a consentimiento, quoteId/TTL vinculado a requestKey y booking, lectura privada por clave de reserva y cancelación auditada. El endpoint /v1/staging/fares/quote solicita subjectId previo y no reemplaza la precotización. Entregar contrato HTTPS JWT + DTO estricto + integración transaccional PostgreSQL; entonces conectar UI envios.tsx. C debe recibir el mismo deliveryId para oferta/entrega; D debe consultar el mismo ID en backoffice.

**Estado:** QA sintética únicamente, NO_GO G38/G71, no comercial, sin merge/deploy/pagos.
