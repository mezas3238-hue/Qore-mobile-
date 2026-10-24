# Arquitecto B — seguridad del gateway Cliente STAGING (23/10/2026)

El HTTP genérico ahora requiere habilitación explícita `enabled`, certificación `contractCertified` y autorización de cada operación por `certifiedOperations`. Antes, sólo `enabled` podía permitir red. Todo permanece OFF por defecto. Los servicios de tarifa, status de viaje y comercio usan gateway tipado dedicado o siguen bloqueados.

Validación de sesión Passenger: UUID de sujeto, authRevision, JWT y expiración, con nueva comprobación tras 401/403 y tras GET/POST 200/201. Respuestas tardías de JWT anterior no cierran login nuevo ni devuelven datos privados. HTML, redirecciones, contenido excesivo, JSON inválido, 200 en lugar de 201 y 409 se rechazan sin inventar confirmación de despacho/pago.

Bajo G11 el POST de envío y solicitud de viaje todavía tiene respuesta genérica y no una prueba cerrada de adjudicación: el 201 representa únicamente ACK HTTP. No se ha conectado a UI ni autorizado STAGING real. Falta prequote sin despacho, JWT/RLS, recibos tipados, E2E y autorizaciones.

NO MERGE / NO LIVE / no cambios a A, Driver ni workflows.
