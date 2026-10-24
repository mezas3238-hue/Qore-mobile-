# QORE Mobile — Arquitecto B · R24 retorno seguro a mensaje pendiente

**23-oct-2026 Paraguay.** Continuidad desde [R23](./CONTINUIDAD_B_R23_BORRADOR_PRIVADO_REASIGNACION_2026-10-23.md). Rama `feature/mobility-cliente-admin-parallel-20261022`; [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT. No merge, LIVE, VPS, pagos ni datos privados reales.

## Problema identificado

El motor `passenger-chat-flow.mjs` hace lo correcto al bloquear el salto a una conversación diferente cuando existe `state.pending` con respuesta de POST ambigua, porque `requestKey` debe reconciliarse exactamente una vez para no duplicar mensajes. No obstante, una persona que navegaba a otro servicio podía ver el bloqueo de apertura sin acceso sencillo al chat original para repetir esa **misma** solicitud. El bloqueo era seguro pero dificultaba la recuperación.

## Cambio publicado

1. [`3548ccf1`](https://github.com/mezas3238-hue/Qore-mobile-/commit/3548ccf17438b14ff6d66eaea1cbf5463694a8fd) en `passenger-chat-navigation.mjs` añade `passengerPendingRecoveryRoute`. Devuelve exclusivamente `serviceId`, `serviceKind` y `conversationId` validados cuando `authenticated === true`, `contractReady === true`, `pendingSend === true`, todos los identificadores tienen UUID válido, el servicio está permitido y la pantalla actual **no** es ya la conversación pendiente. No se filtran cuerpos, teléfonos, JWT, claves idempotentes o información del Driver.
2. [`27e224c6`](https://github.com/mezas3238-hue/Qore-mobile-/commit/27e224c6ff5dcfc6282552923e1aaa58d375eb03) en `app/mensajes.tsx` muestra un aviso accesible y la acción «Revisar el mensaje pendiente» cuando el usuario está en otro servicio. Navega por Expo Router al servicio/hilo pendiente. El botón NO envía nada; `retryChat()` conserva las validaciones R14–R22 de identidad, autorización, TTL, conversación activa, servidor e idempotencia.
3. [`f682ddc2`](https://github.com/mezas3238-hue/Qore-mobile-/commit/f682ddc2b037f377a86aa2bfe712fbdba21efc0a) añade **3 pruebas** para retorno desde otro servicio, no producir enlaces de recuperación cuando ya se está en el hilo, y rechazo fail-closed de sesión revocada, contrato apagado y parámetros manipulados.

## Pruebas / evidencia
- Código R23 previo `f7b5102a`: [isolation/Cliente/Driver #40047684985](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047684985), [Admin #40047685064](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685064), [ownership #40047685069](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685069). La cola de GitHub debe terminar antes de asignar PASS; comprobar logs.
- Código R24 `f682ddc2`: [isolation #40047798940](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047798940), la CI Admin/ownership se consulta desde el commit. No inferir éxito hasta conclusión final y logs.
- Estas son pruebas de contratos/navegación puramente sintéticas más TypeScript/Expo web export cuando CI termina. No son E2E en Android/iOS ni mensajería HTTP real.

## Dependencias y continuidad
- Backend A, SQL/Node, Auth JWT/RLS, Driver, OpenAPI, workflows raíz y STAGING pertenecen al Arquitecto A. G50 documenta endpoints chat pero `x-qore-runtime-wired:false` y DTOs G50 no satisfacen todavía contrato de Cliente B; [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- Continuar al siguiente gate B: verificación final CI R23/R24, endurecimiento de navegación y sesiones offline, accesibilidad y pruebas nativas cuando existan. No tocar rutas A, no habilitar gates chat.
- Las suites de Cliente y Admin no evidencian producto comercial certificado. Se requiere integración real en STAGING con dos usuarios sintéticos, reasignación, cierre de servicio, reintento de timeout, revocación y pruebas de dispositivos.
