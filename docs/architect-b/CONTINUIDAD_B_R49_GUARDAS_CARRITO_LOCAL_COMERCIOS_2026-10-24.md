# QORE Mobile — Arquitecto B / R49: guardas de acción local de carrito comercial

**Fecha:** 24 octubre 2026 · **PR:** #8 DRAFT · **Rama:** `feature/mobility-cliente-admin-parallel-20261022` · Continuación de R48.

## Problema y solución de código
Aunque el catálogo estuviera validado cuando React renderizó la pantalla, un toque de "Agregar", "Quitar", "Cambiar reparto" o "Preferencia de sustitución" podía invocar una acción usando un estado visual capturado antes de un cambio de cuenta, JWT, sucursal, versión, stock o cantidad.

Implementado el validador `guardCommerceUiAction(displayed,current,options)`, en `apps/movete-cliente/src/domain/commerce-ui-action-guard.mjs`, y su contrato `.d.mts`:
- Compara identidad Passenger, `privateViewRevision` y validación del catálogo R47 por reloj actual (`now`).
- Exige `catalogReadReady`, sin lectura en curso ni error, `stage:SERVER_CATALOG`, flags checkout/pago OFF, sucursal igual, versión, TTL, vehículo y generación del borrador sin cambios.
- Para un ítem específico contrasta existencia, clase, etiqueta, precio, stock, actividad y cantidad visible frente al snapshot vivo; evita acciones de doble toque antes del re-render.
- Valida cantidad solicitada dentro del stock reportado, límites de carrito y pertenencia al carrito al cambiar preferencias de sustitución.
- Su resultado únicamente autoriza edición de un **borrador local**, no una orden, reserva, cobro o contacto.

La aplicación Cliente `app/comercios.tsx` ahora vuelve a leer `client.snapshot()` justo al tocar los botones y valida con el guard antes de ejecutar `setCommerceQuantity`, `selectCommerceVehicle` y `substitutionFlow.choose`. Si caducó el contexto, no toca el carrito y pide revalidar catálogo/precios. Se conserva el dominio original y sus defensas server-first.

## Evidencia QA
`apps/movete-cliente/src/domain/commerce-ui-action-guard.test.mjs` añade 10 pruebas adversariales sobre revocación de cuenta/JWT, vencimiento, revisión, vehículo, cambio de stock/precio, doble toque, decisiones fuera del carrito, cantidades inválidas y entradas malformadas.

Los checks requeridos para el **SHA documental final** son ownership B, Admin QA (pruebas/TS/Vite) y aislamiento Cliente/Driver (TypeScript, pruebas Node, Expo export web). Sin resultado final SUCCESS para los tres, no afirmar certificación.

## Lo que NO se habilitó
Sin cambios a Driver/backend A, PostgreSQL, pagos, PSP, despacho, stock transaccional, checkout real, endpoint HTTPS ni datos PII. El guard es cliente local, no reemplaza validación de servidor, doble actor, titularidad o autorización JWT.

## Continuidad R50
Prioridad B: consistencia visual y accesibilidad de navegación de comercios, pruebas adversariales de cambio de sesión/reanudación, integración Buyer solo después del contrato HTTPS STAGING real validado por A (issue #9). Se mantiene PR #8 DRAFT, sin merge, LIVE, deploy ni datos reales.
