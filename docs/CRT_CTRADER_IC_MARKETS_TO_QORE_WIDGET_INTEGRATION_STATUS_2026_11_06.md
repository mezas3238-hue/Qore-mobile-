# Integración CRT IC Markets DEMO → QORE Mobile Widget: corte de implementación 2026-11-06

**Decisión Owner:** **cTrader DEMO de IC Markets** es el emisor previsto de alertas CRT/MSS. TradingView Free V34.12X aprobado continúa como referencia para certificar señales; NO se usará Pine webhook de indicador (no disponible en plan Free). **No trades, no LIVE, no órdenes, no MERGE**.

## Estado verificado por conectores (2026-11-06)

### Componentes existentes

- cTrader Open API: repositorio QORE Core, `src/qore/infrastructure/ctrader_open_api_market_data_client.py`. Consume M5/ProtoOAGetTrendbarsReq en cuenta DEMO autorizada, valida cuenta/símbolo y OHLC. No hay un proceso 24/7 enlazado a QORE Mobile.
- QA worker staging: Railway proyecto `qore-crt-alerts-qa`, ambiente `staging`, servicio `crt-demo-readonly-worker` en **staged-create, sin despliegue, sin credenciales**. Código `qore-crt-alerts/scripts/railway-ctrader-demo-entry.mjs` en `mezas3238-hue/qore-deepseek-reviewer`. Actualmente realiza un único probe autorizado view-only, NO suscripción continua ni envío de alertas.
- QA transport: Railway servicio `crt-alerts-firebase-qa-bridge`, también **staged-create, sin desplegar**. Código solo autoriza prueba FCM de SISTEMA cuando hay credenciales, no push de mercado.
- QORE Mobile: `/v1/crt/alerts` en gateway, autenticación y solo modo `OFFLINE_REPLAY`; widget existente consulta al menos cada 30 segundos mientras está activo; aviso local QA requiere consentimiento y permiso de Android.
- VPS `vps-vrix`: dispositivo del propietario **OFFLINE** para Remote Desktop Commander, no accesible para verificar conexión de datos.
- Comparador de velas IC Markets TradingView/cTrader: QORE Core PR #1005, tests offline PASS. Ninguna muestra de mercado real comparada; paridad todavía **NO CERTIFICADA**.

### Implementado en esta rama (PR #128)

1. Android: canal único y dedicado **`qore_crt_lab_replay_v2`**, diferente al de informes operativos. Sonido de notificación y vibración activados como **valores iniciales**, pero Android conserva y respeta la elección individual del usuario.
2. Flutter **Apariencia → Widget Android → Tono y vibración exclusivos CRT**. Abre ajustes Android del canal, donde el propietario puede elegir tono, vibración o silencio según opciones del dispositivo. No requiere red ni cTrader para configurar.
3. Botón de **prueba LOCAL** reproduce *ese mismo canal*, no uno distinto; el aviso sigue indicando expresamente que NO viene de cTrader/Railway. Permite probar el audio/háptico con permisos.
4. Las notificaciones de mercado aún están desactivadas. Se mantiene `QA/OFFLINE_REPLAY`, deduplicación, bloqueo de fuente falsa y TTL 4 horas.

## Integración aún pendiente — no afirmar conectado

1. **Autorización view-only**: configurar, en las variables privadas de Railway STAGING (NUNCA enviar secretos en chats), `QORE_CT_CLIENT_ID`, `QORE_CT_CLIENT_SECRET`, `QORE_CT_VIEW_ACCESS_TOKEN` (solo scope `accounts`), `QORE_CT_DEMO_ACCOUNT_ID` y `QORE_CT_EXPECTED_BROKER_TITLE` extraído del proveedor, junto a `QORE_CT_QA_PROBE=OWNER_APPROVED_VIEW_ONLY`. Verificar explícitamente cuenta `isLive=false`. No activar Scope Trade.
2. **Activación controlada staging**: revisar los **37 cambios staged** del proyecto Railway QA antes de aplicar. No ejecutar accept/deploy parcial ciegamente. Probar inventario IC y las 34 correspondencias ticker.
3. **Comparación de datos**: capturar M5 cerradas de IC Markets cTrader DEMO y muestras equivalentes de `IC:` TradingView, 600 por mercado en el laboratorio y verificar los siete tipos CRT, barridas y MSS M5/M15. **Ninguna señal cTrader debe presentarse como señal V34.12X hasta que pase esta compuerta.**
4. **Detector y transporte**: desarrollar loop continuo read-only cTrader (reconexión + heartbeat + no gaps), replay causal de las 7 familias, eventos idempotentes con fuente/UTC y vencimiento máximo 4 horas, autenticación interservicios Railway → gateway, outbox persistente y entrega FCM al dispositivo. Los módulos actuales aún no hacen esto completamente.
5. **Actualización APK in-place**: QORE Mobile Android ya instalada usa firma de app y AndroidKeyStore. La APK de GitHub Actions direct-install utiliza keystores efímeros por build; **no instalar encima** sin certificar paquete, mismo SHA-256 firmante y versionCode creciente. No solicitar desinstalar QORE Mobile para probar.
6. **E2E**: evento DEMO real en 1 instrumento → gateway auth → QORE Mobile → widget → aviso con sonido/vibración elegido → dedup → caducidad 4h, con pantalla apagada. Registro de pruebas y tiempos antes de habilitar los otros 33.

## Principio

La decisión de utilizar cTrader como **fuente operativa de alertas** no implica certificar automáticamente que sus velas equivalen a TradingView. Los dos usan IC Markets, pero siguen faltando pruebas de timestamp/OHLC. El indicador V34.12X **no se modifica** y ningún evento no certificado se etiqueta como evento del indicador aprobado.
