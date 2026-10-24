# QORE Mobile · Arquitecto B · R30 — GET G52 integrado en Cliente como solo lectura

**Corte:** 23 octubre 2026, Paraguay. Repositorio `mezas3238-hue/Qore-mobile-`, rama `feature/mobility-cliente-admin-parallel-20261022`, PR #8 **DRAFT**. Cambios confinados a `apps/movete-cliente/**` y `docs/architect-b/**`. **NO MERGE / NO LIVE / NO VPS / NO pagos ni datos reales.**

## Base verificada

- Arquitecto B entregó hasta R29; [CI aislamiento R29 #40049177808](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049177808) SUCCESS, Cliente **524/524 PASS**, Admin **185/185 PASS**, **709/709** en QA, TypeScript y export web; [CI del documento R28–R29 #40049221952](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049221952) SUCCESS. La exportación web NO es una build móvil nativa ni prueba de backend real.
- Contrato A OpenAPI `1.0.0-g52`, 62 paths, GET `/v1/staging/chat/services/{serviceKind}/{serviceId}/messages` firmado por JWT y conversación, pero marcado **`x-qore-runtime-wired:false`**, por lo que ningún teléfono obtiene todavía datos reales de este endpoint. Tampoco existe POST compatible certificado con idempotencia y ACK de `requestKey`.
- R28 creó transporte HTTP `createG52ChatHistoryHttpGateway` autenticado, bounded, pinned HTTPS, **OFF por defecto**; R29 pasó `expectedConversationId` al paginar y revalidar un POST ambiguo. Falta de R29: el transporte G52 no estaba compuesto en `ClientExperience` y el controlador exigía `sendMessage` incluso para un GET de solo lectura.

## R30 — Código efectivamente publicado

1. [`8735e43b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8735e43b1ad6e29ebe277adf7f51a07502eb44fe), `passenger-chat-flow.mjs`: `ready()` ahora certifica lectura GET autenticada sin requerir la función POST; `sendReady()` se calcula aparte y aparece como booleano en `snapshot()`. `send()`/ `retryPending()` fallan **`CHAT_SEND_NOT_CERTIFIED`** antes de generar estado pendiente, idempotency key, red o mensaje cuando falta el transporte de escritura. Si POST existe y se certifica, el flujo anterior sigue vigente.
2. [`9399659e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/9399659e75e81798d0c9794dc1a500d392ad509a), `client-experience.mjs`: añade opción explícita `g52ChatHistoryHttpOptions`, construye transporte G52 con JWT de la sesión actual y callbacks de revocación; `chatGateway` inyectado tiene prioridad para pruebas existentes. Sin configuración STAGING certificada, el lector continúa **OFF**. Se compone como fallback `chatGateway ?? g52HistoryHttp`, sin capacidad artificial de POST.
3. [`7d9b0b41`](https://github.com/mezas3238-hue/Qore-mobile-/commit/7d9b0b41ab8fee6db90ce957e2d524e34954eaca), `app/mensajes.tsx`: cuando `sendReady === false`, el historial validado se presenta **solo lectura**, con mensaje accesible que aclara que aún faltan autorización de escritura y ACK persistido. El editor y el botón Enviar/Reintentar no se renderizan; el handler también rechaza cualquier intento de enviar sin writer certificado.
4. [`62e86e4b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/62e86e4b2e6ff5a500ef32a3cf35f094cbf8e0a1) añade 2 pruebas para GET/paginación sin writer ni POST, y revocación de capacidad de escritura en vivo sin generar pendientes.
5. [`1661b017`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1661b017dfbf07977dbd7e735c127e3a889ddf68) añade 2 pruebas integrales `ClientExperience` → sesión Passenger → G52 HTTPS sintético → controlador en modo lectura, y gates OFF que prohíben hacer red.

## CI del corte R30

- [Cliente / Driver / aislamiento #40049919947](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049919947)
- [Admin #40049919864](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049919864)
- [Límites propiedad B #40049919917](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049919917)

**Los workflows estaban en cola al publicar este documento.** Verificar 3/3 y métricas de los logs antes de afirmar PASS R30; corregir fallos exclusivamente en rutas B, sin atribuir éxito a un SHA anterior.

## Continuación priorizada para Arquitectos A y B

1. **A** montar GET G52 realmente en HTTPS STAGING con JWT/passenger, RLS/servicio asignado, cursor firmado, `expectedConversationId` y revocación por reasignación/servicio cerrado; aportar URL de staging segura por configuración, SHA de código, CI y pruebas sintéticas desde 2 identidades. B no debe activar la opción hasta contar con esa evidencia.
2. **A** implementar POST para conversación asignada con persistencia atómica e idempotencia durable por `requestKey` y ACK verificable. Deben existir driver recipient y ambas aplicaciones montadas. Solo entonces B podrá inyectar un gateway `readMessages + sendMessage` y mostrar `sendReady:true`.
3. **B** verificar regresión de sesión rotada, UI al vencer TTL, reintentos ambiguos, accesibilidad y rendimiento en Android/iOS reales; no usar datos privados en QA.
4. **B** continuar Cliente/Admin en rama propia, conservar [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT, sin merge ni LIVE. Coordinación [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

**Estado transparente:** el código R30 permite lectura separada de escritura **solo si el backend GET se monta y certifica en el futuro**. Actualmente, con flags OFF, no habilita conversaciones ni mensajes reales; no supone despliegue ni app comercial terminada.

## Addendum R30 — Hallazgo real de TypeScript y cobertura de logout

- La primera CI del SHA funcional `1661b017`, [run #40049919947](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049919947), **FALLÓ** exclusivamente en TypeScript de `app/mensajes.tsx` (`TS2339`, propiedad `sendReady` ausente de `ClientSnapshot` en la declaración `client-experience.d.mts`); Admin y ownership pasaron. El fallo se identificó leyendo el log del job `120740199104`, **no declararlo como PASS**.
- **Corrección** [`11af02d6`](https://github.com/mezas3238-hue/Qore-mobile-/commit/11af02d649939170850d586df10c60308d840170): incluye `sendReady:boolean` en el contrato público `ClientSnapshot.chat`. Verificar los workflows asociados a este nuevo commit: aislamiento [#40050044584](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050044584) y [#40050045394](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050045394) (dos ejecuciones reportadas), Admin y ownership.
- **Prueba adicional** [`07df8938`](https://github.com/mezas3238-hue/Qore-mobile-/commit/07df8938832a960a963ca70615cef137f3be03c7): logout en mitad de una lectura HTTPS G52 suspendida; verifica `AbortSignal.aborted`, descarte de la respuesta tardía, `authenticated:false`, cero mensajes expuestos y cero pending sends. No necesita usuarios reales, datos sensibles ni endpoint montado. CI del nuevo SHA: [aislamiento #40050139688](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050139688); leer logs antes de declarar éxito.
- La funcionalidad sigue **OFF por defecto**. Mantener tres gates certificados (enabled + contractCertified + stagingRuntimeVerified) y no confundir infraestructura de lectura con certificación de escritura. Todos los commits siguen en la rama B y PR #8 DRAFT.
