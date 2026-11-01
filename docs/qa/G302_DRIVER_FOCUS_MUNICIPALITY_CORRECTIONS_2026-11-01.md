# G302 — Rechazo QA Android: foco nítido y formulario sin municipio

**Origen:** prueba manual Android del usuario. Evidencia privada recibida solo en la conversación; no copiar placas ni datos reales a GitHub.

## 1. Alta de vehículo

- El usuario nunca ingresa un código de municipio en la app Driver.
- El cliente envía SOLO `requestKey, kind, service, plate, brand, model, year, passengerCapacity`. Se rechaza `municipalityCode` y cualquier campo de autoridad incluido en el cuerpo.
- El gateway G282 de STAGING recibe una jurisdicción de servicio **desde el proceso de Railway**, `QORE_G302_STAGING_MUNICIPALITY_CODE`, con valor aprobado y configurado por el operador. No se infiere desde GPS ni placas y no se usa `1`, `ASUNCION` u otro valor inventado.
- **Sin configuración confiable**, G282 responde 503 y no intenta un RPC a PostgreSQL. El registro sigue PENDIENTE/denegado. La compatibilidad con la función G282 SQL y su bloqueo de sesión G42 permanece intacta.
- La sucursal y el backend actual siguen funcionando con su contrato anterior hasta que se despliegue voluntariamente la integración G302; no activar los flags G287/G282 si cliente y backend no coinciden.
- Un municipio de operación no prueba por sí mismo permiso municipal de transporte.

## 2. Cámara inteligente

Requisito del usuario: *enfocar antes de tomar la foto; nunca aceptar una imagen borrosa*.

- La cámara usa autofocus **continuo** (`autoFocus="off"` según `FocusMode` de Expo SDK 57).
- Espera como mínimo 1,8 segundos tras `onCameraReady` para que el hardware empiece a ajustar enfoque; ese evento no garantiza un enfoque conseguido.
- Analiza imágenes temporales a **256 píxeles** de anchura, luz, movimiento, contorno y nitidez *en el interior* del documento, y no solamente en el marco exterior.
- Requiere 3 muestras separadas consecutivas para validar la autocaptura. Una muestra mala reinicia la secuencia.
- El botón manual **no puede aceptar la foto** si las métricas de calidad no son válidas; ofrece mensaje de rechazo y permite reintentar.
- Los archivos temporales se borran con esfuerzo máximo; nunca subir a Storage ni conservar datos personales.

**Límite:** Expo CameraView no suministra confirmación verificable de AF lock. El filtro de píxeles es conservador, pero no equivale a un evento de hardware `focus_locked`. No proclamar fotografía nítida garantizada sin prueba y calibración en teléfono físico.

## 3. Evidencia exigida

En dispositivo de laboratorio, comprobar:
1. Antes de terminar el enfoque, 0/3 muestras; no autocaptura.
2. Texto ficticio borroso dentro de un marco nítido: debe permanecer en 0/3 y mostrar «Sostené el teléfono y permití que enfoque».
3. Documento de papel con texto ficticio y luz homogénea: después de 3 muestras separadas y nítidas puede completar.
4. Captura manual borrosa: debe rechazarse, no finalizar.
5. Cambio de aplicación, denegación de cámara, retoma y ausencia de fotos en Galería.
6. Sin introducir municipio, la solicitud real solo puede registrarse después de STAGING autorizado, perfil Driver verificado, área de servicio configurada y bloqueo G42 en servidor.

El objetivo comercial, viajes reales, KYC y validación en tienda permanecen fuera de este PR.
