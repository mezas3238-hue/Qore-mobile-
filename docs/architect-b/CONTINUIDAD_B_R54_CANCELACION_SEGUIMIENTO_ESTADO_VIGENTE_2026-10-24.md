# QORE Mobile — Arquitecto B · R54 verificación de cancelación en Seguimiento
**Fecha:** 24 octubre 2026 · Repo `mezas3238-hue/Qore-mobile-` · Rama `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT.

## Riesgo corregido
La pantalla `app/seguimiento.tsx` permitía pulsar preparar/enviar/reintentar una cancelación mediante controles derivados del snapshot visible. En el intervalo entre render y toque, el servidor podía asignar otro viaje, avanzar el estado a `in_progress` o registrar una nueva revisión; también la sesión Passenger podía cambiar, o la clave idempotente ya no corresponder a lo mostrado. La capa backend valida permisos y resultados, pero es incorrecto presentar un diálogo de confirmación viejo como vigente o activar una acción desde él.

## Entrega R54 — funcionalidad B
- `apps/movete-cliente/src/domain/tracking-cancellation-ui-guard.mjs`: validación fail-closed `guardTrackingCancellationUiAction(displayed,current,{action})`; requiere sesión Passenger UUID y revisión privada iguales; viaje autorizado actualmente suscrito, estado `searching/assigned/arriving`, sin sincronización pendiente, revisión >=1 e igualdad del tripId/estado/revisión; contrato de cancelación habilitado y fase adecuada. Para `submit`/`retry` exige misma clave idempotente UUID y mismo viaje en ambos snapshots. No crea identificadores, no envía HTTP, no modifica tracking y nunca confirma reembolso.
- `tracking-cancellation-ui-guard.d.mts`: contrato público typed de guard y su denegación.
- `tracking-cancellation-ui-guard.test.mjs`: **12 pruebas adversariales** de actor/JWT, cambio de viaje/revisión/estado, caducidad de asignación, transiciones de mutación, clave idempotente, estados inseguros/DTO inválidos, no filtración de identidad ni promesas de reembolso.
- `apps/movete-cliente/app/seguimiento.tsx`: `validateCancelAction` lee `client.snapshot()` justo al tocar **antes** de generar requestKey (preparación) y antes de enviar/reintentar. Invalida diálogo de confirmación al rotar JWT, cambiar viaje/revisión/estado o iniciarse una sincronización. Bloquea cancelación mientras sincroniza. Evita feedback tardío si la sesión, viaje o revisión cambió durante la llamada. Añade pistas TalkBack/VoiceOver acerca de confirmación e idempotencia.

## Restricciones conservadas
La cancelación requiere contrato y autorización real de backend A; el guard es defensa de interfaz, nunca autorización ni confirmación de reembolso, coste o estado final. El cliente usa la misma `requestKey` de la operación pendiente en retry. No se agregó ningún endpoint LIVE, ni pagos, GPS, VPS, datos PII reales, Driver o Admin. Todas las ramas PR permanecen DRAFT sin merge o deploy.

## Certificación y continuación R55
Validar el **SHA final de R54**: B ownership; Admin QA; two app isolation (Cliente y Driver: tests, TypeScript y Expo export web QA). No confundir web export con teléfono Android/iOS certificado. Pendiente certificar TalkBack/VoiceOver en dispositivos físicos y el contrato STAGING y rollback de cancelaciones cuando A entregue evidencia. Próxima R55: seguridad de feedback de seguimiento y cancelación ante respuestas asíncronas de sesión, más pruebas de regresión, siempre archivos de B.

## Incidencia QA R54 y corrección
El corte inicial `575a54cd2932fc6500088dc2af5c8d330fb3151b` produjo **FAIL** en CI Cliente #40100122572: 1 test R54 falló (721/722 tests Cliente aprobados). El error era **del propio test**, no del guard: el helper `same(x,y=x)` reemplazaba un argumento `undefined` explícito por la vista válida `x`. La aserción de rechazo de snapshot `undefined` no estaba ejecutando el caso que pretendía. Corregido en `fac8c98ac765f7c12523e5a1ef396f51efcc67b7` llamando directamente a `guardTrackingCancellationUiAction(x,undefined,...)` y viceversa; no se debilitó código de negocio. Se debe verificar la CI del SHA FINAL posterior a esta anotación antes de declarar certificación completa.
