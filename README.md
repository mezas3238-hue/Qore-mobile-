# ViajeYa — QORE Mobile

Aplicación **Android / iOS / web** de transporte bajo demanda, construida con **Expo SDK 57, React Native, Expo Router y TypeScript**. Esta entrega es un **prototipo de demostración, NO una plataforma de transporte operativa**.

> Proyecto independiente de QORE CORE (trading). No copiar credenciales ni esquemas de trading a este módulo.

## Estado verificado

- ✅ Repo preparado con Expo / React Native y rutas móviles.
- ✅ Flujo demostrativo pasajero → viaje → conductor → llegada → inicio → fin → calificación / historial.
- ✅ Reglas de estado del viaje, prohibición de dos solicitudes activas simultáneas, tarifa ilustrativa y pruebas unitarias.
- ✅ Panel administrativo **simulado**, con estadísticas locales.
- ✅ Datos ficticios, sin geolocalización ni pagos; todos los valores DEMO claramente señalados.
- ⛔ **No existe conexión del repositorio a Supabase ni viajes reales.**
- ⛔ No hay verificación real de conductores ni privilegios de administrador: los botones de demo **no confieren permisos**.

## Desarrollo

Requiere Node.js 22.13+ y npm.

```sh
npm install
npm run start
npm run android # Expo Go / emulador configurado
npm run web     # Navegador
npm run check   # TypeScript + tests
```

Expo Go puede requerir autenticación en Expo. Para APK/AAB o publicación necesitarás preparar `eas.json`, EAS credentials y firmar builds por tu cuenta. No se despliega a producción por este PR.

## Arquitectura

- `app/`: pantallas (Expo Router): `/`, `/demo`, `/conductor`, `/admin`, `/historial`, `/acerca`.
- `src/domain/rides.ts`: tipos, tarifas **DEMO**, cotización y máquina de estados pura.
- `src/domain/rides.test.ts`: cobertura de transiciones inválidas, duplicados, cancelación y valoración.
- `src/context/RideContext.tsx`: estado **volátil** compartido en el mismo dispositivo; recargar borra los datos.
- `src/services/production-api.ts`: **bloqueo explícito** de peticiones reales, fail-closed.
- `.env.example`: nombres de valores públicos FUTUROS. Nunca subir service role keys, tokens privados ni secretos.

## Backend Lovable — relación con el trabajo previo

Hay un proyecto independiente en Lovable con un backend Supabase preparado que incluye tablas como `rides`, `profiles`, `driver_applications`, `user_roles`, `vehicles`, `ride_events`, `fare_configs`, y funciones RPC de asignación/transición. **No lo hemos conectado** a este repositorio: falta comprobar permisos de integración, URLs públicas, política RLS, firmas RPC y tests de seguridad de extremo a extremo. No publicar claves extraídas de un servicio de terceros. El prototipo no promete que ese backend esté disponible desde móviles.

## Puertas obligatorias antes de lanzar viajes reales

1. Autenticación (pasajero/conductor/admin) y autorización verificada por el servidor; RLS/RPC auditadas, límites de frecuencia y antifraude.
2. Identificación, licencia profesional y habilitaciones municipales aplicables, vehículo, antecedentes y seguros; revisión legal local actualizada.
3. Mapa real, permisos explícitos de GPS, geocodificación, rutas de calles, costes API, consentimiento y minimización de datos.
4. Asignación atómica de conductor, bloqueo de doble reserva, manejo de desconexión, cancelación y reembolsos.
5. Política de precios, registro de pagos y conciliación, soporte de emergencias, privacidad y eliminación de datos.
6. Pruebas de carga, seguridad, dispositivos, accesibilidad, publicación Android/iOS y monitoreo.

**Importante:** Las tarifas en `DEMO_FARES` son ficticias, no reflejan tarifas oficiales ni vinculantes. No se realizan cargos ni transporte real. El dibujo del mapa es esquemático, sin navegación y no utiliza GPS. El panel admin es una visualización local: no permite aprobar conductores reales.

## Criterios mínimos de aceptación de la demo

1. Abrir `/demo` y seleccionar origen / destino diferentes.
2. Cambiar Económico, Confort o XL y observar que se recalcula el precio ficticio.
3. Solicitar viaje → ver estado `searching`.
4. Abrir `/conductor`, habilitar disponibilidad, aceptar → llegar → iniciar → finalizar.
5. Volver a `/demo`, calificar → abrir `/historial` y ver recibo ficticio.
6. Probar solicitud duplicada: se rechaza hasta completar/cancelar la anterior.
7. `/admin` permite ver únicamente estadísticas ficticias de esta sesión; reiniciar borra los datos.

## Licencia y propiedad

Código elaborado para QORE Mobile; conservar licencias de dependencias. No utilizar identidad comercial, logotipos ni recursos protegidos de Bolt o Uber.

## Fase 2 — Registro y navegación (octubre 2026)

Se incorporaron flujos para **registro real de pasajeros**, inicio/cierre de sesión, solicitud de alta de **conductores y su vehículo** (chapa, marca, modelo, color, año, categoría, licencia y fotografía), consulta del estado de aprobación, y panel de revisión administrativo **protegido por rol del servidor**.

También se incorporó `Google Maps` y `Waze` mediante enlaces oficiales para navegación real al destino seleccionado. GPS opcional **solo en primer plano y tras consentimiento**. Con clave de Google Maps SDK restringida, `expo-maps` muestra el mapa nativo de Google en Android (requiere **development build**, no Expo Go); iOS usa Apple Maps para el mapa interno. **Waze abre su propia aplicación o sitio: NO es un SDK de mapa embebido**. Si falta clave o se usa Expo Go/Web, la navegación externa continúa disponible pero el mapa interno es esquemático y está rotulado DEMO.

**Requisitos para habilitar persistencia de registros:**

1. Configurar `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` de un backend Supabase autorizado y auditado. **No se incluyen credenciales en GitHub**. La base de datos existente del proyecto ViajeYa en Lovable tiene tablas `profiles`, `driver_applications`, `vehicles`, `user_roles`, RPC `submit_driver_application` y bucket privado `driver-docs`. Las cuentas se crean como pasajeros; solo administrador puede aprobar conductor mediante `admin_review_driver`.
2. En Google Cloud habilitar Maps SDK for Android, generar clave restringida a `com.qore.viajeya` y firma SHA-1, añadir variable privada de construcción `GOOGLE_MAPS_ANDROID_API_KEY` al entorno EAS; compilación de desarrollo nueva. No poner clave ilimitada ni usar claves de servidor.
3. Configurar verificaciones de correo, recuperación de contraseñas, políticas de privacidad/condiciones definitivas, proceso de eliminación de datos, límites de peticiones, seguridad RLS, auditoría de documentos y autorizaciones locales **antes de aceptar usuarios públicos**.
4. Revisar que el correo, la licencia y el vehículo se verifican por la autoridad competente; seleccionar una foto no prueba autenticidad. La pantalla administrativa requiere una revisión humana explícita.
5. **Los viajes continúan DEMO** y `LIVE_TRIPS_ENABLED` sigue en `false`. GPS obtenido para navegación no se envía a bases de datos ni se comparte con conductores.

Comprobaciones locales puras: `npm test`. Se necesita CI remoto para validar instalabilidad completa y Expo export con dependencias actualizadas.
