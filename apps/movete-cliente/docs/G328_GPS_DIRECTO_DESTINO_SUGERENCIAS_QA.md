# G328 — Origen GPS directo + destinos sugeridos al escribir (Cliente)

**Problema físico reportado por Owner 13-nov-2026:** capturas Android Cliente G327: tocar «¿Dónde te buscamos?» enviaba a Google Maps y «¿A dónde vas?» enviaba a Maps o exigía presionar Buscar; el usuario rechazó esa experiencia porque no reproduce el video de referencia. Modo de referencia: **GPS detecta recogida al tocar el campo y la app muestra opciones al escribir destino**.

**Solución exacta aplicada en `app/transporte.tsx`:**
- **Recogida:** se mantiene el GPS foreground one-shot G319 al entrar; pulsar el campo vuelve a utilizar ubicación reciente (menos de 30 segundos) o consulta una única vez, sujeta al cooldown G319. Muestra dirección geocodificada + coordenadas del fix + precisión comunicada por Android. El botón opcional de Google Maps solo comprueba un punto, no suplanta el GPS ni devuelve datos automáticamente. Confirmación expresa antes de viaje.
- **Destino:** `TextInput` principal recibe texto en Movete Fácil; a partir de cuatro caracteres, si el campo está enfocado, programa una búsqueda después de 850 ms sin teclear (más espera si se consultó hace menos de 3200 ms). Android `expo-location` Geocoder resuelve y revierte las opciones a direcciones de Paraguay; resultados debajo del campo, seleccionables y confirmables. Se cancela el temporizador al modificar texto o salir; un solo geocoder activo, respuestas viejas descartadas por epoch; no se repite consulta con texto idéntico. Búsqueda manual y Google Maps quedan solo como alternativas.
- **Sin Google Maps API key**, puesto que usa Geocoder del dispositivo. Atención: no equivale al catálogo/autocomplete de Google Places; la cantidad y calidad de sugerencias dependen de los servicios de geocodificación disponibles en Android.
- No GPS segundo plano, no geocodificación por cada tecla, no almacenamiento GPS durable, no habilitación de pagos ni reservas LIVE. Cámaras Driver intactas.

## QA de aceptación
1. Con GPS autorizado, tocar «¿Dónde te buscamos?» debe mostrar coordenadas y precisión dentro de Cliente; no abandonar la app ni abrir Google Maps.
2. Con el destino enfocado, escribir «Terminal de Ómnibus» o una calle reconocible en Paraguay, detenerse brevemente: aparecen sugerencias sin tocar Buscar. Si Geocoder no devuelve resultados, debe mostrar error explícito y reintento/fallback, nunca ubicación inventada.
3. Tocar sugerencia → mostrar dirección validada → confirmar destino; cambiar texto invalida resultado y confirmación previos.
4. Doble toque rápido y mover app a fondo no deben disparar bucles; permiso GPS denegado, búsquedas mientras GPS ocupado, precisión mala, destino fuera PY y resultados falsos son fail-closed.
5. Compilar APK QA con identificador distinto de G319 y G327, conservar ambos para reversión; no declarar PASS físico ni 5/5 E2E hasta prueba del Owner.

**Owner no debe ser obligado a pasar por Google Maps ni compartir enlace para pedir el transporte.**
