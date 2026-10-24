# QORE Mobile / Movete Fácil — Arquitecto B R52
**Fecha:** 24 octubre 2026 · **PR:** #8 DRAFT · **Rama:** `feature/mobility-cliente-admin-parallel-20261022`.

## Hallazgo
El formulario `apps/movete-cliente/app/envios.tsx` evitaba editar mientras un borrador de envío propio estaba en `ready`, pero en los otros estados públicos de `mutation` (operación distinta preparada, in-flight, retryable, acknowledged, failed) algunos campos de origen, destino, peso/dimensiones, categoría, carga y vehículo todavía podían cambiar en pantalla. No generaba un despacho automáticamente, pero podía confundir qué valores correspondían al borrador actual o incierto.

## Implementación real R52
- `src/domain/delivery-draft-ui-policy.mjs`: proyección fail-closed de fase pública de mutación: **edición únicamente con `idle` y `operation:null`**; prepara solo con sesión autenticada, formulario validado y sin artículos restringidos; descarte solo para borrador de envío `ready`, nunca para mutaciones de viaje/pago. Mensajes de estado seguros sin direcciones, identificadores privados, precio, GPS o request keys. `requestSent:false`, `courierAssigned:false`, `paymentCaptured:false`.
- `src/domain/delivery-draft-ui-policy.d.mts`: tipado del resultado; acepta strings públicos `mutation.phase` y `operation` de ClientSnapshot, **valida en runtime**, nunca interpreta fase desconocida como libre.
- `src/domain/delivery-draft-ui-policy.test.mjs`: **10 pruebas** de idle válido, no autenticado, no validado, mercancías restringidas, mutación propia/ajena, pending/retry/failed, privacidad, entradas malformadas y ausencia de pagos/confirmación.
- `app/envios.tsx`: `TextInput editable={free}`, categorías, vehículo y declaración de restricción `disabled={!free}`, callbacks de edición también bloqueados sin estado `idle` o con lock; preparación exige `ui.canPrepare`. Se añade encabezado con estado local y `accessibilityLiveRegion=polite`, pistas de accesibilidad para revisar/preparar y aviso al declarar restricción. Mensajes ordinarios pasan de anuncio urgente (alert assertive) a polite.

## Contratos y seguridad
Solo afecta experiencia Cliente y no permite enviar, cotizar ni confirmar envíos reales. No se cambió A/Driver/backend/PSP; aplicaciones independientes. `DELIVERY_CATEGORIES`, reglas OTC y moto solo carga siguen intactas; Auth real, cobertura, elegibilidad, impuestos, comisiones, tarifas en Gs, despacho y persistencia requieren backend y pruebas de integración autorizadas. Sin PII de usuarios reales ni integración LIVE.

## QA
La certificación de R52 se declara únicamente cuando pasan en **el mismo SHA final** los workflows B ownership, Admin web QA y aislamiento Cliente/Driver con TypeScript/tests/export QA. Pruebas Node y export web no reemplazan ensayo TalkBack/VoiceOver y builds móviles firmados.

## Continuidad R53
Prioridad independiente B: endurecer accesibilidad de viaje/seguimiento y no exponer rutas anteriores ante cambios de actor o fase, evitando tocar A. El Owner exige progreso continuo salvo bloqueo real. PR #8 DRAFT; NO MERGE, NO LIVE, NO DEPLOY, NO PSP, NO VPS.
