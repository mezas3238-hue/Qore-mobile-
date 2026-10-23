# B-07 — Base de accesibilidad Cliente preparada para integración real

Fecha: 23-10-2026  
Alcance B: `apps/movete-cliente/**` y documentación `docs/architect-b/**`  
Estado: implementación y QA automatizada completas; certificación manual Android/iOS pendiente.

## Resultado

La interfaz Cliente dejó de depender de estilos pequeños o estados visuales implícitos. La base compartida ahora expone al sistema operativo el rol, la etiqueta y los estados `disabled`, `selected` y `busy` de cada acción. Los objetivos táctiles y campos tienen al menos 48 px de alto; el texto auxiliar subió de 12 a 14 px y no se desactiva el escalado de fuente.

Los botones primarios, secundarios y deshabilitados cumplen contraste WCAG AA automatizado:

- primario: 5,39:1;
- secundario: 4,72:1;
- deshabilitado: 7,21:1.

## Cambios visibles y de interacción

- Encabezados de todas las pantallas expuestos con rol semántico.
- Campos de viaje, envío y soporte con etiqueta para lector de pantalla.
- Opciones de servicio, vehículo, categoría y restricción con estado seleccionado accesible, no solo color.
- Alertas dinámicas anunciadas de forma asertiva; estados de sincronización, de forma cortés.
- Confirmación de cancelación con foco enviado al título y superficie modal para tecnología asistiva.
- Botones en progreso bloqueados y anunciados como ocupados; acciones deshabilitadas conservan descripción del motivo cuando aplica.
- Filas flexibles y botones de vehículo con ancho mínimo para tolerar fuentes grandes.
- `ScrollView`/`FlatList` ajustan automáticamente el contenido a áreas seguras; formularios mantienen taps y permiten cerrar el teclado al arrastrar.
- Se retiraron de navegación y pantallas las etiquetas “demo” o “pagos simulados”. Pagos se presenta como integración financiera real pendiente de PSP, tokenización, recibo y conciliación certificados; no se aceptan datos financieros mientras el gate permanezca cerrado.

## Verificación reproducible

Desde `apps/movete-cliente`:

```bash
npm run check
npx expo export --platform web --output-dir dist
```

Resultado local del corte:

- TypeScript: SUCCESS.
- Pruebas Cliente: **220/220 PASS**, 0 FAIL.
- Expo export web: SUCCESS.
- `git diff --check`: SUCCESS.

Las nuevas pruebas recorren estáticamente todas las pantallas para impedir regresiones de escalado de fuente, etiquetas de `TextInput`, encabezados, teclado y áreas seguras, además de verificar contraste, tamaño mínimo y semántica del componente de acción compartido.

## Límite honesto de certificación

Este bloque prepara la aplicación real, pero una exportación web y pruebas de código no certifican TalkBack, VoiceOver, teclado físico, orientación, gestos ni zoom en un dispositivo. Antes de publicar se debe ejecutar una matriz manual en Android físico/emulador y, cuando aplique, iOS: navegación lineal, anuncios de alertas, foco de confirmación, fuente máxima, teclado, rotación y contraste en pantalla real. No se habilitó ningún backend, pago, GPS, despacho, merge ni despliegue.

## Continuidad

La siguiente tarea independiente es B-08: endurecer el flujo de soporte para que el borrador se limpie en rotación/cierre de sesión, nunca se confunda con 911/SOS y solo pueda declararse enviado al recibir un comprobante tipado y autorizado del backend.
