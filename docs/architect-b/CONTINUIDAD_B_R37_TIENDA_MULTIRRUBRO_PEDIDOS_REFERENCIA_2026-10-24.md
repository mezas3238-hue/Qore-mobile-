# QORE Mobile — Arquitecto B, R37 | Tiendas y entregas multirrubro

**Fecha:** 2026-10-24. **Rama:** `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT.

## Objetivo funcional
Tomar como referencia la experiencia de compras de plataformas multirrubro (supermercado, farmacia, restaurantes, tiendas), conservando **interfaz propia Movete Fácil** y el núcleo transaccional A separado. No copiar código, marca, activos, ilustraciones, layouts exactos ni condiciones comerciales de terceros.

## Benchmark
La app PedidosYa exhibe (según sus páginas oficiales y ejemplos públicos) búsqueda de productos y comercios, categorías, carrito, promociones, pedidos anteriores, entregas programadas, método de pago y seguimiento. Son **funciones generales**, no permisos ni prueba de que Movete Fácil las haya integrado.

## Lo implementado en Cliente (R37)
- `src/domain/commerce-storefront.mjs` + `.d.mts`: 5 rubros `SUPERMARKET/PHARMACY/RESTAURANT/RETAIL/OTHER`, consulta/normalización de búsqueda con rechazo de controles y bidi, filtrado de productos activos **exclusivamente en páginas previamente verificadas**, filtro de sucursales por tipo en la página recibida. Resultados congelados, sin inferir totales globales, promociones ni pedidos.
- `src/domain/commerce-storefront.test.mjs`: pruebas negativas y positivas de categorías, ausencia de autorización, coincidencia accent-insensitive, PII de control, stock 0, producto inactivo, métricas de página y alteración de datos/privilegios.
- `app/comercios.tsx`: encabezado Tiendas y entregas; navegación por cinco rubros en cuadrícula, buscador de productos de catálogo de sucursal, resultados verificados filtrados por texto y tipo, aclaración de paginación incompleta y carrito sin cobro. El estado de búsqueda, rubro y sucursal se purga inmediatamente por remount de React al variar `privateViewRevision`, incluso durante rotación JWT.

## Lo que deliberadamente NO se activó
- Nunca generar productos/promociones/tiempos ficticios. Solo datos tipados y frescos de los adaptadores B existentes. El filtro local no demuestra que no haya comercios/productos en otras páginas o zonas.
- En `apps/movete-cliente` no se creó pago, PSP, stock atómico, programación, repetición de pedidos ni asignación automática. `Finalizar compra` sigue deshabilitado.
- Farmacia: solo artículos sin receta permitidos por normativa/contrato y KYC del comercio; fármacos sujetos a receta o control no habilitados.
- El límite de 100 por página de G44 no limita los registros globales; no volver a introducir el erróneo tope de 50 registros.

## Dependencias propietario A
Al HEAD A g56 leído el 24/10, OpenAPI `1.0.0-g56`, 68 rutas; `GET /v1/staging/buyer/branches`, `GET /v1/staging/buyer/branches/{branchId}/catalog`, `GET .../catalog-g48` y `POST .../reservations-g45` continúan con `x-qore-runtime-wired:false`, QA-only. El catálogo y el checkout comerciales reales necesitan Auth/JWT Passenger, lista de sucursales autorizadas por rubro/área/horario, categorías de producto paginadas, stock en tiempo real con versionado/TTL, reservas atomizadas, sustituciones, precio/entrega final, PSP y conciliación, dispatch con recibo persistido, cancelación/reembolso y tracking con Driver. Enviar solicitudes de contrato al issue #9.

## QA requerida y siguiente trabajo
Verificar 3 workflows del MISMO SHA: ownership B, Admin web y two-app isolation (incluye Cliente tests/typecheck/Expo web y Driver). Export WEB no certifica dispositivos nativos. En R38 continuar mejora de producto por categoría: búsqueda paginada de sucursales, filtros claros y experiencia de carrito/revisión de checkout sólo contra contrato de A; si backend no montado, avanzar UI y validadores fail-closed.
**NO MERGE. NO LIVE. NO DEPLOY. NO PSP.**