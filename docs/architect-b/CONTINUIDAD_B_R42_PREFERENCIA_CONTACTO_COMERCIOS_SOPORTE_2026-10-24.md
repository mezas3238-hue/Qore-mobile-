# QORE Mobile — Arquitecto B | R42 Preferencias privadas para contacto comercial

**Fecha:** 2026-10-24. **Repo:** `mezas3238-hue/Qore-mobile-`. **Rama:** `feature/mobility-cliente-admin-parallel-20261022`, PR #8 DRAFT, base A PR #7. **NO MERGE / NO LIVE / NO DEPLOY / NO PSP / NO secretos.**

## Objetivo

Continuar R41 en Cliente con una preparación de contacto que permita elegir entre soporte y comercio al reportar incidencias de un pedido, **sin utilizar erróneamente el chat Cliente↔Driver** y sin afirmar que existe un canal real o un caso atendido. Las capturas de Bolt, Uber y la referencia funcional PedidosYa no autorizan copiar marca, código ni diseño exacto.

## Trabajo implementado

1. **`apps/movete-cliente/src/domain/merchant-contact-preference.mjs`**: dominio puro de consentimiento efímero en RAM. La entrada se valida mediante una guía R40 previamente revisada, con `subjectKind:'MERCHANT_ORDER'`, UUID de pedido, categoría y severidad G40. Además verifica el actor `passenger` autenticado por contexto local, UUID y `sessionRevision` íntegra. Este gate es **solo local**; no acredita titularidad del pedido ante el servidor.
2. El contacto `MERCHANT` solo puede seleccionarse para categorías `LOSS` y `QUALITY`. Disputas de cobros y seguridad `DISPUTE`/`SAFETY` obligan a seleccionar `SUPPORT`, nunca comercio directo. No se ofrecen canales telefónicos, WhatsApp, SMS ni correo; única intención futura `IN_APP_ONLY`, NO habilitada.
3. **Consentimiento reversible** por destinatario: cambiar destinatario reinicia consentimiento; editar pedido/motivo/gravedad, cambiar cuenta/JWT/sesión, o superar el TTL de **10 minutos** lo invalida. `review` solo es válido tras elegir destinatario y consentimiento explícito; devuelve `submitted:false`, `contactAttempted:false`, `caseCreated:false`, `merchantNotified:false`, `supportNotified:false`, `channelAuthorized:false`, `messageStored:false`, `serverConsentRecorded:false`, `sendEnabled:false`. Sin URL, token, mensaje, endpoint o `requestKey`.
4. **`merchant-contact-preference.d.mts`**: contrato TypeScript de DTO de entrada **no confiable** (se acepta `unknown` antes de validar, para nunca inferir certificado por un tipo), consentimiento y estados explícitamente no operativos.
5. **`merchant-contact-preference.test.mjs`**: pruebas de denegación predeterminada, consentimiento necesario, revocación, enrutamiento por categoría, cambio de cuenta/JWT, modificación de pedido y severidad, TTL, inyecciones, roles, ausencia de métodos de red y `dispose`.
6. **`app/soporte.tsx`**: en la guía R40 visible solo con Auth Cliente, aparece una sección para escoger la preferencia de contacto si el borrador es válido, confirmar/revocar consentimiento y revisarlo **sin enviar**. UI advierte que no hay contacto ni caso real. El estado se limpia cuando se edita la guía, al borrar y al desmontarse; el componente ya se remonta por `privateViewRevision` para no arrastrar datos a otra sesión.

## Evidencia técnica y bloqueos

Consultado el último OpenAPI del Arquitecto A durante R42 (`1.0.0-g57`): G40 incidentes, G44 Buyer, mensajería G51–G58 y Driver Chat continúan `x-qore-runtime-wired:false` y QA-only para rutas explícitas. Los endpoints de chat existentes contemplan **pasajero ↔ driver asignado**; no autorizan escribir a comercios ni al equipo de soporte. NO acoplar R42 al chat del repartidor. No se ha implementado red, envío de mensajes, números de caso, live tracking ni feedback operativo.

## Pendientes de Arquitecto A — issue #9

1. Definir **contrato real de canal de soporte/merchant** con identidad y pertenencia del pedido `MERCHANT_ORDER` verificadas mediante JWT/RLS y roles; objeto `contactChannelId` diferente del hilo Driver y vigente por TTL.
2. Definir consentimiento persistente, revocación y retención; `SUPPORT` para seguridad y disputa; `MERCHANT` solo ante una política verificable. Sin compartir datos privados con el destinatario antes de autorización.
3. Implementar POST idempotente con `requestKey`, ACK duradero, resolución de timeout tras commit y bandeja de casos de soporte en Admin; registrar `merchantContacted` o `operatorNotified` solamente si el backend lo evidencia.
4. No confundir `status:'triaged'` de QA con trabajo humano; no declarar SOS ni emergencia salvo operación legalmente habilitada. Farmacias quedan limitadas a OTC autorizado y a sus reglas regulatorias.
5. Ensayos adversariales: cuentas cruzadas, permisos revocados, reasignación de Driver sin afectar contacto a comercio, actualización de stock/precio/pedido, repetición/timeout, fuga de cuerpo/PII, rotación JWT y concurrencia; QA sintético, dispositivo Android/iOS y CI en el mismo SHA.

## Controles de continuidad

- Sólo modificar `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. No invadir backend/Driver del Arquitecto A. Mantener PR #8 **DRAFT**.
- Verificar **3/3 workflows del HEAD final**: ownership B, Admin Web QA y two-app isolation (test/typecheck/export WEB Cliente y Driver). No afirmar certificación sin resultados.
- Seguir con R43 en un módulo Cliente/Admin independiente si A no ha montado contratos; ejemplo: vista de casos en Admin con lectura autorizada y minimización de metadatos, sin fingir asignación de operador ni crear endpoints. Consultar commits A/B y handoffs anteriores antes de trabajar.
- No inferir producción de cualquier OpenAPI, catálogo o prueba sintética. La app sigue sin operar con usuarios ni comercios reales hasta certificación integral y orden Owner.
