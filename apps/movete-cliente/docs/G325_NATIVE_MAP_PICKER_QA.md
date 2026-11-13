# G325 — Mapa nativo integrado Cliente (candidate, QA OFF until provider configured)

Scope: `apps/movete-cliente/**`. Sobre G324; no modifica Driver, pagos ni STAGING.

- Android: `react-native-maps` 1.27.2, mapa Google Maps con API **Android SDK**. El mapa nativo se muestra solo si el build fue aprobado explícitamente y tiene clave SDK Android con formato correcto.
- iOS: Apple Maps nativo, sujeto a compilación y prueba iOS reales.
- El origen actual sigue obtenido por `getPassengerCurrentPickup()` una vez al entrar. Pulsar el campo de recogida abre el mapa centrado en GPS; el pasajero puede buscar otro punto o tocar el mapa para ajustar.
- Pulsar destino abre el buscador dentro de la vista del mapa. Búsqueda solo al tocar botón; selecciona dirección validada y pin; confirmación explícita devuelve coordenadas y etiqueta solo a RAM del formulario.
- La posición de origen/destino no se guarda en storage, no entra en analytics o URL y no se comparte con mapas externos mediante estos botones. No activar seguimientos en segundo plano.
- El toque en el mapa hace **una** geocodificación inversa, con timeout, bloqueo de consultas concurrentes y validación de Paraguay. El mapa no se actualiza por cada tecla.
- La pantalla original G324 se conserva cuando el mapa Android está inhabilitado (fallback confiable, sin crash ni pantalla vacía). La cámara Driver sigue congelada.

## Configuración bloqueante Android

1. En Google Cloud, activar **Maps SDK for Android** y facturación si corresponde.
2. Restringir una clave Android a **package name real de la APK QA** y el fingerprint **SHA-1 de su firma QA**. No usar el package de producción por error.
3. Inyectar `QORE_ANDROID_MAPS_API_KEY` exclusivamente en el entorno de compilación seguro; activar `QORE_NATIVE_MAPS_APPROVED=true` solo tras verificación de restricciones. No añadir clave a Git, chats, logs o variables `EXPO_PUBLIC_*`.
4. Construir una nueva APK, probar en dispositivo Android con Maps activo y sin Maps, permiso ON/OFF, mapa abierto/cerrado, selección de pin, exactitud en Paraguay y cambios de primer plano, sin ANR.
5. Solo tras PASS físico considerar habilitarlo para el flujo de certificación G318. Sin dinero real, sin deploy STAGING y sin afirmar E2E.

Estado al integrar: **código candidato / key no confirmada / prueba física pendiente**. El mapa nativo no puede certificarse con CI verde sin clave restringida y ensayo hardware.
