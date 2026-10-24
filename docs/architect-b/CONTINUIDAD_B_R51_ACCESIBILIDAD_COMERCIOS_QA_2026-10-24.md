# QORE Mobile / Movete Fácil — Arquitecto B R51
**Fecha:** 24 octubre 2026 · **Rama B:** `feature/mobility-cliente-admin-parallel-20261022` · **PR:** #8 DRAFT · Sin merge, sin despliegue.

## Hallazgo
Los controles de comercio son accesibles como botones, pero TalkBack/VoiceOver carecían de descripciones completas de cantidad local, stock y precio en Gs por unidad, y la navegación de resultados no anunciaba de forma diferenciada los filtros por página. Esto podía favorecer la confusión entre una selección de prueba y disponibilidad comercial real.

## Implementación R51 — código real B
- `apps/movete-cliente/src/domain/commerce-accessible-summary.mjs`: proyector puro `projectCommerceItemAccessible` solo para artículo verificado y estrictamente tipado: produce descripción sin PII, precio por unidad en guaraníes, unidades en carrito, stock informado, leyenda **sin reserva/compra** y consejos accesibles para agregar/quitar. Rechaza filas extras, tags arbitrarios, precios, cantidades y stocks manipulados.
- `commerce-accessible-summary.d.mts`: contrato público de datos de accesibilidad.
- `commerce-accessible-summary.test.mjs`: **12 pruebas unitarias**: estado local seguro, rechazo de catálogo sin verificar, PII, caracteres de control, stock cero, cantidad fraudulenta, OTC/activo, búsqueda sin totales globales, página vacía, carga/expiración y límite **por página**.
- `apps/movete-cliente/app/comercios.tsx`: integra el proyector en el catálogo principal y paginado, aplica `accessibilityLabel` conciso a precio/stock, `accessibilityHint` en acciones de sumar y quitar, región polite para la cantidad local y mensajes resumidos `accessibilityLiveRegion=polite` con el número de coincidencias **únicamente en la página vigente** de catálogo y sucursales G44.

## Seguridad y no-objetivos
Los textos solo se crean después de validación `verified` y cuando el snapshot está vigente. Las páginas vencidas/no verificadas no entregan filas o precios al lector de pantalla. No se muestran números de teléfono, direcciones, identificadores UUID o nombres personales. No se infiere disponibilidad global ni se promete entrega, compra, pago o reserva. La farmacia continúa OTC; moto es solo carga. La interfaz sigue dependiendo de Backend A para Auth/stock/sucursales y transacciones de verdad, con gates OFF sin certificación.

## Certificación y dependencia
Exigir checks **del mismo commit SHA**: B ownership, Admin QA y aislamiento Cliente/Driver con TypeScript+tests+Expo export web. R50 tenía Cliente PASS pero CI combinado FAILURE por TS2322 ajeno a B en `apps/movete-driver/src/DriverMessagesProvider.tsx` (reportado en issue #9). No modificar Driver desde B ni afirmar 3/3 SUCCESS si persiste. QA de simulador web no reemplaza pruebas manuales en dispositivos TalkBack/VoiceOver ni build firmado.

## Continuidad R52
Extender accesibilidad a flujos de envíos/seguimiento y navegación de Cliente con validación por casos reales QA, y después integrar contratos HTTPS STAGING de A cuando se certifiquen. Trabajar estrictamente en `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. PR DRAFT, NO MERGE, NO LIVE, NO PSP, NO VPS, NO PII real.
