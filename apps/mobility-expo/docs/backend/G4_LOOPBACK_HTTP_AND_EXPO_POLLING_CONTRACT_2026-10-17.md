# QORE Radar G4 — HTTP real por loopback y puente Expo de lectura

**Fecha:** 2026-10-17 · **PR #7 (DRAFT)** · ***NO LIVE***. Estos archivos contienen código ejecutado bajo CI y pruebas, **no** un servicio de movilidad desplegado ni comunicación entre teléfonos reales.

## Aporte de esta ronda

Hasta hoy los contratos `g4-offer-gateway` y `g4-rider-status-gateway` se probaban por llamadas directas JavaScript y PostgreSQL 16 sintético, pero no se había probado que dos conductores y un pasajero pudieran intercambiar las mismas operaciones **por HTTP** con limitación de cuerpo y headers.

Se incorporó `server/g4-loopback-http-transport.mjs`: crea un servidor Node **sin arrancarlo automáticamente** y una función `listenQoreRadarLoopback` que lo expone únicamente en `127.0.0.1` para QA. Endpoints:
- `GET /v1/staging/rider/trips/:id/status`: consulta **solo lectura** de pasajero con validación de JWT/rol hecha por el gateway inyectado.
- `GET /v1/staging/driver/offers/:id`: consulta privada de oferta para el destinatario confirmado.
- `POST /v1/staging/driver/offers/accept` y `/decline`: decisiones contra adaptadores, identidad derivada exclusivamente de JWT verificado en los gateways.

No hay endpoint de creación de viajes, pagos, posición GPS, alta de usuarios ni despachos comerciales. Esta implementación no acepta cookies/orígenes web, querystrings, rutas codificadas, cuerpos GET, ni JSON POST mayor de 2 KiB; devuelve `Cache-Control: private, no-store`, `nosniff`, CSP restrictiva y errores sin trazas o credenciales. Define timeouts de headers/requests. **Este bucle no es API pública, no tiene TLS ni cuotas distribuidas, y no debe usarse para teléfono remoto ni producción.**

`server/g4-loopback-http-transport.test.mjs` realiza HTTP real a `127.0.0.1` usando **identidades y JWT de mentira en adaptadores mock**, sin llamadas a Supabase, Push ni Google. Comprueba:
1. Pasajero recibe búsqueda sin conductor.
2. Notificación push simulada acepta *ticket para procesamiento*, pero la pantalla pasajero sigue sin conductor.
3. Conductores distintos consultan únicamente su oferta.
4. Dos clientes POST compiten concurrentemente; queda **un solo ganador** en el adaptador sintético.
5. El pasajero obtiene la placa, perfil y ETA por ruta *inyectados en el fixture*, solo tras confirmación; otro usuario no ve la ficha.
6. GPS/ruta viejos y estado final retiran posición y ETA, aun si antes existían.
7. GET/POST inválidos, cookies, orígenes web, ID falsificado, tokens malos y cuerpos extensos no invocan operaciones válidas.

**Diferencia metodológica:** La prueba HTTP valida red y serialización de las funciones del gateway, **no** una aceptación de carrera transaccional verdadera; esa propiedad se certifica por separado en `scripts/sql/g4_concurrent_offer_accept_ci.sh` usando dos conexiones reales a PostgreSQL 16 efímero. Ambas pruebas son sintéticas y complementarias, ninguna prueba teléfonos físicos.

## Puente para la app React Native

`src/domain/qore-radar-polling.ts` ofrece `pollQoreRadar` para consultar el endpoint HTTPS de staging con JWT proporcionado por Auth, `cache:no-store`, sin cookies ni almacenamiento de credenciales. Exige entorno `STAGING_DEMO_ONLY`, respuesta `commercialRidesEnabled=false`, identidad del pasajero y viaje coherentes y eventos versionados. En sesión ausente o revocada **borra la ficha**. En error de red/HTTP o dato corrupto **retira posición y ETA** y muestra falta de conexión, sin fabricar minutos. Soporta loopback HTTP **solo en modo QA explícito** y se prohíbe ref del Supabase antiguo. Usa AbortController compatible con React Native/Hermes.

`src/domain/qore-radar-polling.test.ts` valida headers, control de sesión, origen privado/HTTPS, fallo de red, datos extraños, replay, aceptación, privacidad y confianza de ETA. **El puente aún no está montado en una pantalla Expo con Supabase Auth real**; integrar únicamente cuando se disponga del backend seguro correcto.

**G4 sigue exclusivo AUTO**: los snapshots del servidor y la selección visual del pasajero rechazan incluso perfiles falsificados `MOTO`; no se habilita transporte comercial de motos sin la investigación legal/seguros pertinente. Hay regresiones en las pruebas correspondientes.

## Para reproducir en repositorio

```bash
cd apps/mobility-expo
npm install --no-audit --no-fund
node --test server/g4-loopback-http-transport.test.mjs
node --experimental-strip-types --test src/domain/qore-radar-polling.test.ts
npm run check
node --test server/*.test.mjs
```

El workflow de GitHub también ejecuta PostgreSQL G1/G2/G3/G4 y pruebas de concurrencia; citar **solo** la última ejecución exitosa del HEAD al comunicar resultados.

## Próximos gates para conectar 3 celulares

1. **Bloqueador P0 de Auth nativo**: Lovable Supabase STAGING nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944`, activar y verificar `disable_signup=true`, ref nueva y clave pública no secreta; no usar Supabase antiguo `qdqrlgzlotnfdxzpacxs`.
2. Provisionar pasajero y dos conductores **ficticios**, roles confirmados, JWT reales, aislamiento entre cuentas/Storage y revocación de sesiones.
3. Revisar e instalar G3/G4 exclusivamente en nuevo STAGING tras gate, con revisión de roles RLS, integridad de ofertas y idempotencia. Hasta ahora **G3/G4 no están en la base remota**; no publicar el transporte HTTP localhost.
4. Proveer API HTTPS real con WAF, antiabuso, rate limits distribuidos, telemetría restringida, secrets exclusivamente servidor y recuperación ante fallos.
5. Integrar Auth SDK en Expo, token por conductor, FCM/APNs y Expo Push con receipts. El pasajero confirma aceptación leyendo el servidor, nunca desde push.
6. GPS de conductor real, consentimiento foreground/background, anti-spoof, Google Routes con clave restringida, cuotas y recalibración de ETA según calles y tráfico. Canal Realtime privado con RLS y snapshot de reconexión.
7. QA de 3 teléfonos físicos incluyendo sin señal, app cerrada, ofertas expiradas, competidores, falsificación y conducción segura. Cumplir normativa local, seguros y pagos antes de transporte remunerado AUTO; MOTO bloqueada por separado.

**Aislamiento:** `LIVE_TRIPS_ENABLED=false`, Lovable real staging G1/G2 intacto, PR #7 DRAFT, Flutter trading PR #2 intacto y cero exposición pública del HTTP de QA.
