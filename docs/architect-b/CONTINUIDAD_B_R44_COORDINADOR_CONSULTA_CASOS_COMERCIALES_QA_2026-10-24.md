# QORE Mobile — Arquitecto B, R44: coordinador de lectura de casos comerciales QA
Fecha: 24 de octubre de 2026. PR #8, rama exclusiva de B. Continuación de R43.

## Código implementado
- `apps/movete-admin/src/merchant-case-query-flow.mjs`: coordinador de consultas SOLO QA de `MERCHANT_ORDER`, con funciones `load('refresh'|'next'|'previous')`, `snapshot()` y `clear()`.
- `merchant-case-query-flow.d.mts`: contrato de tipos, página visible, cursores y resultado.
- `merchant-case-query-flow.test.mjs`: 13 pruebas de casos positivos/adversariales.

## Invariantes de seguridad
1. Sin proveedor real por defecto. `getActor` necesita rol Admin, MFA, UUID y revisión de autenticación; `isCertified` debe venir de integración externa A; `readPage` está ausente salvo inyección deliberada. No se añadió URL de red, endpoint inventado, HTTP ni permisos.
2. Una sola lectura en vuelo; la generación de solicitud invalida respuestas tardías después de `clear()`, cambio de sesión o revisión JWT. Al iniciar otra consulta se oculta inmediatamente la página anterior.
3. `next` usa únicamente cursor de página QA válida y vigente, `previous` sólo cursores previamente vistos; se rechazan bucles de cursor. Los contadores son exclusivos de la página, nunca un total global.
4. `projectMerchantCasePage` R43 valida DTO estricto: sin PII, sujeto obligatorio `MERCHANT_ORDER`, TTL, revisión monotónica, sólo estados QA y capacidades de contacto/escritura/SOS falsas.
5. Al vencer TTL, regresar la revisión, perder Auth/MFA/certificación o fallar la lectura, se elimina la página. Sin asignación de agente, contacto ni pago.
6. El `readPage` futuro DEBE validar en el servidor los permisos, filtro `MERCHANT_ORDER`, cursor, pertenencia, estabilidad de snapshot y solicitud del usuario. Este coordinador no reemplaza RLS, autenticación ni prueba real E2E.

## Estado y dependencia
El OpenAPI de A consultado en G57 contenía 72 rutas y ninguna bandeja comercial específica. Aún falta contrato, sesión Admin/MFA y transporte STAGING CERTIFICADO en issue #9. Por eso R44 es lógica real de control, ensayada con datos sintéticos, **no** una bandeja conectada ni una funcionalidad LIVE. `AdminExperience` sigue con `merchantCases:null` y `merchantCaseContractReady:false`. No activar sin contrato A.

## Continuidad R45
Integrar progresivamente este controlador con el runtime B solo cuando exista contrato de backend explícito; entretanto avanzar accesibilidad y seguridad de navegación/errores en Cliente/Admin, siempre dentro de `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. Verificar CI sobre commit final y mantener PR #8 DRAFT. NO MERGE/NO LIVE/NO DEPLOY/NO pagos, datos reales o secretos.
