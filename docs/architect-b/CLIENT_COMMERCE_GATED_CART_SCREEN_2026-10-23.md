# Arquitecto B — Carrito de comercio en interfaz Cliente (23-10-2026)

UI condicional en `app/comercios.tsx` solo cuando `commerce.catalogReadReady=true` desde gateway certificado inyectado. Lista ítems activos con tag whitelisted, clase GENERAL/PHARMACY_OTC, precio PYG, stock informado, incremento/reducción de cantidades, elección MOTO/AUTO de carga, subtotal del snapshot (no total final) y limpieza manual. Nunca aparece con OpenAPI Buyer GET ausente ni se inventan comercios/productos.

Sin pago/checkout/despacho ni stock reservado. El botón final permanece desactivado. Ante catálogo vencido no muestra precios, según `commerce.stage`; logout/JWT destruye catálogo privado. Pruebas de domain/runtime en CI exacta pendiente. PR #8 DRAFT, NO MERGE/LIVE/DEPLOY.
