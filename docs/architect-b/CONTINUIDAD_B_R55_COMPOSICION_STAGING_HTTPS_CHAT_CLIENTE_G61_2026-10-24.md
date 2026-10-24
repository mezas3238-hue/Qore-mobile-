# QORE Mobile — Arquitecto B · R55 · Mensajería Passenger STAGING unificada

**24 octubre 2026** · Repositorio `mezas3238-hue/Qore-mobile-` · Rama `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT.

## Cambio de prioridad por mandato del Owner: terminar la app con mayor velocidad

En vez de seguir únicamente con ajustes cosméticos de UI, se hizo lectura cruzada de G61 del Arquitecto A y de los contratos de Cliente R54. **G61 reporta NO_GO con 17 gates P0 que todavía carecen de evidencia de lanzamiento comercial completa.** Verde en CI/Expo export web no equivale a producto usable por pasajeros reales. No prometer despliegue ni pagos.

## R55 código funcional de integración en B

- `apps/movete-cliente/src/domain/passenger-chat-staging-composition.mjs`: factory `createPassengerChatStagingComposition()` reutiliza el dominio probado `createClientExperience()` y sus tres transportes Passenger **G51 bandeja / G52 historial / G53 envío** en un único HTTPS de STAGING. El usuario/runtime debe inyectar explícitamente: autorización STAGING, contrato de identidad, contratos chat, verificación operativa HTTPS, DNS hostname aprobado, proveedor de sesión con logout, verificación **independiente server-side** de rol exclusivo Passenger, fetch real inyectado. Sin todas estas condiciones, devuelve experiencia vacía, sin Auth/chat/tráfico. Producción siempre deshabilitada.
- `assertApprovedPassengerStagingOrigin()` valida HTTPS/DNS STAGING aprobado y fijo; rechaza localhost/IP, producción, userinfo, path, hash, query, puertos, redirecciones dudosas. Ni JWT ni secretos se embeben.
- `passenger-chat-staging-composition.d.mts`: tipado de la factory y contrato `STAGING_QA_ONLY`.
- `passenger-chat-staging-composition.test.mjs`: diez pruebas adversariales de gates OFF por defecto, cada gate aislado, protección LIVE, origen HTTPS pin, callbacks obligatorios, sesión Passenger independiente, roles/admin/Driver/expiración, limpieza en logout e incertidumbre de red. **Una respuesta POST ambigua NO se considera mensaje almacenado ni se reenvía automáticamente**: se conservan los flujos G53 existentes.

### Qué se integró y qué NO

La factory hace la **composición funcional ejecutable**, no una simulación que presenta disponibilidad. No se cambió `ClientRuntimeProvider` global: admite `experience` inyectada, y no es correcto conectar automáticamente un host sin IdP/STAGING autorizado. Toda la app real seguirá mostrando chat OFF hasta que A y Owner entreguen pruebas y autorizaciones. No se creó un endpoint ni se desplegó servidor. No se habilitan LIVE, pagos, vehículos ni comercio sin contrato.

## Gates de lanzamiento G61: estado real

A publica 17 P0: IdP real; servidor HTTPS móvil; Postgres persistente/backup; onboarding/KYC Driver; viajes Driver; reservas Cliente; PSP/settlement; privacidad KYC; SOS y operación; GPS móviles; delivery/merchant; chat dispositivo; Admin real; builds firmados Android/iOS; legal Paraguay; observabilidad y soporte; Owner GO. El registro de A declara **NO_GO**. R55 reduce acoplamiento para integrar G51-G53 cuando estén disponibles; **no cambia ninguna evidencia GO**.

## QA y continuidad acelerada R56

Revisar CI del mismo SHA: ownership B, Admin Web QA, aislamiento con Cliente/Driver tests TypeScript/Expo export web. **No declarar R55 SUCCESS si no aprobaron los tres**. A continuación: implementar en Cliente/adaptador un flujo QA completo con backend autorizado inyectado para historial/mensajería, sin falsos recibos, y exigir evidencias reales de IdP + HTTPS A. Coordinar en issue #9, con PR #8 y #7 DRAFT separados.

Mandatos: NO MERGE / NO LIVE / NO PSP / NO VPS / NO credenciales ni PII reales / NO uso de Lovable como backend. 

## Ensayo integrado añadido en este mismo corte
Se amplió `passenger-chat-staging-composition.test.mjs` con dos pruebas de recorrido sintético de la composición ya existente: **Auth Passenger verificado → G51 bandeja autorizada → G52 conversación del mismo servicio → G53 POST con `requestKey` → ACK durable exacto**; además prueba de ACK perdido que conserva `pendingSend` y **rechaza un segundo POST con nueva clave**. Es infraestructura QA sintética: no demuestra backend real, IdP/HTTPS desplegado ni mensajería entre teléfonos físicos.

## Incidencia de QA y corrección R55

La primera suite Cliente de R55 en el SHA `6f19bfe1c5fb22e0c4f6f6a3142367110d9f2a20` detectó **4 fallos en 12 pruebas nuevas**, mientras los tests anteriores seguían pasando. Causa: regex UUID de cuatro grupos en la nueva verificación previa del pasajero (`8-4-4-12`) que rechazaba sujetos Passenger válidos (`8-4-4-4-12`), impidiendo probar el recorrido G51/G52/G53. Se corrigió el validador en el commit `c923f15d3c9a1ec09ed6e32f55dd87f4b34c8653`. No se eliminó el requisito de identidad válida ni la verificación independiente; debe certificarse el nuevo SHA completo antes de marcarlo PASS.
