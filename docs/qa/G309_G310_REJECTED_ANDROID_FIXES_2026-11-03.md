# G309 / G310 — Corrección de las pruebas Android rechazadas

## Cliente (G309)
- **Origen:** en la pantalla AUTO/MOTO se solicita permiso de ubicación de primer plano al entrar. Android informa coordenadas y precisión; la app solo acepta lecturas no simuladas y precisión informada <=100 metros.
- **Dirección:** intenta geocodificación inversa de GPS; si no resuelve dirección mantiene etiqueta con coordenadas verificadas. Nunca promete una dirección postal exacta si GPS/Geocoder no puede saber piso, puerta o número.
- **Destino:** el GPS **no puede conocer la intención del usuario**; al escribir se consulta el geocodificador nativo (850 ms después de la última tecla), muestra resultados con coordenadas y requiere que el usuario seleccione uno.
- Sin permiso GPS o sin resultado verificable no se presenta falsa selección. No se autorizan reservas, pagos ni despacho.
- Los puntos solo viven en RAM. Al cambiar de cuenta, salir de la pantalla o ir a segundo plano se invalidan solicitudes pendientes. No se guardan rutas en URL ni en telemetría.
- El proveedor de geocodificación del sistema puede requerir servicios de Google/Apple, conectividad y variar por dispositivo; esta versión QA **no ofrece autocompletado comercial de precisión puerta a puerta**. La conexión a un proveedor oficial de lugares, mapa para ajustar pin y contrato backend de coordenadas es posterior.

## Driver (G310)
- **Se elimina el bucle de disparos periódicos:** el componente viejo llamaba a `CameraView.takePictureAsync` cada 1,2 segundos para medir la calidad y podía activar el obturador repetidamente aunque la imagen estuviera desenfocada. Esa mecánica queda reemplazada en la ruta de laboratorio.
- Se integra el escáner documental **Google ML Kit / Google Play Services**, mediante `@infinitered/react-native-mlkit-document-scanner@5.0.0`. La app lo abre solo mediante un botón; `scannerMode: FULL`, `pageLimit:1`, `galleryImportAllowed:false`, `resultFormats:JPEG`.
- El escáner nativo detecta contornos y decide cuándo autocapturar; cuando el usuario guarda, la app mide **píxeles reales interiores**, luz, contraste, reflejos y contorno y **rechaza las imágenes borrosas**. No inventa datos del acelerómetro ni afirma recibir `focus_locked` del hardware.
- Las páginas devueltas se borran con esfuerzo máximo tras inspeccionarlas. Nunca se suben, registran ni aprueban identidades.
- El selector de galería está deshabilitado. Si faltan Servicios de Google Play, sus modelos o el escáner no funciona, se muestra rechazo, **no se salta al viejo disparador**.
- iOS necesitará integración nativa VisionKit por separado; el escáner aquí es solamente Android.
- **El flujo real de registro KYC privado sigue OFF.** El proveedor anterior `driver-evidence-camera` requiere una sustitución revisada y un backend con escaneo seguro/Storage RLS, no se habilita por una prueba local.
- Conservar el reporte de fallos físicos: auto-captura antes de enfocar, foto nítida, bordes nítidos con texto borroso, caché, permisos, app en segundo plano y Servicios de Google Play.

## Gobernanza
Ambos cambios se mantienen DRAFT; sin merge, LIVE, pagos, operación comercial ni KYC de personas reales. Certificación definitiva solo después de APK nativa compilada y comprobación manual en Android.