# G326 — Google Maps del propio teléfono como proveedor visual (sin API key)

**Decisión Owner:** no incrustar Google Maps mediante SDK en Cliente. Usar la aplicación Google Maps instalada mediante enlaces universales oficiales `https://www.google.com/maps/...` con `api=1`. **`api=1` no es una API key.**

- **Origen:** GPS foreground one-shot G319 sigue al entrar a transporte. Tocar «¿Dónde te buscamos?» abre Google Maps con pin de coordenadas obtenidas. Si GPS no está disponible, abre Maps sin punto inventado. Al regresar, el origen requiere confirmación expresa. Origen alternativo: botón Editar, búsqueda Android geocodificada y selección real.
- **Destino:** tocar «¿A dónde vas?» abre Google Maps (centrado en GPS conocido) para que el pasajero busque por su cuenta. Google Maps **no entrega coordenadas del sitio seleccionado como resultado de abrir un Maps URL**. Por eso se muestra un campo explícito en Movete Fácil: el pasajero escribe la dirección escogida, pulsa Buscar y confirma un resultado geocodificado real. Nunca se finge recepción automática.
- Se conservan serialización, cooldown y ausencia de bucles GPS de G319. Los enlaces son solo por interacción del pasajero. Google Maps accede a coordenadas GPS solo al abrirlo con el consentimiento del usuario.
- Google Maps para Android, si está instalado y activo, normalmente abre la app; de no estar disponible puede abrir navegador. No se almacena ruta o coordenadas en disco por el selector.
- **Retirar G325**: sin `react-native-maps`, sin Maps SDK Android, sin requisitos de Google Cloud API key, SHA-1 ni secretos Github destinados al SDK. No modificar Driver, pagos, Soporte ni STAGING.

**Bloqueos de certificación:** nueva APK G326 compilada, descarga/instalación Android, prueba de apertura Maps/origen/destino/regreso, geocodificación Paraguay y ausencia de ANR, aprobación Owner. Flujo sin retorno automático Google Maps→Cliente; para integración automática futura se requeriría mecanismo de compartir destino o otro componente cartográfico, con contratos/seguridad propios.

**NO MERGE, NO DEPLOY, NO LIVE.** 0/5 E2E comerciales externos aún.
