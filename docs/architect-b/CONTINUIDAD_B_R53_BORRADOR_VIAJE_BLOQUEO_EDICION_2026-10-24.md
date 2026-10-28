# QORE Mobile / Movete Fácil — Arquitecto B · R53 viaje local fail-closed
**Fecha:** 24-oct-2026 · Repositorio `mezas3238-hue/Qore-mobile-` · Rama `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT (no merge).

## Problema corregido
En `apps/movete-cliente/app/viaje.tsx`, las paradas y direcciones ya impedían edición con `mutation.phase!=='idle'`, pero el selector de automóvil verificaba solo `myDraft` (un borrador propio en ready). Era posible modificar en pantalla `económico/confort/XL` mientras otra operación (delivery/payment/fare), un in-flight, un resultado ack o una solicitud sin conciliar seguían pendientes. Esto generaba ambigüedad sobre qué preferencias pertenecían a cada petición, aunque el backend no hubiera despachado nada.

## Entrega R53 en archivos B
1. `apps/movete-cliente/src/domain/ride-draft-ui-policy.mjs`: `projectRideDraftUi` proyecta la operación pública y permite edición **únicamente** en estado `idle` y `operation:null`. Mantiene `ready` propio de rideRequest en modo solo lectura, con descarte permitido pero nunca envío desde este UI. Estados ajenos, in-flight, retryable, acknowledged, failed o desconocidos bloquean ruta y tipo de auto. `canPrepare` necesita actor autenticado, validación del formulario y **cero paradas** (backend aún no certifica rutas con paradas). No produce citas, cobros, GPS, tarifas o asignaciones.
2. `ride-draft-ui-policy.d.mts`: contrato TypeScript de proyección, acepta strings públicos del estado de mutación y valida por runtime.
3. `ride-draft-ui-policy.test.mjs`: **12 pruebas unitarias**: estado seguro, auth, ruta multiparada no compatible, borrador own/other, in-flight y fallos, fases ilegales, 8 paradas locales, servicios inválidos/moto pasajero, privacidad sin claves o dirección en anuncios, tipos inválidos, y sin simulación de asignación/tarifa.
4. `apps/movete-cliente/app/viaje.tsx`: selector y callbacks bloquean cambios cuando `free!==true` o hay lock; preparación exige `ui.canPrepare`, unificando ruta con selección de servicio. Región polite de estado y pistas para lectores de pantalla distinguen borrador local de contratación; se evitan avisos assertive para mensajes ordinarios.

## Control y límites
No se cambió Auth, backend A, apps Driver, PostgreSQL, PSP, cancelaciones o tarifas. Los vehículos MOTO siguen prohibidos para pasajeros. Contrato actual solo autoriza preparar (en RAM) un viaje AUTO simple, no pedidos LIVE. Los controles de UI no sustituyen autorización del servidor ni disponibilidad de zonas y conductores. Pruebas Node/Expo export web son QA, no APK/IPA ni TalkBack/VoiceOver físicos.

## Evidencia CI / Continuidad
Comprobar **mismo SHA final** en B ownership, Admin web QA y two-app isolation (Cliente+Driver TypeScript/tests/export web). No marcar R53 certificado hasta ver SUCCESS 3/3 de ese SHA.

Siguiente **R54**: reforzar cancelación en `seguimiento.tsx` frente a cambio de cuenta/viaje/estado entre render y acción, sin interrumpir la continuidad del Arquitecto A; estrictamente archivos propiedad B. Mantener PR #8 OPEN DRAFT, NO MERGE, NO LIVE, NO DEPLOY, NO PSP, sin datos reales.
