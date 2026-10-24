# Arquitecto B — carrito privado de catálogo para comercios, 23/oct/2026

Se incorporó el catálogo/carrito existente al runtime Cliente. El lector abstracto certificado sigue apagado porque OpenAPI A v1.0.0-g41 no publica GET buyer catálogo: solo POST de alta/actualización del comercio. No se inventaron rutas, productos ni cobros. Sesiones con rotación JWT o logout limpian productos, cantidades, sucursales y precios. El presupuesto del carrito es local (50 líneas) y NO es límite global de usuarios, artículos del servidor, registros ni comercios.

La API del runtime expone: loadCommerceCatalog, setCommerceQuantity, selectCommerceVehicle, previewCommerceOrder (siempre submissionAllowed=false), clearCommerce. El snapshot incluye artículos del catálogo únicamente mientras TTL sea válido, y distingue subtotal informativo en PYG de precio final/cobro real. Sin URL de backend, pago PSP, reserva de stock ni despacho.

Tests QA sintéticos verifican negocio en modo OFF, sesión, cifras y veto de checkout. Próximo: publicar OpenAPI Buyer GET catálogo paginado y endpoints de recibo de pedido, con idempotencia y RLS; conectar pantalla Cliente bajo gate certificado. PR #8 DRAFT. NO MERGE/LIVE/DEPLOY.
