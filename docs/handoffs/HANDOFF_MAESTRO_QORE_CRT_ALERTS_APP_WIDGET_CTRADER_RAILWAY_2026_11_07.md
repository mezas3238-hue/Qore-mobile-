# HANDOFF MAESTRO — QORE CRT ALERTS + QORE MOBILE + WIDGET + cTRADER DEMO
**Fecha de corte:** 07-nov-2026 · **Autoridad:** Owner · **Modo:** QA/STAGING · **Restricciones:** NO MERGE, NO LIVE, NO trading, NO push de señales no certificadas, NO sustitución de APK sin firma compatible.

> **Mensaje ejecutivo para el siguiente arquitecto:** continuar el desarrollo ya existente en GitHub. El Owner aprobó el indicador V34.12X de TradingView, y determinó la arquitectura **IC Markets cTrader DEMO → Railway → QORE Mobile existente → widget Android y avisos CRT exclusivos**. TradingView Free NO será el emisor porque el plan gratuito no da alertas técnicas del indicador. El indicador queda como referencia de señales. El conector, receptor, app y widget están construidos **PARCIALMENTE en ramas DRAFT**, con CI aprobado en los componentes principales. Los servicios CRT de Railway están **staged-create, NO DESPLEGADOS**; sin credenciales cTrader Open API; NO se reciben alertas de mercado reales. No declarar trabajo terminado hasta prueba cTrader real → gateway → teléfono → widget y paridad del motor.

## 1. Decisiones vinculantes del Owner

1. **No crear otra app.** CRT Alerts es una pestaña/función de **QORE Mobile** y se muestra también en el **widget Android existente** que monitorea el VPS. No confundir con **Movete Fácil Cliente/Driver**; su proyecto Railway `qore-mobile-staging` es ajeno.
2. El **indicador V34.12X de TradingView está APROBADO por Owner**. Aprobación del indicador no equivale a certificación del backend cTrader ni al envío de alertas. Mantener exactamente 34 fuentes IC Markets, 7 familias CRT, C1/C2/C3, MSS propios M5/M15, FVG H4, PDH/PDL, dashboard compacto/ampliado, 15 colores personalizables, alertas causales, sin lookahead/leakage. No recortar 600 M5 ni cambiar la fuente por otro bróker.
3. **Cuenta TradingView Free.** El dashboard Pine muestra CRT y MSS pero no puede hacer HTTP POST arbitrario. V34.12X no contiene `alert()` ni `alertcondition()` y TradingView Free no ofrece alertas técnicas sobre indicadores. Por tanto NO depender de webhook de TradingView ni prometer que el dashboard enviará por sí solo.
4. La cuenta **cTrader DEMO es IC Markets** y el Owner confirma que está vinculada con el mismo bróker/cuenta de referencia en TradingView. **Mismo bróker ≠ identidad garantizada de M5/H4**. Comparar OHLC, fases horarias, sesiones, DST, barridas y MSS antes de etiquetar alerta como equivalente a V34.12X.
5. **Alertas caducan a las 4 horas** desde cierre/confirmación causal de cada evento, o antes si se invalida la estructura. Sin almacenamiento de 7 o 30 días. El TTL no implica una entrada válida durante 4 horas.
6. Aviso **exclusivo CRT**, con elección de tono, vibración o silencio por parte del Owner, separado de los avisos generales de QORE. El widget debe mostrar instrumento, familia, CRT, MSS M5 y M15, hora y vigencia. El teléfono debe recibir notificaciones con la app en segundo plano; el widget no es por sí solo un canal fiable de push.
7. Acceso cTrader Open API **solo DEMO / OAuth `accounts` / permiso VIEW**; nunca `trading` ni órdenes, aunque haya cuentas LIVE disponibles. No introducir secretos en GitHub, chat, Pine o APK.
8. **GitHub fuente de verdad**, PR DRAFT, sin MERGE sin orden, sin cambio de producción, sin tocar FundedNext/LIVE y sin utilizar el VPS para trading sin instrucción.

