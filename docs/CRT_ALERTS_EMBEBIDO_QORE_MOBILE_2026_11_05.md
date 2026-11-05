# Integración QORE CRT Alerts dentro de QORE Mobile · 2026-11-05

## Decisión definitiva del Owner

CRT Alerts es un **módulo de QORE Mobile existente**, con el widget Android ya instalado. **No crear ni exigir una segunda app.**

**PR #122 DRAFT** sobre `agent/qore-mobile-foundation-001`, dentro de `mezas3238-hue/Qore-mobile-`. No merge, no LIVE, no operaciones ni señales financieras certificadas.

## Cambios implementados

- QORE Mobile (Flutter): `Alertas → Operativas | CRT Alerts`. Conserva la pantalla original de informes, balances, traders, posiciones y widgets. La vista CRT permite filtrar 34 instrumentos IC Markets y visualizar las siete familias CRT, con MSS M5 y M15 independientes, dirección, confirmación y vencimiento a las **4 horas**. Todo aparece marcado `OFFLINE REPLAY · NO OPERAR`.
- Gateway de QORE Mobile: `GET /v1/crt/alerts` protegido por la **misma sesión biométrica y prueba de firma del dispositivo**. No exige nuevo login Firebase ni contraseña cTrader en el teléfono. Sin un feed validado, responde `QA_NOT_CONNECTED` y lista vacía, nunca simula detecciones.
- `CrtQaInbox` en gateway valida símbolo, proveedor IC, fase nativa de M5/M15, identidad de evento y banderas de no certificación. Deduplicación y cuarentena de conflictos, ambas sujetas a la expiración de 4 horas.
- `POST /v1/admin/crt/qa-stage` es laboratorio puro; exige token admin y `QORE_CRT_QA_IMPORT_ENABLED=true`, pero está **deshabilitado por defecto y prohibido con `QORE_GATEWAY_ENV=production/live`**. No hay endpoint para mandar operaciones, señales certificadas o avisos FCM.
- El widget Android **compacto, normal y detallado** ahora incluye un renglón `CRT · Sin conexión`; si el propietario habilitó el servicio de widget, lee el nuevo endpoint autenticado **una vez cada ≥30 s** y muestra únicamente un resumen QA con etiqueta `no operar`. Se elimina de pantalla después de **60 segundos sin comprobación fresca**.
- Las cifras de balance/equity/P/L, cuentas, traders, riesgos y los informes del VPS permanecen independientes de CRT.

## Estado técnico

- Los archivos están en PR DRAFT, **no en la versión instalada**.
- El Gateway Railway de QORE Mobile (`qore-mobile-gateway`, producción) se mantiene intacto. **No se ha desplegado esta rama ni modificado sesiones existentes**.
- El backend separado de CRT Alerts en repo `qore-deepseek-reviewer` (PR #77) conserva sus estudios de integración Firebase y cTrader DEMO en STAGING; no debe entregar otra aplicación independiente. La futura conexión del detector se hará en backend autenticado y/o un Gateway seguro, no desde Pine directamente al teléfono.
- No existe fuente continua aprobada de 34 instrumentos IC Markets, paridad completa de 7 familias y MSS M5/M15 ni emisor push certificado; por tanto **no se anuncian alertas de trading reales ni entrega con app cerrada**.
- Widget Android requiere el servicio de widget ya activado por Owner. Si el sistema lo detiene, el renglón CRT caduca y no crea falsas alertas.

## Bloqueos de puesta en marcha

1. CI Python Gateway y Flutter/análisis/widget deben pasar, además de pruebas E2E externas.
2. Validar que el paquete Android `com.qore.mobile.qore_mobile` y su `versionCode` sean compatibles con la versión instalada; sobre todo **usar la misma clave estable de firma**. El workflow `android-direct-install-apk.yml` crea una **clave efímera nueva por ejecución**; ese APK **NO está habilitado para actualizar sin riesgo la aplicación instalada**. Nunca indicar desinstalar QORE Mobile sin respaldo de sesiones/consentimiento del Owner. Play Store usa su propia continuidad de firma.
3. Revisión y aprobación explícita de merge (actualmente prohibido por gobernanza Owner), seguido de despliegue controlado del Gateway y actualización de QORE Mobile con firma apropiada.
4. Conectar productor de eventos CRT en cTrader DEMO (solo lectura), certificar por mercado y familia la paridad frente a Pine y closed-bar, retener 4h como máximo, invalidación temprana, idempotencia y auditoría.
5. Integrar push FCM/APNs **dentro de QORE Mobile** usando su registro existente de tokens (`/v1/mobile/push-token`) y una credencial servidor-only; configurar un proyecto Firebase con la identidad Android de QORE Mobile **`com.qore.mobile.qore_mobile`**, no `com.qore.crtalerts.qa`. Las notificaciones de sistema/QA deben estar separadas de mercado.
6. Para widget iOS, actualizar WidgetKit/App Group cuando esté comprobada su sincronización; el avance de esta fase en widget es Android.

## Pruebas automáticas

- `gateway/tests/test_crt_qa.py`: 34/7, TTL 4 horas, falsificación y phase, dedup, conflicto, API con sesión y admin fail-closed.
- `apps/mobile/test/crt_alerts_embedded_test.dart`: contrato estricto, rechazo de señal LIVE/forjada/caducada, convivencia de informes VPS y CRT.
- CI de `Qore-mobile-`: Gateway CI, Mobile CI, Android Direct Install, Android Production Bundle y Security Gate.
