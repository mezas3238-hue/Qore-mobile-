# Arquitecto B R79 — Cliente MOTO unido al contrato HTTP G101 de A

**25-oct-2026, PR #8 DRAFT.**

A publicó cinco rutas G101 MOTO_RIDE en OpenAPI 1.0.0-g101:
- POST /v1/staging/rider/moto/quotes
- POST /v1/staging/rider/moto/book
- GET /v1/staging/rider/moto/bookings/{bookingKey}
- POST /v1/staging/rider/moto/bookings/{bookingKey}/cancel
- GET /v1/staging/rider/moto/bookings/{bookingKey}/cancellation

B implementó `g101-moto-passenger-http-gateway.mjs`: transporte
HTTPS de origen fijado, JWT Passenger de sesión actual y revisión
privada, no redirección, GET sin body, confirmación humana explícita
para reservar/cancelar, respuestas de longitud limitada, control de
timeouts y relectura de identidad antes y después de consumir cuerpo.
No hay JWT, GPS, PII o tarjeta en estado público.

El transporte se conecta realmente a `createClientExperience`,
`createG100MotoPassengerFlow`, y la pantalla `app/moto.tsx` (R78).
G100 sigue siendo fuente de verdad de montos: 12 % nominal, 10 %
subsidio al pasajero y 2 % plataforma. El pasajero no declara precios
ni elige motorista. Un POST incierto => **solo GET de recuperación**;
nunca se genera un segundo POST sin saber qué ocurrió.

`ClientRuntime.tsx` usa los mismos origin/pin HTTPS que el QA AUTO
pero tiene siete **gates MOTO independientes**, todos false por
defecto en `.env.example`: Owner, G101 externo, Runtime
externo con PG persistente, MOTO legal, rutas reales, RLS y
idempotencia ante pérdida del ACK. G101 de A todavía dice
`x-qore-runtime-wired:false`,
`x-qore-loopback-wired:true`,
`x-qore-external-staging-certified:false`:
**ningún flag se puede activar honestamente todavía**.

Pruebas de las cinco rutas, cuerpo/método exacto, 401/403,
redirección, MIME, tamaño, scope, sesión, cambio de cuenta,
cancellation sin duplicación, composición Cliente.

**Falta para MOTO instalable:** A montar gateway real STAGING
HTTPS respaldado por PostgreSQL persistente, validar cobertura
MOTO, permiso legal para pasajeros, casco/seguro/KYC motorista y
asignación Driver; Owner autorizar infraestructura y pruebas
en 2 móviles + Admin. Sin esa evidencia no es seguro activar flags.

NO MERGE / NO LIVE / sin recursos pagos / NO_GO.
