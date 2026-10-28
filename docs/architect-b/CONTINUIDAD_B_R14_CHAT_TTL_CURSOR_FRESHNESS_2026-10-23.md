# QORE Mobile · Arquitecto B · R14 — Chat privado: TTL, cursores y frescura

**Fecha:** 23-oct-2026, Paraguay. **PR #8 DRAFT**, rama `feature/mobility-cliente-admin-parallel-20261022`. Continuidad directa del [Handoff Maestro R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md). Sin merge, despliegue, pagos, cuentas reales ni documentos privados.

## Base verificable

- Handoff maestro: `f95852564f06191e6083263d1fb276056513c302` y sus workflows `40043175200`, `40043175217`, `40043175273`: **3/3 SUCCESS**.
- Propiedad exclusiva B: `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`; backend, Driver, PostgreSQL, JWT, OpenAPI y CI raíz son exclusivos de A.
- Base funcional Cliente Expo + Admin Web; ningún endpoint real de chat certificado al inicio de R14. Los tests ejecutan gateways sintéticos; producción **NO operativa**.

## Implementación R14

1. [`20e32343`](https://github.com/mezas3238-hue/Qore-mobile-/commit/20e32343d7ac04f0d480b1ac90bc93793338149c) — `passenger-chat-flow.mjs`:
   - Rechazar `messages=[]` con `nextCursor` no nulo (cursor sin progreso / ciclo).
   - Rechazar páginas cuya marca `generatedAt` sea futura o supere 5 minutos de antigüedad, o cuyo `expiresAt` no sea posterior a la generación.
   - Purga física del cache de texto de chat al vencer el TTL **cuando no existe envío incierto**. Cuando hay ACK ambiguo, se conserva el contexto mínimo/idempotencia, sin exponer mensajes vencidos, y `retryPending()` exige revalidación del hilo.
2. [`91565e6c`](https://github.com/mezas3238-hue/Qore-mobile-/commit/91565e6c2b0e6af6e7179a1552242db1f65f6f03) — `passenger-chat-flow.test.mjs`:
   - 4 nuevas pruebas unitarias: rechazo de cursor sin progreso, página final vacía legítima, marcas temporales inválidas/obsoletas y expiración local con limpieza privada.
   - Ninguna llamada al gateway habilita producción; se mantiene `enabled / contractCertified / stagingRuntimeVerified` fail-closed.

## Verificación

- Consultar [CI HEAD del PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8/checks) y confirmar expresamente **3/3 finalizados SUCCESS**; no inferir el estado por workflows anteriores.
- El corte `91565e6c` lanzó workflows `40044177050` (ownership), `40044177080` (Admin) y `40044177052` (Cliente/Driver + aislamiento). Verificar resultado final; no se contabilizan pruebas nuevas como PASS antes de ver el job.
- No atribuir validación Android/iOS, JWT real, RLS o mensajes de dos móviles a una suite Node + web export.

## Próxima secuencia B independiente

1. **R15**: prueba negativa de bandeja→chat para conversación reasignada, JWT rotado y cache expirado; asegurar que no se conserva editor, no se abre hilo distinto y no se genera nueva key ante ACK incierto.
2. Extender pruebas adversariales del gateway cuando A publique DTO/campos reales: cursor opaco firmado, revisión monotónica y permisos por servicio.
3. UX accesible de reconexión (TalkBack/VoiceOver, red 2G y acceso al mismo hilo), aún pendiente dispositivo real.
4. Integración exacta Cliente↔Driver por HTTPS STAGING con JWT/RLS, almacenamiento durable PostgreSQL, Inbox Driver y notificaciones genéricas solo después de publicación/certificación explícita de A. Continuar con otro módulo B si A demora.

**Coordinación:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) y PR #7 de A. No editar sus rutas.

**Regla de continuidad Owner:** tomar HEAD actual de GitHub, continuar con pruebas y commits B sin detenerse salvo bloqueo real; siempre DRAFT / no merge / no LIVE.
