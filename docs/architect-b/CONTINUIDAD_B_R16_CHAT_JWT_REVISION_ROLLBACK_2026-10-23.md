# QORE Mobile / Movete Fácil — Arquitecto B R16: autorización de chat y revisiones monotónicas

**Fecha:** 23-oct-2026, Paraguay. Rama B `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT, sin merge ni despliegue. Continuidad desde [R15](./CONTINUIDAD_B_R15_CHAT_REASIGNACION_JWT_ACK_2026-10-23.md) y [R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md).

## Cambios de código auditables

1. [`ced69f10`](https://github.com/mezas3238-hue/Qore-mobile-/commit/ced69f10068516ad26e2257fa4c5a2ae1093c283) — `apps/movete-cliente/src/domain/passenger-chat-flow.mjs`.
   - Se agrega `sessionRevision` privado al estado de conversación autorizado por lectura de servidor. No se envía a UI.
   - Los cursores `older:true`, POST de mensajes y reintentos ya no heredan autorización cuando cambió el privacy epoch/JWT. Se borran mensajes y claves locales con `STALE_SESSION_RESPONSE` antes de una escritura HTTP.
   - Refresh del **mismo conversationId + actor + revisión de sesión** rechaza `revision` del DTO menor que la versión autorizada; las reasignaciones con **conversationId diferente** pueden empezar con revisión nueva y caché vacía.
   - Un mensaje incierto cuyo permiso TTL expiró obliga a GET fresco del mismo hilo; ahora rechaza revision rollback aunque el DTO tenga `assignmentVerified:true`. Un ACK retrasado no confirma entrega sin validación del permiso.
2. [`8269071d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8269071d78e90b636079ae33b0bb1cf61f87cf6f) — siete pruebas adversariales nuevas en `passenger-chat-flow.test.mjs`: rollback en refresh, avance monotónico, nuevo hilo tras reasignación, cursor y JWT rotados, escritura prohibida tras rotación, retry de clave ambigua con nueva sesión y rechazo de rollback después de TTL.

## Estado de QA

- **R15 previo:** [CI Cliente/aislamiento](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044362263), [Admin](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044362226), [propiedad](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044362348): 3/3 SUCCESS, Cliente 466/466 PASS y Admin 185/185 PASS (651 total).
- **R16 SHA 8269071d**: [Cliente/Driver e aislamiento #40044931272](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931272), [Admin #40044931241](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931241), [ownership #40044931203](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931203). **Leer el resultado final del workflow y sus logs antes de declarar 473/473 o 658/658 PASS**. Los workflows empezaron en progreso; no extrapolar.
- Son pruebas en memoria y exports Expo web/TypeScript: **no equivalen** a JWT real, PostgreSQL mensajes, entrega entre teléfonos, Android/iOS nativo, pagos ni LIVE.

## Dependencia A y siguientes trabajos B

- Backend/Driver A es propietario exclusivo de Auth JWT/RLS, PostgreSQL mensajes, permisos server-side, contratos OpenAPI, inbox Driver, antifraude y push; [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6377421425). La última consulta de G48 mostraba 57 rutas OpenAPI y ninguna `chat/message/conversation`, de modo que los flags de red permanecen apagados.
- Completar R16 CI. Ante fallos, corregir solo áreas B: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.
- Continuar pruebas negativas contra paginación/DTO, accesibilidad real y UX de sesión y offline; no bloquear toda la construcción porque todavía falte el chat de A.
- Cuando A entregue STAGING con credenciales sintéticas aprobadas y permisos verificados, conectar GET/POST del chat real y probar reassign, autorización por cada operación y ACK idempotente sin mezclar apps Cliente y Driver.

**Mandato Owner:** desarrollo continuo sin pausas salvo bloqueo técnico real; PR DRAFT, NO MERGE, NO LIVE, NO VPS, NO pagos reales, NO credenciales/secrets o documentos reales, NO editar rutas de A, sin confundir un UI/test exitoso con producto comercial certificado.
