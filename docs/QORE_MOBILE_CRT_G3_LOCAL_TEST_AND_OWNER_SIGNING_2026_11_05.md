# QORE Mobile — G3: prueba local de notificaciones y firma de actualización
**Corte: 05 de noviembre de 2026. PR #123 (hijo de #122). QA / NO MERGE / NO LIVE / NO TRADING.**

## Decisión obligatoria
CRT Alerts va dentro de QORE Mobile y usa el widget del VPS existente; no se creará una segunda app como producto. Mantener la sesión biométrica, AndroidKeyStore, firma de instalación, informes VPS y configuración.

## Código incorporado
1. Apariencia → Widget Android → Probar notificación Android (LOCAL). Un toque genera un aviso de 60 segundos con título "QORE Mobile · PRUEBA LOCAL" y texto "NO procede del VPS ni es CRT". En Android 13+ solicita permiso si falta. Respuesta significa "Android aceptó el aviso", no que el teléfono lo haya mostrado ni que Railway haya enviado algo.
2. La prueba local manual no precisa suscripción CRT QA, FCM ni detector de mercado. Distingue bloqueo de permisos Android de problemas de red.
3. Avisos CRT de laboratorio conserva interruptor separado APAGADO por defecto; requiere Widget LIVE, permiso, sesión autenticada de QORE Mobile, 34 símbolos y un evento OFFLINE_REPLAY vigente (TTL ≤4h). Deduplica por ID y tiempo máximo de 4h. NO es señal de trading.
4. El widget distingue "CRT · Sin conexión" de "CRT QA · Gateway OK · Sin feed" (Gateway autenticado válido, todavía sin feed) y de eventos QA vigentes.
5. Nuevo apps/mobile/tool/verify_apk_update.py comprueba paquete, SHA-256 de certificado de firma y versionCode creciente. Falla cerrado. Tests unitarios ejecutados en Mobile CI.
6. Android Direct Install incorpora DO_NOT_UPDATE_EXISTING_QORE.txt en el artefacto; genera un keystore temporal nuevo cada ejecución.

## Firma: bloqueo real y no resuelto por una APK compilada
- Las APK direct-install previas de PR #122 y #123 tienen certificados DISTINTOS y NO pueden actualizarse entre sí ni se deben instalar encima de una QORE Mobile instalada.
- La app actual usa credenciales biométricas/tokens protegidos por AndroidKeyStore, que se pierden si se desinstala. NO pedir borrarla como solución.
- Un nuevo keystore NO puede actualizar una app firmada con el certificado anterior. Solo la firma compatible (o un mecanismo de rotación oficialmente revisado) y versionCode superior permiten in-place.
- Si el keystore original era efímero y ya se eliminó, la actualización in-place no se puede reparar mágicamente: un procedimiento de re-enrolamiento y migración requeriría autorización explícita.

## Flujo protegido para una actualización real
Archivo: .github/workflows/android-owner-signed-update.yml
- Se inicia solo mediante workflow_dispatch, desde la rama MAIN revisada y commit SHA exacto aprobado por Owner, nunca desde PR.
- Compila sin secretos; el job posterior de firma usa un entorno GitHub protegido: qore-android-owner-signing, con aprobación manual del Owner.
- Secretos privados a configurar en ese entorno: QORE_ANDROID_OWNER_KEYSTORE_B64, QORE_ANDROID_STORE_PASSWORD, QORE_ANDROID_KEY_PASSWORD, QORE_ANDROID_KEY_ALIAS. No enviarlos a este chat ni guardarlos en GitHub como código.
- La acción requiere installed_signer_sha256 y installed_version_code del APK ya instalado. El job compara paquete com.qore.mobile.qore_mobile, mismo certificado firmado y versionCode superior; no publica ningún resultado en caso contrario.
- El flujo no es utilizable aún sin revisión, política de firma, secretos y protección de entorno: no activar ni fusionar automáticamente.
- Auditoría offline con Android SDK Build Tools: python3 apps/mobile/tool/verify_apk_update.py installed.apk candidate.apk

## Aceptación pendiente
1. Verificar firma de la QORE Mobile instalada, versión y fuente del APK antes de descargar cualquier actualización.
2. Desplegar en QA/STAGING independiente, no en Railway producción, la bandeja CRT autenticada de PR #122; ejecutar un replay OFFLINE_REPLAY de 4 horas y comprobar UI y widget.
3. Certificar los 34 feeds IC Markets de cTrader DEMO, siete familias CRT y MSS M5/M15 causales independientes.
4. Implementar y comprobar entregas push FCM/APNs dentro de la misma app cuando el widget pueda estar suspendido, y probar recepción real en teléfono Owner.
5. Verificar que saldos, traders, informes VPS, biometría y widget original no pierdan funcionalidades.

**No existe aún confirmación de actualización in-place ni señal real recibida en Android Owner.**
