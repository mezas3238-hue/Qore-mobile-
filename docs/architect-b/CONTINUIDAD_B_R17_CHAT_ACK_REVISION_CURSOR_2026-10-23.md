# QORE Mobile — Arquitecto B R17 · ACK durable y revisión del hilo

**Corte:** 23-oct-2026 (Paraguay). [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) permanece DRAFT, sin merge ni despliegue. Continuidad desde [R16](./CONTINUIDAD_B_R16_CHAT_JWT_REVISION_ROLLBACK_2026-10-23.md) y [R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md).

## Cambios exactos

- [`f8314c0b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/f8314c0b1be13674afd425cc0f499bd5024d5b88), `apps/movete-cliente/src/domain/passenger-chat-flow.mjs`: ante `serverStored:true` **validado**, elevar la revisión local del hilo al `revision` del ACK y descartar el cursor del snapshot anterior. Evita que un GET atrasado con la revisión pre-ACK remplace un mensaje durable. No se concede permiso de Driver ni se atribuye recibo leído; reabrir requiere nueva autorización backend. NO inferir delivery ni permitir red sin gates certificados.
- [`3fa29fa3`](https://github.com/mezas3238-hue/Qore-mobile-/commit/3fa29fa313c0027f87d25f4f15a06a1c6b6315e1), `apps/movete-cliente/src/domain/passenger-chat-flow.test.mjs`: dos pruebas nuevas. Una rechaza GET de la versión 7 tras ACK persistido con revisión 8; la otra comprueba que los cursores antiguos se inhabilitan hasta nueva lectura certificada.

## QA y advertencias

- Estado previo **R16 code `8269071d` confirmado 3/3 workflows SUCCESS**: [Cliente/Driver/aislamiento #40044931272](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931272) **473/473 PASS**, TypeScript, export web Cliente/Driver; [Admin #40044931241](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931241) **185/185 PASS**, TypeScript/Vite; [ownership #40044931203](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40044931203) SUCCESS. Total **658/658**.
- **R17**: verificar los tres workflows del SHA `3fa29fa3` y sus logs **antes de afirmar** 475 pruebas Cliente/660 totales, los resultados en curso no se presumen. También comprobar QA del commit de este documento.
- La suite es QA sintética y CI web, NO demuestra mensajes reales, JWT emitido, Android/iOS, servicios en la calle, PSP o despacho.
- Solo archivos B. Backend, Driver, PostgreSQL, OpenAPI, JWT/RLS y CI raíz pertenecen a A.

## Próximo trabajo sin bloqueo general

1. Confirmar CI R17, corregir cualquier fallo en exclusiva B y documentar prueba exacta.
2. Revisar bandeja, historial y acceso a conversación de servicio activo bajo cambio de JWT, TTL y reconexión; sin revelar texto o IDs privados de otro actor.
3. Integrar chat real con el Arquitecto A exclusivamente después de sus contratos, infraestructura STAGING, permisos y E2E sintéticas. La dependencia sigue en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
4. Construir las demás mejoras Cliente/Admin independientes; sin detenerse salvo bloqueo técnico real.

**No merge, no LIVE, no VPS, no pagos reales, no datos/documentos personales reales, no secretos en código.**
