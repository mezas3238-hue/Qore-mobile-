# QORE Mobile — Arquitecto B R15 · Reasignación de hilo y JWT durante ACK

**Corte:** 23 de octubre de 2026 (Paraguay). **Rama** `feature/mobility-cliente-admin-parallel-20261022`, **PR #8 DRAFT**. Continuidad de [R14](./CONTINUIDAD_B_R14_CHAT_TTL_CURSOR_FRESHNESS_2026-10-23.md) y [handoff maestro R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md).

## Trabajo implementado

- [`d95b02a5`](https://github.com/mezas3238-hue/Qore-mobile-/commit/d95b02a5356ea13f1a0f1abf2e4eb113066de16b) — dos pruebas nuevas para `passenger-chat-flow.mjs` en `apps/movete-cliente/src/domain/passenger-chat-flow.test.mjs`.
- **Prueba de reasignación, mismo servicio RIDE:** tras un timeout/ACK ambiguo se bloquea abrir `conversationId` nuevo, se conserva el `requestKey` antiguo, se reconcilia únicamente ese intento y luego el servidor puede autorizar un nuevo hilo. El nuevo snapshot no puede contener las filas del conductor anterior.
- **Prueba de JWT rotado mientras ACK está en vuelo:** la respuesta firmada por la sesión anterior se rechaza con `STALE_SESSION_RESPONSE`, sin exponer mensajes, reactivar conversación ni informar éxito no verificado.
- No cambiaron archivos del Arquitecto A, Driver, SQL, CI raíz, OpenAPI, secretos ni backend. No se presupone endpoint real.

## Verificación y límites

- R14 código `91565e6c`: CI #40044177052 (Cliente/Driver + aislamiento), #40044177050 (propiedad), #40044177080 (Admin): **3/3 SUCCESS**; Cliente **464/464 PASS**, Admin **185/185 PASS**.
- R14 documentación `712bd3ee`: CI #40044241126, #40044241104, #40044241103 **3/3 SUCCESS**.
- **R15 `d95b02a5`**: verificar conclusión final CI `40044362263` Cliente/Driver+aislamiento, `40044362348` frontera de propiedad, `40044362226` Admin. No afirmar 466 PASS antes de leer el job.
- Pruebas sintéticas unitarias: **no** certifican API real, JWT emitido de verdad, PostgreSQL de mensajes, RLS, dos teléfonos, push nativo, E2E ni producción.

## Coordinación con Arquitecto A

- Consulta directa de OpenAPI rama A `feature/mobility-monorepo-isolated-20261016`: `1.0.0-g48`, **57 rutas y 0 chat/message/conversation**.
- Petición formal actualizada en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6377421425): Inbox, mensajes GET/POST, Driver receptor, almacenamiento idempotente, autorización JWT+RLS por servicio, revisión y cursor opaco firmado. Esperar contrato y runtime STAGING certificado antes de activar flags. Una ruta escrita en OpenAPI no basta.

## Próximo Arquitecto B (sin detenerse salvo bloqueo real)

1. Confirmar CI R15 y reparar cualquier fallo en rutas exclusivas B.
2. Mejorar UX de recuperación de chat tras fallos de red y estado `pendingSend`; permitir reintento de la misma clave **solamente** tras revalidar asignación.
3. Seguir con seguridad de paginación de Inbox y acceso desde historial/seguimiento: JWT rotado, TTL y cursor repetido.
4. Mantener dos apps móviles separadas: Cliente B, Driver A; Admin Web separado. Continuar pruebas negativas y accesibilidad en entornos sintéticos.
5. Cuando A publique contratos y STAGING seguro, integrar HTTP verificado en Cliente, probar bidireccionalidad real bajo 401/403/reasignación y documentar resultados exactos. No habilitar LIVE sin orden Owner.

**Sin merge, deploy, VPS, pagos reales, documentación personal ni datos de clientes reales.**
