# Arquitecto B — UI G40 con activación estricta en STAGING (23-10-2026)

El formulario actual de soporte sigue siendo borrador local NO ENVIADO. Se añadió una segunda sección de reporte estructurado G40 visible solamente con usuario Passenger autenticado y client.incidentReport.contractReady, que por defecto es FALSE porque A marca x-qore-runtime-wired=false.

Servicios RIDE/DELIVERY/MERCHANT_ORDER, motivo enum, gravedad LOW/MEDIUM/HIGH, UUID de servicio y clave UUID v4 del generador nativo Expo Crypto. No se admite CRITICAL/SOS, teléfonos, cédula, dirección ni descripción. Acciones preparar, enviar en QA, reintentar con la MISMA clave, descartar solo antes de envío y consultar estado del recibo DB QA. Nunca se anuncia despacho de emergencias ni atención humana. El backend valida pertenencia al servicio.

QA de dominio prueba validez y no creación de claves inseguras. CI cliente Expo/TypeScript, Admin y aislamiento pendientes de certificación en HEAD. No MERGE ni LIVE.
