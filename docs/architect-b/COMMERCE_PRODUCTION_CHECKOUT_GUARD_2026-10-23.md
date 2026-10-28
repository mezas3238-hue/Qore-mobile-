# Movete Fácil — B27 guardas productivas de checkout de Comercio

**Fecha:** 23 de octubre de 2026  
**Ámbito:** Arquitecto B; aplicación Cliente y contrato de integración con A.  
**Estado:** dominio Cliente implementado y CI verde; operación remota bloqueada por contrato backend incompleto.

## Decisión

B-04 no se implementa como checkout DEMO. El objetivo es un checkout apto para integración real que falle cerrado cuando no pueda demostrar precio, stock, identidad de sucursal y versión del catálogo.

Los datos sintéticos aparecen únicamente en pruebas unitarias. No existe catálogo ficticio en la pantalla ni un fallback que genere una compra aparente.

## Implementación Cliente

`commerce-draft.mjs` ahora exige un snapshot normalizado que provenga de un adaptador autenticado del servidor:

- `branchId`, `itemId`, versión opaca y vencimiento;
- `itemTag`, `itemClass`, `unitPricePyg`, `stockUnits` y `active`;
- máximo 100 artículos en el snapshot y 50 líneas por carrito;
- cantidad positiva dentro del stock observado y del límite del request actual;
- solo `GENERAL` y `PHARMACY_OTC`; no se acepta una categoría de receta.

El carrito conserva la versión del catálogo y calcula un `estimatedSubtotalPyg` únicamente a partir del precio recibido. Nunca calcula `finalTotalPyg`, tarifas, impuestos ni costos de entrega.

Antes de preparar el request:

1. el catálogo debe seguir vigente;
2. la sucursal debe coincidir;
3. todos los artículos deben seguir activos;
4. el stock debe seguir cubriendo la cantidad;
5. cualquier cambio de precio o stock invalida las líneas elegidas;
6. la misma versión con contenido distinto se considera conflicto.

Cambiar de sucursal o limpiar la sesión elimina catálogo, líneas y subtotal. No se persisten precios ni pedidos.

## Contrato actual preservado

El body preparado conserva exactamente `MerchantOrderRequest` del OpenAPI observado:

- `requestKey`
- `branchId`
- `vehicleKind`
- `items[]` con `itemId` y `quantity`

El dominio mantiene `catalogVersion` como precondición separada, pero no la inventa dentro del JSON. Por eso `submissionAllowed=false` y el motivo es `ATOMIC_ORDER_CONTRACT_PENDING`.

## Bloqueo real de A

El OpenAPI actual no permite certificar una compra real de extremo a extremo:

- no publica una lectura Buyer de sucursales y catálogo;
- `CatalogItem` describe el upsert Merchant, pero no una respuesta Buyer versionada;
- `MerchantOrderRequest` no expresa versión esperada, ETag u otra precondición;
- el `201` referencia un `Success` genérico, sin receipt tipado de propietario, pedido, revisión ni importes finales;
- no está documentada la transacción que revalida stock/precio y reserva inventario de forma atómica.

A debe resolver esas semánticas en su contrato y backend. B conectará el adaptador real cuando exista; no propone una ruta falsa.

## Pruebas

Se cubren once escenarios de Comercio:

1. validación estricta del snapshot;
2. artículos/cantidades ligados al catálogo;
3. límites de cantidad y máximo de líneas;
4. subtotal derivado y total final ausente;
5. cambio de sucursal;
6. contenido distinto bajo la misma versión;
7. cambio de precio;
8. cambio de stock o baja del artículo;
9. revisión nueva que no afecta líneas elegidas;
10. expiración del catálogo;
11. limpieza completa de sesión.

Resultado local del bloque: **211/211 tests Cliente PASS**, TypeScript SUCCESS y exportación web SUCCESS.

**Cierre GitHub:** commit `f969a526d0bd501c4ae13ece6ec92974c22450a2`; ownership boundary #39965493620 SUCCESS, Admin web #39965493637 SUCCESS y two-app isolation #39965493603 SUCCESS.

## Garantía y límite

Este bloque prepara la lógica Cliente para datos reales; no certifica que el backend esté disponible ni habilita operación comercial. `CI GREEN` no sustituye Auth, contratos, STAGING integrado, pruebas nativas, rollout ni autorización de producción.
