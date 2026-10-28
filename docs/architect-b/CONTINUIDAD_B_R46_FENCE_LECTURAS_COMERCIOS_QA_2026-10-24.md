# QORE Mobile / Movete Fácil — Arquitecto B · R46 lecturas seguras de comercio
Fecha: 24 de octubre de 2026. Repositorio soberano `mezas3238-hue/Qore-mobile-`; PR #8 DRAFT, base PR #7 de Arquitecto A. Continuación directa de R45.

## Implementación de código R46
- `apps/movete-cliente/src/domain/commerce-ui-read-fence.mjs`: compuerta privada de una lectura de UI en vuelo, con bloqueo síncrono ANTES del primer `await`, invalidación por generación al cambiar filtros/selección, descarte de respuestas visuales tardías después de cerrar pantalla/sesión y errores genéricos que no exponen excepciones privadas.
- `commerce-ui-read-fence.d.mts`: contrato tipado para ejecución, resultado, invalidación, desecho y estado.
- `commerce-ui-read-fence.test.mjs`: 10 casos adversariales con Deferred Promise: doble toque sin segunda llamada, feedback desactualizado por cambio de filtro, desmontaje, rechazo red sin filtraciones, handlers inválidos, callbacks con error, liberación del bloqueo.
- `apps/movete-cliente/app/comercios.tsx`: integrado el fence en (1) lectura de catálogo/verificación de stock, (2) navegación paginada del catálogo, (3) directorio municipal de sucursales. Se bloquea lectura simultánea aun antes de que React pinte loading. Se exige cierre/dispose al desmontar. Al cambiar categoría se remonta cada subpantalla para descartar estado local/categoría anterior. Inputs y navegación se desactivan durante lectura; al cambiar sucursal o municipio se invalida el feedback anterior.

## Contratos y límites
- Se reutilizan los flujos de red existentes y sus controles de servidor; el fence es **exclusivamente protección de presentación**, no sustituye JWT/RLS, cancelación HTTP, idempotencia, propiedad del pedido ni certificación de runtime.
- Ningún dato de catálogo, precio, stock o municipio sintético ha sido habilitado como real. Si `catalogReadReady`, `readReady` o `branchDirectory.readReady` son falsos, NO se ejecuta consulta.
- Compra, checkout, PSP, pagos y pedidos siguen OFF. La farmacia permanece restringida a artículos OTC permitidos y la moto a carga.
- Los límites de 50/100 ítems son por página; jamás tope global de personas, comercios, catálogo o servicios.
- Los fallos de callbacks del frontend no difunden el contenido de errores a mensajes de usuario. No se agregaron secretos ni llamadas LIVE.

## Certificación y pendientes
Comprobar workflows de **HEAD final**: ownership B, Cliente/Driver aislamiento con TypeScript, pruebas Node/Expo export web y Admin QA. No confundir la prueba JavaScript con dispositivos físicos.

Pendiente A P0 en issue #9: certificar Auth Passenger/Admin, DTO/paginación y HTTPS STAGING efectivo, stock/precio server-authoritative, confirmación atómica de pedidos, coordinación comercial y entrega, seguridad/operadores; no activar LIVE.

## Continuidad R47
Priorizar guardas de edición del carrito, accesibilidad de mensajes y búsqueda verificada en Cliente (VoiceOver/TalkBack pendientes), o integración contractual B solo cuando A entregue evidencia STAGING. Seguir en archivos B exclusivos sin bloquearse por APIs ajenas. No merge, no LIVE, no deploy, no PSP ni documentos reales sin orden expresa del Owner.
