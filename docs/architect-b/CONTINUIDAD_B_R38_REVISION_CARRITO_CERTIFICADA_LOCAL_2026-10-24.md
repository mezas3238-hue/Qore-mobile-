# Movete Fácil — Arquitecto B R38: revisión segura de carrito comercial

Fecha: 2026-10-24. Propiedad B. Rama `feature/mobility-cliente-admin-parallel-20261022`, PR #8 DRAFT. **NO MERGE / NO LIVE / NO DEPLOY / NO pagos**.

## Contexto

El Owner solicitó continuar la construcción tras R37, donde se creó experiencia original multirrubro inspirada en funciones de plataformas de comercio: supermercados, farmacias OTC, restaurantes, retail y otros. El backend A permanece propietario de pricing, inventario, reserva atómica, procesamiento de pagos y reparto. R38 se limita a la **revisión informativa de un carrito privado previamente certificado**, sin inventar compras.

## Código y pruebas desarrollados

- `apps/movete-cliente/src/domain/commerce-checkout-review.mjs`: proyección sin red de carrito **únicamente si** la sesión está autenticada, el runtime de catálogo declara lectura certificada, el catálogo está fresco y en estado `SERVER_CATALOG`, la identidad de sucursal UUID y versión tienen formato válido, y siguen deshabilitados checkout/pagos.
- Validación de cada línea: identidad y etiqueta igual al catálogo, artículo activo, clase permitida (GENERAL o PHARMACY_OTC), cantidad íntegra positiva, stock suficiente, precio de catálogo íntegro, subtotal aritmético exacto, rechazo de duplicados/inyectados/campos privados y límites de snapshot. Si algo cambia, falla **sin exponer importes ni artículos anteriores**.
- Salida inmutable: líneas, `estimatedSubtotalPyg`, `deliveryFeePyg:null`, `discountPyg:null`, `finalTotalPyg:null`, `checkoutEnabled:false`, `paymentEnabled:false`, `orderConfirmed:false`, `stockReserved:false`, `deliveryAvailable:false`. Nunca `requestKey`, URL de PSP, orden ficticia ni POST.
- `commerce-checkout-review.d.mts`: contrato TypeScript del resumen y de su fallo cerrado.
- `commerce-checkout-review.test.mjs`: pruebas adversariales de Auth, expiración, transacción inexistente, precio tampered, stock agotado, catálogo revocado, etiquetas/IDs inválidos, importe manipulado, duplicados, datos privados, farmacia OTC, múltiple línea, cantidad y límite **por carrito** (sin tope global de registros).
- `app/comercios.tsx`: muestra "Revisión de tu carrito" con líneas y subtotal solo si el resumen validó con el snapshot actual; distingue explícitamente **costo de entrega pendiente**, **descuentos no confirmados** y **total final pendiente**. Añade comprobación de expiración en render, incluso antes del refresco periódico. El botón "Finalizar compra" sigue deshabilitado.

## Requisitos previos a operaciones reales — Arquitecto A

1. Auth JWT Passenger verificable en servidor, role isolation, revocación y control de sesión por comercio.
2. GET de sucursales/catálogo **montado**, firmado/autorizado, paginado por cursor, con precios PYG, stock, disponibilidad y expiración. Filtrar por municipio/rubro **antes de paginar**, no solo visualmente en B.
3. Contrato de **revisión de compra transaccional** en servidor que devuelva costos de artículos + envío + promociones + impuestos/comisiones + TOTAL con TTL, versión y disponibilidad real de Driver; evitar inferir costo de entrega desde distancia o datos de la app.
4. Reserva de inventario/pedido atómica/idempotente con `requestKey`, respuesta de commit recuperable ante timeout, manejo de sustituciones/cancelaciones y reconciliación.
5. PSP autorizado y conciliación contable, antifraude y facturas conforme a regulación local; gestión segura de devoluciones.
6. Farmacias: permisos de establecimiento y productos OTC exclusivamente hasta definición normativa formal para otros tipos.
7. E2E STAGING con datos sintéticos, pruebas dos cuentas, carreras contra stock y precio, suites CI mismo SHA, dispositivo Android/iOS real, y despliegue solo con orden expresa.

## Riesgos remanentes

- La revisión NO certifica compra ni inventario reservado; `catalogExpiresAt` es una expiración de lectura, no una garantía de precio final.
- El límite de 50 líneas es **por pedido/carrito contractual**, no un máximo de usuarios, productos ni registros de plataforma. No introducir límites globales de 50.
- En ausencia de Auth/catálogo, la pantalla permanece con mensajes de integración pendiente. No mostrar productos ni montos de demo como reales.
- Un resultado de tests verde NO equivale a integración PSP, entrega ni API HTTP montada.

## Continuidad sin detenerse

R39 sugerido: flujo accesible de revisión de sustituciones y preferencias de contacto/reparto en RAM, sin datos sensibles ni generar orden; preferir revisar primeramente si el contrato A ya cambió y no duplicar código. Seguir ampliando Cliente y Admin en rutas propiedad B. Documentar bloqueos en issue #9. Nunca invadir Driver/backend ni activar LIVE.

**Verificación:** ejecutar los tres workflows del SHA FINAL en PR #8 (ownership, Admin, two-app isolation con tests/typecheck/export Cliente y Driver). No afirmar SUCCESS hasta comprobar los resultados.
