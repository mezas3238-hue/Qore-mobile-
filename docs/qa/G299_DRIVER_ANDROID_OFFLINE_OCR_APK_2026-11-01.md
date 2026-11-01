# G299 — Android APK offline para cámara/OCR Driver, LAB

## Alcance

El workflow `.github/workflows/qore-g299-driver-ocr-qa-apk.yml` genera un APK Android independiente del proyecto Driver comercial:

- nombre visible: **Movete Driver OCR QA**;
- package Android: `com.movetefacil.driver.ocrqa`;
- modo de laboratorio `EXPO_PUBLIC_QORE_G299_OFFLINE_OCR_QA_APPROVED=true`;
- `EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED=false`, STAGING runtime false y ambos flags ordinarios G290/G291 false;
- **sin** URLs, API origin, host, publishable key o servicio de Supabase configurado;
- ninguna subida de imágenes, ningún flujo KYC ni funcionalidad comercial activa;
- compilación `assembleRelease` con la firma de prueba que proporcione el entorno. **No es una firma de producción**.

Los artefactos de GitHub Actions son archivos de prueba temporales. No deben distribuirse como versión pública ni instalarse junto a un dispositivo con trabajo real sin control QA.

## Pasos desde un teléfono Android

1. Abrir [GitHub Actions del repositorio](https://github.com/mezas3238-hue/Qore-mobile-/actions) y seleccionar la ejecución exitosa **QORE G299 Driver OCR offline QA APK** del PR asociado.
2. En **Artifacts**, descargar `QORE-G299-Driver-OCR-QA-Android-offline` (ZIP). Extraer `app-release.apk` y verificar que provenga de la ejecución esperada.
3. Instalar únicamente en el dispositivo propio de pruebas mediante las opciones Android de instalación desde la aplicación usada para abrir el archivo. Mantener Play Protect activo.
4. Abrir **Movete Driver OCR QA**, tocar **Documentación y vehículo**, **Probar OCR de matrículas (local)**. Otorgar permiso de cámara.
5. Usar **solo tarjetas de papel impresas con una matrícula inventada**, sin documentos reales, matrículas reales, selfies ni datos privados.
6. Realizar dos lecturas para **cédula verde (prueba)** y dos para **chapa fotografiada (prueba)**. Comparar igualdad, discrepancias, errores y permisos denegados.
7. Volver, entrar en **Cámara inteligente de prueba**, encuadrar una tarjeta rectangular ficticia con buen contraste y comprobar autocaptura/retoma/negación de permisos.
8. Poner la aplicación en segundo plano durante un reconocimiento para comprobar que las muestras locales se descartan al volver. Comprobar que las fotos efímeras no aparecen en Galería. **La limpieza absoluta de caché requiere auditoría Android adicional**.

## Evidencia de certificación pendiente

Guardar sin información personal: marca/modelo del Android, versión OS, fecha, pantalla, comportamiento OCR y si la app se cierra. No copiar texto reconocido ni fotografías a incidencias públicas.

La ejecución automatizada verifica **compilación**, no prueba en hardware. Ninguna prueba de laboratorio autoriza el uso de datos personales reales, vigencia de documentos, vehículos, despachos o pagos.

## Expediente documental

G299 agrega vista read-only del conjunto de 8 documentos al estado privado del conductor previamente validado por G17: licencia, CI frente/dorso, cédula verde, habilitación, seguro, inspección y selfie. No permite que el Driver apruebe estos estados, no transmite nuevos documentos y **8/8 aprobados en texto no bastan para habilitación comercial**.

El próximo bloqueo real es habilitar en backend, bajo auditoría independiente, un escáner auténtico de evidencias con verificación de bytes/versiones (G19), autorización de sesiones de Storage y revisión de Admin antes de conectar la subida con imágenes legales. Mantener uploads OFF.

## G301 — pantalla inicial dedicada de pruebas

La APK compilada en la rama G301 inicia directamente en **Movete Driver OCR QA**. Sus botones llevan a cámara inteligente y OCR nativo; no se requiere iniciar sesión. El checklist de seis observaciones es local, efímero, sin imágenes ni identificadores, no produce una certificación y no es enviado al servidor. Los datos desaparecen al cerrar el proceso; no utilizar capturas de pantallas con datos reales para reportar errores.
