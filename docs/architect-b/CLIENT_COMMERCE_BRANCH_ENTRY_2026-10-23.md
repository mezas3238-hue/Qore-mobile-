# B — Consulta de sucursal y catálogo en Cliente (2026-10-23)

Se cerró el hueco de experiencia que impedía solicitar el catálogo desde la pantalla de Comercios, incluso al existir un lector certificado. La vista muestra un selector técnico de UUID de sucursal **solo bajo commerce.catalogReadReady**, lo normaliza estrictamente (sin nombres, teléfonos, direcciones ni URLs), y llama `client.loadCommerceCatalog`; muestra errores seguros, estado de carga y renovación de precios/stock. Se limpia el formulario al cambiar `privateViewRevision` (logout / rotación JWT).

La lista navegable pública de sucursales todavía NO existe en backend y deberá sustituir este selector temporal cuando A publique descubrimiento por cobertura/zona. No se inventan sucursales ni productos. Checkout, PSP, reserva de stock y pedidos siguen bloqueados; subtotal es solo estimado y depende de catálogo vigente del servidor.

QA suma pruebas de validación de entradas. No se activaron flags de red ni rutas LIVE. PR #8 DRAFT, sin merge, deploy ni datos reales.