## 2. Estado verificado de los repositorios (07-nov-2026)

| Repositorio | Rama/PR | Estado / entregable |
|---|---|---|
| `mezas3238-hue/qore-deepseek-reviewer` | [PR #79](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/79), `perf/crt-v34-12x-colores-only-speed-20261105` | V34.12X PERF ONLY; Owner midió mejora desde 2–3 minutos a ~1 minuto. Exact-parity tests CI PASS, optimización de invariantes; no alterar. |
| mismo | [PR #80](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/80), `perf/crt-v34-12x-lazy-snapshot-qa-20261105` | Variante G3 con construcción de UDT de salida solo en barra terminal, 4 workflows PASS; el Owner dijo después «indicador aprobado». No atribuir mejora temporal exacta a G3 si no se registró. |
| mismo | [PR #81](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/81), `feature/crt-demo-mobile-qa-probe-bridge-20261106`, HEAD `8784b408262807b0c366b774783dab2d2965c76e` | Worker cTrader DEMO one-shot read-only y publicador de comprobante QA hacia gateway con HMAC; **ambos workflows PASS**. PR DRAFT. |
| `mezas3238-hue/Qore-mobile-` | [PR #123](https://github.com/mezas3238-hue/Qore-mobile-/pull/123), `feature/qore-mobile-crt-widget-local-qa-notifier-20261105` | Pestaña CRT Alerts + inbox QA autenticado + widget y aviso local replay QA. 5 workflows PASS. |
| mismo | [PR #128](https://github.com/mezas3238-hue/Qore-mobile-/pull/128), `feature/crt-ic-demo-widget-notice-settings-20261106` | Canal Android CRT exclusivo (`qore_crt_lab_replay_v2`), ajustes de tono/vibración/silencio del sistema Android, botón prueba local por ese canal. 4 workflows PASS. |
| mismo | [PR #129](https://github.com/mezas3238-hue/Qore-mobile-/pull/129), `feature/crt-demo-readonly-health-bridge-20261106`, HEAD al corte `3fbf9f3271d0ec15bf987d9ad6a820c09e679508` (antes de añadir handoff) | Gateway recibe comprobantes HMAC QA, app y widget muestran estado cTrader DEMO *no certificado*. **5 workflows PASS** en ese HEAD, PR DRAFT. |
| `mezas3238-hue/qore-core` | [PR #1005](https://github.com/mezas3238-hue/qore-core/pull/1005), `research/crt-ic-tv-ctrader-m5-parity-20261105` | Comparador offline de 600 velas M5 IC TradingView↔cTrader por símbolo. Workflow específico PASS; se corrigieron observaciones Ruff del CI general, verificar nueva ejecución tras commit. PR DRAFT. |

**Relación de ramas:** QORE Mobile `#123 → #128 → #129` son ramas hijas; no mezclar con el `main` ni desplegar código solo por tener CI PASS. PR #81 del conector es proyecto distinto, enlazado contractualmente con #129. PR #1005 solo laboratorio de datos, no producción.

## 3. Archivos canónicos ya construidos

### Indicador aprobado

- Fuente original V34.12X: `crt-radar-pro/qa-34-feed-memory-probes/QORE_CRT_RADAR_34_CHART_V34_12X_COLORES_PERSONALIZABLES_QA_NO_LIVE.pine`.
- PERF ONLY usado en prueba: `crt-radar-pro/performance/QORE_CRT_RADAR_34_CHART_V34_12X_COLORES_PERF_ONLY_QA_NO_LIVE.pine`.
- G3 experimental: `crt-radar-pro/performance/QORE_CRT_RADAR_34_CHART_V34_12X_PERF_LAZY_SIGNAL_QA_NO_LIVE.pine`.
- No abrir PR viejo #78 de indicador V34.12N como vía de actualización.

### Fuente cTrader DEMO + lógica CRT en `qore-deepseek-reviewer`

- `qore-crt-alerts/scripts/railway-ctrader-demo-entry.mjs`: proceso **one-shot**, lee secretos sólo del ambiente, llama una consulta cTrader QA si Owner autorizó, termina. **No es worker 24/7**, no emite señales ni FCM.
- `qore-crt-alerts/src/ctrader-demo-wss-probe-qa.mjs`: WSS cTrader DEMO sobre `wss://demo.ctraderapi.com:5036`, INVENTARIO y una muestra histórica 48–500 M5 de solo lectura; requiere OAuth y `isLive=false`, `SCOPE_VIEW` explícitos.
- `qore-crt-alerts/src/ctrader-demo-view-session-qa.mjs`: correlación de mensajes y autenticación estricta.
- `qore-crt-alerts/src/ctrader-ic34-candidate-audit-qa.mjs`: mapeo tentativo 34 símbolos, `NDX100 = IC:USTEC`, `SPX500 = IC:US500`, **no mapeo certificado**.
- `qore-crt-alerts/src/ctrader-demo-crt-evaluator-qa.mjs`, `replay-cycle.mjs`, `aggregate.mjs`, `crt-h4.mjs`, `mss-m5.mjs`, `mss-m15.mjs`, `contracts.mjs`: motor de investigación/replay; **no certificar equivalencia automáticamente**.
- `qore-crt-alerts/src/qa-ctrader-mobile-probe-bridge.mjs` (PR #81): envía a STAGING una **constancia QA sin precios, tokens ni señales**; HMAC SHA-256, tiempo y nonce; bloquea gateway de producción, URL no HTTPS y falta de aprobación.
- `qore-crt-alerts/test/qa-ctrader-mobile-probe-bridge.test.mjs`: tests del puente firmados. `qore-crt-alerts/scripts/railway-firebase-transport-entry.mjs` y QA bridge FCM prueban solo mensajes de SISTEMA; **push de mercado intencionalmente desactivado**.

### Gateway, app y widget en `Qore-mobile-`

- `gateway/qore_mobile_gateway/crt_qa.py`: inbox de observaciones `OFFLINE_REPLAY`, 34 instrumentos y 7 familias, TTL máximo 14.400.000 ms, dedup, exclusión LIVE, identidad de evento y MSS causales.
- `gateway/qore_mobile_gateway/main.py`: autenticado `GET /v1/crt/alerts`, importación manual QA `POST /v1/admin/crt/qa-stage` apagada en producción.
- `gateway/qore_mobile_gateway/crt_ctrader_probe.py` (PR #129): nuevo receptor `POST /v1/admin/crt/ctrader-demo-probe` HMAC, validación DEMO/view, nonce antirreplay; lectura autenticada `GET /v1/crt/ctrader-demo-probe` para la app. **No entrega alertas reales.**
- `apps/mobile/lib/crt/crt_alerts_page.dart`: pestaña CRT con filtros 34 y contexto MSS; en PR #129 incluye tarjeta «cTrader DEMO · IC Markets» con estado QA/no certificado.
- `apps/mobile/lib/crt/crt_demo_probe_status.dart`: DTO, rechaza flags falsos LIVE/push y datos caducados.
- `apps/mobile/lib/data/qore_gateway_client.dart`: reutiliza sesión firmada y credenciales del teléfono para ambas rutas; NO necesita el token cTrader en Android.
- `apps/mobile/android/app/src/main/kotlin/com/qore/mobile/qore_mobile/QoreWidgetLiveService.kt`: consulta `/v1/crt/alerts` como máximo cada 30 s y ahora también endpoint de comprobante cTrader. **Polling no equivale a notificación instantánea garantizada**.
- `QoreCrtWidgetSummary.kt`: solo proyecta replay QA válido; `QoreCrtDemoProbeStatus.kt`: texto de estado cTrader QA sin señales.
- `QoreCrtReplayNotifier.kt`: canal Android `qore_crt_lab_replay_v2`, ajustes del sistema para tono y vibración; notificación local QA consentida, dedup y expiración. NO envía FCM.
- `MainActivity.kt`, `native_device_session_provider.dart`, `appearance_page.dart`: puente al ajuste nativo y botón para probar tono/vibración. La opción de avisos QA está desactivada inicialmente.

## 4. Railway: estado real e identificadores

| Proyecto | Entorno / servicio | Estado actual |
|---|---|---|
| `qore-crt-alerts-qa` · ID `091cf49e-8489-4cc7-a957-218c50bd1428` | `staging` ID `1d86d681-f64d-4bcc-8ff7-aeda93403fcd` | **37 modificaciones preparadas en patch**. No desplegar sin auditar todas. |
| Mismo | `crt-demo-readonly-worker` ID `48f5de19-cabc-4ff0-b615-525fae7832a3` | `staged-create`, sin deployment, apuntando a rama ANTIGUA `feature/crt-v34-11a-seven-catalog-34feeds-20261102`, no a PR #81. No hay credenciales configuradas. |
| Mismo | `crt-alerts-firebase-qa-bridge` ID `77c2066c-73db-4f95-a531-7915490f1e8e` | `staged-create`, sin deployment, código QA FCM; push mercado desactivado. |
| `qore-mobile-gateway` · ID `77a7a359-1045-4e15-8a8b-fb473ffd56dd` | `production`; `qore-mobile-gateway` ID `57f99452-bcdf-45ae-83ba-786d2ebbba82` | LIVE/operativo para otras funciones; rama vieja `agent/qore-mobile-foundation-001` commit `67c1bb97232ca5c68cfefeba367881b0a4322878`. **NO contiene estos PR nuevos desplegados; no tocar sin autorización.** |
| `qore-mobile-staging` · ID `f0afe535-a398-41bf-b8cc-918dcf108667` | `qore-mobile-backend-staging` | **AJENO: Movete Fácil**, raíz `/apps/mobility-expo`. **PROHIBIDO REUTILIZAR** para gateway CRT. |

**VPS `vps-vrix`**: Remote Desktop Commander reportó `Offline` en 07-nov-2026. No podemos afirmar que se extrajeron datos de su sesión real ni modificar sus runtimes. El conector cTrader Open API puede correr en Railway, sin entrar al VPS, si se obtiene OAuth seguro y se configura un servicio STAGING dedicado.

## 5. Credenciales y autorización: tarea humana que falta

El Owner trabaja desde Android. Último paso guiado: abrir [portal oficial cTrader Open API](https://openapi.ctrader.com/) y comprobar si existe aplicación `Approved` o crear `QORE CRT Alerts QA` para lectura de datos. **No tenemos aún confirmación de su estado**. El siguiente arquitecto NO debe volver a preguntar datos ya respondidos: cTrader DEMO y TradingView usan IC Markets y el usuario confirmó misma vinculación.

Para el worker en variables SECRET de Railway STAGING (nunca solicitar valores por chat):
- `QORE_CT_CLIENT_ID`
- `QORE_CT_CLIENT_SECRET`
- `QORE_CT_VIEW_ACCESS_TOKEN` — OAuth `accounts` / view-only; no `trading`.
- `QORE_CT_DEMO_ACCOUNT_ID` — cuenta numérica DEMO validada con `isLive=false`.
- `QORE_CT_EXPECTED_BROKER_TITLE` — valor exacto de `brokerTitleShort` que entrega la API; no presumir por marca comercial.
- `QORE_CT_STAGE=DEMO`, `QORE_CT_OAUTH_SCOPE=accounts`, `QORE_PROVIDER=IC`, `QORE_TRADING_ENABLED=false`, `QORE_PUSH_ENABLED=false`, `QORE_ALERT_TTL_SECONDS=14400`.
- `QORE_CT_QA_PROBE=OWNER_APPROVED_VIEW_ONLY`, solo después de credenciales y aprobación.

Para firmar el comprobante entre worker y gateway QA (ambos deben tener la misma clave privada aleatoria de 32+ bytes):
- En QORE Mobile Gateway **QA/STAGING**: `QORE_GATEWAY_ENV=staging`, `QORE_CTRADER_DEMO_PROBE_ENABLED=true` y secreto `QORE_CTRADER_DEMO_PROBE_HMAC_SECRET`.
- En cTrader worker QA: `QORE_CTRADER_QA_MOBILE_BRIDGE=OWNER_APPROVED_PROBE_ONLY`, igual `QORE_CTRADER_DEMO_PROBE_HMAC_SECRET`, y `QORE_CTRADER_QA_GATEWAY_URL=https://<host-qa-o-staging>.up.railway.app/`; el código rechaza explícitamente host que indique production.
- Se necesita **un gateway QORE Mobile QA/STAGING independiente**, apuntando a la rama validada; producción NO es opción para la primera prueba.
- Secretos solo vía panel protegido de Railway, no GitHub Actions logs, chat, apk ni código. Nunca activar Trading Scope.
- La infraestructura puede requerir refresh de OAuth y persistencia de sesión al evolucionar de one-shot a 24/7; aún no implementado.

## 6. Plan de ejecución obligatorio para cerrar el producto

**Fase A — conseguir conexión cTrader DEMO real**:
1. Guía de cTrader Open API desde Android: application status `Approved`, redirección OAuth oficial, scope `accounts`, token VIEW ONLY; registrar en secretos Railway STAGING. Si no hay app aprobada, completar registro/aprobación; nunca simular token. Confirmar cuenta `isLive=false` + exacto `brokerTitleShort`.
2. Revisar 37 cambios staged de `qore-crt-alerts-qa` antes de aplicar. Reparar fuentes de los servicios: el worker sigue apuntando a rama antigua y debe apuntar a un commit aprobado derivado de PR #81. Asegurar Node 22, comando correcto `npm run railway:ctrader:demo:qa` y sin orders. Mantener proveedor FCM separado y desactivado para mercado.
3. Preparar **QORE Mobile Gateway dedicado de QA** con el código PR #129, variables seguras, persistencia apropiada para el entorno y dominio HTTPS QA. Evitar mezclar con Movete Fácil o el gateway de producción.
4. Probar inventario cTrader real con alcance VIEW, cuenta DEMO, símbolo y timestamp, sin enviar un evento CRT. Confirmar comprobante HMAC 202 al gateway QA y GET autenticado móvil. Exponer estado de transporte real y errores sin mostrar tokens. Por ahora el worker finaliza después de una sola prueba, no permanece activo.

**Fase B — certificar fuentes y detección**:
5. Inventariar 34 pares reales con ID y dígitos nativos, correspondencia exacta IC TradingView↔cTrader, sesiones/bid/ask, phase offset +0..+4 M5, ausencias y pausas. No confundir `IC:USTEC`/`IC:US500` con los aliases visuales NDX100/SPX500.
6. Capturar velas M5 CERRADAS y equivalentes de TradingView en mismo intervalo UTC (sin scraping ni exportación no permitida). El laboratorio en QORE Core `tools/crt_feed_parity/compare_ic_m5.py` requiere por defecto **600 velas M5 por símbolo**; el worker QA actual solo extrae hasta **500** en una muestra, por lo que se requiere paginación/colección segura antes de completar este gate. Informe de OHLC/horario/phase/gaps por mercado. `SAMPLE_MATCH_ONLY` certifica solo igualdad en muestra, **NO CRT/MSS**.
7. Certificar engine C1/C2/C3, 7 familias, FVG H4, PDH/PDL, 6 H4/día, MSS M5 independiente del M15 y lógica temporal NY/DST; comparar **eventos exactos** (familia, símbolo, dirección, timestamp, niveles) contra V34.12X. Falsos positivos o divergencias: bloquear instrumento/causa, no inventar paridad.

**Fase C — circuito real alertas/avisos**:
8. Evolucionar worker actual one-shot a proceso persistente **view-only**, con manejo seguro de OAuth, WebSocket, heartbeats, reconexión, 34 fuentes permitidas, M5 cerradas, gaps, durabilidad/idempotencia, backfill y telemetry por mercado. Mantener proceso independiente de ejecución de órdenes. Railway con health/metrics/logs sanitizados.
9. Gateway debe disponer de **ingesta real autenticada de eventos** con evidencia, separación QA/certificado; buzón actual solo permite `OFFLINE_REPLAY` y responde `live_feed=false`. Implementar almacenamiento temporal confiable, dedup por evento/familia, TTL 4 horas desde cierre, invalidaciones, control de reenvíos, consultas del Owner y sin aceptar señales futuras ni de broker distinto.
10. Entrega móvil cuando app esté en segundo plano o Android limite polling: implementar **FCM push real** con consentimiento, token registrado y revocación, respaldo seguro, expirar tiempo restante de evento; distinguir test local, prueba SISTEMA y alerta CRT verificada. Tono/vibración/silencio son del **canal Android exclusivo**; verificar Android 13+ `POST_NOTIFICATIONS` y opciones del sistema. No declarar que el polling del widget cada 30s garantice inmediatez.
11. Actualizar app firmada con el **mismo certificado** que la instalada y `versionCode` superior. Los APK de `android-direct-install-apk` de GitHub tienen certificado **EFÍMERO** por ejecución; no actualizan necesariamente app instalada y no se debe pedir desinstalar porque se arriesgan credenciales biométricas, AndroidKeyStore, sesiones y widget. Revisar `docs/QORE_MOBILE_CRT_G3_LOCAL_TEST_AND_OWNER_SIGNING_2026_11_05.md` y flujo `.github/workflows/android-owner-signed-update.yml`. El AAB de CI no equivale a distribución firmada y autorizada.
12. E2E **con evento auténtico**: cTrader DEMO IC → motor de 7 CRT/MSS certificado → Railway → Gateway/FCM → QORE Mobile → widget y notificación con tono/vibración elegido. Probar app abierta, cerrada y pantalla apagada, reconexión, duplicados, invalidación, caducidad, símbolos sin feed, errores, pérdida de conectividad, y todos los 34 pares. Guardar evidencia tiempos reales de detección y entrega sin prometer latencia sin medir.

**Fase D — cierre de producto**:
13. Revisar pruebas unitarias/CI, seguridad, observabilidad e instrumentación, y certificado de fuente. Solicitar autorización Owner para MERGE y despliegue; no hacerlo antes.
14. Entregar una instalación actualizable con firma coincidente, documentar mantenimiento, rotación de tokens/secrets, permisos Android/FCM, alarmas de salud 24/7 y procedimiento de recuperación sin pérdida de usuario.
15. Certificar UX: CTA de permiso, menú de tono/vibración, silencio, test real del canal, visualización de los 34 pares, familia CRT, C1/C2/C3, MSS M5/M15 correctos, fecha UTC/local, vigencia visible 4 horas, widget y notificación congruentes.

## 7. Evidencia de tests y limitaciones

- QORE Mobile PR #129 **Gateway CI / Security Gate / Mobile CI / Android Direct Install APK / Android Production Bundle**: 5 SUCCESS en commit `3fbf9f3271d0ec15bf987d9ad6a820c09e679508`, *antes de documentar este handoff*. Compilación CI significa código compilado, **no instalación compatible con la app instalada ni entrega E2E real**.
- CRT PR #81: foundation offline tests y DeepSeek harness SUCCESS en commit `8784b408262807b0c366b774783dab2d2965c76e`.
- QORE Core PR #1005: laboratorio offline específico SUCCESS; CI general tuvo observaciones Ruff, se corrigieron en commits `3abe52a...`, `5a21749...` y `084aea95...`; revisar CI general en HEAD tras esta corrección.
- GitHub PR #79/#80 pruebas estáticas/source parity SUCCESS, no medir velocidad con CI; Owner reportó ~1 minuto de carga tras optimización. Indicador aprobado Owner.
- Railway: **0 servicios CRT desplegados en el proyecto QA**; no hay evidencia real de OAuth, 34 feeds, paridad de velas, notificación al dispositivo. Gateway producción no recibió código PR #129.

## 8. Errores prohibidos y prioridades del siguiente arquitecto

- **Prohibido decir «ya conecté cTrader a la app»** porque solo está implementado el *handshake QA con HTTP simulado* en repositorios. No se ha ejecutado en Railway real.
- **Prohibido transformar un comprobante QA de conexión en una alerta CRT del mercado**. `QA_PROBE_RECEIVED` solo significa que un emisor con HMAC presentó un reporte reciente; no prueba que el broker ni TradingView certifiquen fuente.
- No instalar ni prometer actualizar APK de GitHub sin resolver certificado/vCode. No usar project `qore-mobile-staging` porque es Movete Fácil.
- No asignar a TradingView Free la emisión directa de webhooks ni leer el contenido de Pine tables desde servidor.
- No confundir «mismo IC Markets» con «idénticas velas». La paridad real es una compuerta obligatoria.
- No pedir al Owner tokens por chat, ni subirlos a archivos. Solo guiar acciones manuales mínimas en paneles oficiales cTrader y Railway.
- Ejecutar acciones en orden: **OAuth VIEW-only → Gateway QA dedicado y worker QA → prueba de datos real → paridad 34/34 → worker persistente → eventos autenticados → FCM/app/widget → E2E → certificación y autorización merge**.

## 9. Enlaces de continuidad

- [QORE Mobile PR #129 — Gateway + app/widget QA](https://github.com/mezas3238-hue/Qore-mobile-/pull/129)
- [QORE Mobile PR #128 — Notificaciones CRT tono/vibración](https://github.com/mezas3238-hue/Qore-mobile-/pull/128)
- [QORE Mobile PR #123 — CRT dentro de la app, widget y replay](https://github.com/mezas3238-hue/Qore-mobile-/pull/123)
- [cTrader QA worker PR #81](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/81)
- [V34.12X optimizado PR #79](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/79)
- [V34.12X G3 PR #80](https://github.com/mezas3238-hue/qore-deepseek-reviewer/pull/80)
- [Comparador IC M5 PR #1005](https://github.com/mezas3238-hue/qore-core/pull/1005)
- [Portal oficial cTrader Open API](https://openapi.ctrader.com/)

## 10. INSTRUCCIÓN MAESTRA PARA EL NUEVO CHAT

Actúa como **arquitecto de continuidad QORE CRT Alerts**. No reinicies ni reimplementes piezas que ya están en los PR arriba. Revisa los HEADs actuales y CI desde GitHub antes de editar; GitHub manda, no supongas que PR DRAFT = merged/deployed. El Owner confirmó IC Markets DEMO, mismo bróker TradingView, indicador V34.12X aprobado, TradingView Free y deseo de alertas CRT/MSS en **QORE Mobile y widget Android existente** con sonido/vibración configurables y TTL 4 horas. Debes completar todas las fases y **orientar al Owner desde Android para la autorización OAuth solo lectura y variables privadas Railway**, sin pedir secretos en chat. Separa explícitamente **QA / certificado / desplegado / probado E2E**. No usar LIVE, no ejecutar trades, no cambiar Movete Fácil, no merge sin orden, no instalar APK incompatible. Informar bloqueos verificados y próximos pasos concretos, no solo planes. **La prioridad es habilitar una conexión DEMO genuina y segura, después certificar fuente y finalmente alertas reales + widget con pruebas en el teléfono.**
