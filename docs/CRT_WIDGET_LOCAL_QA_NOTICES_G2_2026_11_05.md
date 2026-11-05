# QORE Mobile + CRT Alerts — G2 avisos locales QA Android
**Fecha: 05-nov-2026. Rama hija de PR #122. NO MERGE / NO LIVE / NO TRADING.**

## Decisión del propietario
CRT Alerts continúa dentro de la aplicación QORE Mobile ya instalada, junto al widget que supervisa el VPS. No se entrega ni publica una segunda app CRT.

## Implementación

- Flutter: Apariencia → Widget Android → Avisos CRT de laboratorio (Android). Interruptor desactivado por defecto; requiere Widget LIVE y permiso Android de notificación.
- MainActivity: el MethodChannel existente qore.mobile/security agrega consentimiento local setCrtQaReplayNoticeConsent. Al apagar Widget LIVE se revoca el consentimiento inmediatamente.
- QoreWidgetLiveService: conserva autenticación de sesión, firma de dispositivo y consulta del buzón CRT con intervalo mínimo de 30 segundos.
- QoreCrtWidgetSummary.latest: valida 34 símbolos, siete familias, MSS M5/M15, fase causal, identidad inmutable, tiempo, fuente IC, 4h exactas y exclusión de señales LIVE, no verificadas o contradictorias.
- QoreCrtReplayNotifier: si existe autorización expresa, crea aviso de sistema **CRT · Replay QA, NO OPERAR** con contenido sanitario de laboratorio; jamás sugiere entradas. Deduplica con digest SHA-256 y expira la deduplicación en hasta 4h. No conserva precios, claves ni cuentas.
- No se requiere Firebase para esta demostración de notificación local; no garantiza entrega si Android suspende el servicio foreground.

## Comprobaciones obligatorias antes de tocar el teléfono

1. La APK de PR #122, generada por android-direct-install-test, está firmada con una **clave temporal nueva cada ejecución**. NO usarla para actualizar la QORE Mobile instalada sin comparar su certificado. No pedir desinstalación porque se podrían perder datos de la sesión biométrica y el widget.
2. Obtener una compilación firmada con la misma clave del paquete ya instalado y versionCode creciente. Sin esa firma, una actualización in-place no es viable.
3. En QA/STAGING exclusivamente: ingestar una observación OFFLINE_REPLAY válida en el Gateway, habilitar Widget LIVE y la opción CRT QA, verificar un aviso con la app minimizada y comprobar que al desactivar el permiso cesan los avisos. Rechazar duplicados, MSS y tiempos falsos.
4. El backend de QORE Mobile actualmente en producción no ha recibido los cambios del PR #122. No desplegarlo en silencio; exige revisión y autorización.
5. Certificar 34 feeds de cTrader DEMO IC Markets, siete familias CRT y MSS por temporalidad independiente antes de permitir señales reales. Para entrega fiable con widget suspendido se requerirá FCM/APNs en el mismo paquete QORE Mobile.

Ningún push financiero real, orden o MERGE es autorizado por esta fase. La compilación CI acredita solo código compilado y pruebas, no recepción E2E en el móvil.
