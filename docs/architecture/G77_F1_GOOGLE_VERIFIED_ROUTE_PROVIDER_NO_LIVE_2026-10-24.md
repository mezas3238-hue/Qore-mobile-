# QORE Mobile — G77 F1: ruta real con evidencia del proveedor (NO GO)

**Fecha:** 2026-10-24 · **Owner:** autorización de facturación NO concedida en este corte · **Arquitecto:** A · **Estado:** módulo servidor QA, no desplegado.

## Cierre técnico

`apps/mobility-expo/server/g77-google-f1-verified-route.mjs` implementa `createG77GoogleF1VerifiedRoute`, un adaptador **solo Node/backend** que produce los diez atributos exactos consumidos por `G73 resolveVerifiedRoute`. El constructor requiere conjuntamente `enabled:true` y `billingApproved:true`; ambos OFF por defecto. En ausencia de credenciales de servidor, secret HMAC separado, servicio `authorizeCoverage` y servicio `verifyTolls`, lanza error **antes de ejecutar cualquier consulta**.

1. Entrada Passenger: `{actorId,origin,destination,service}`; jamás acepta distancia, tarifa, coordenadas, zoneTag ni Place IDs del móvil como autoridad.
2. Dos consultas Google Geocoding v4 bajo `geocode.googleapis.com` usando llave solo en cabecera `X-Goog-Api-Key`. Respuestas deben ser inequívocas, `postalAddress.regionCode='PY'`, geografía compatible con Paraguay, localización precisa `ROOFTOP`/`RANGE_INTERPOLATED`; de lo contrario 409 por G73.
3. Ruta Google Routes v2 `directions/v2:computeRoutes` con `DRIVE`, `TRAFFIC_AWARE`, sin alternativas ni `fallbackInfo`, distancia en metros y tiempo recibido del proveedor, nunca números locales estimados.
4. Cobertura independiente: `authorizeCoverage` debe verificar ambas geocodificaciones, el servicio vigente, geocerca autorizada, la versión y `country='PY'`. **Cobertura no equivale a disponibilidad del Driver**.
5. Peajes independientes: `verifyTolls` debe devolver evidencia para la misma ruta, Place IDs y zoneTag, incluso cuando confirme que `tollsPyg=0`. Google no garantiza tarifas de peaje paraguayas para todos los tramos: un valor ausente no se convierte en cero.
6. HMAC-SHA256 privado transforma los Place IDs verificados en tags pseudónimos `LOC_`+32 letras A–P, compatibles con SQL G73. El DTO no expone API key, Place IDs, direcciones ni coordenadas. Persistencia y tarifa siguen gobernadas por SQL G73/G72.

## Integración deliberadamente NO habilitada

El G4 runtime A ya acepta `verifiedAutoRoute` inyectado. Cuando **existan** certificados, contrato de cobertura de BD versionado y aprobación de gastos por Owner, el backend podrá inyectar la función retornada por `createG77GoogleF1VerifiedRoute` en `prepareQoreG4StagingRuntime({verifiedAutoRoute})`, usando llaves por ambiente desde secret manager, jamás desde Expo/Cliente/Admin/GitHub. No configurar `billingApproved:true` por CI ni pruebas sintéticas; solo con autorización financiera expresa del Owner. No se ha llamado a Google desde este trabajo, no hay costos provocados ni STAGING público certificado.

**Documentación de API:** Geocoding v4 `https://developers.google.com/maps/documentation/geocoding/geocoding` y Routes v2 `https://developers.google.com/maps/documentation/routes/compute_route_directions`. Ambas pueden generar costes por solicitud. El Owner deberá aprobar proveedor y presupuesto/límites antes de llamadas reales.

## Certificación restante

- Autoridad de cobertura geográfica y zonificación con polígonos autorizados, control de vigencia y sin fallback.
- Origen de peajes PYG con evidencia por tramo y vigencia comercial. Tarifas/reglas G7 actualizadas por región y tipo.
- Configuración de Google Cloud Maps Platform, scopes mínimos, restricciones de claves, presupuestos/alertas y revisión contractual/privacidad; **sin gastos todavía**.
- Montaje de HTTPS con IdP/AAL2/PG compartido, prueba de **mismo tripId** Cliente G73 → Driver aceptación G65 con documentos vigentes → Cliente GET G4 → Admin GET G75, prueba adversarial de RLS, cancelación, terminal y dos conductores.
- Pruebas Android/iOS físicas; protección de PII, retención, atención y operación, y aprobación Owner GO/NO_GO separada.

No MERGE / LIVE / DEPLOY / PSP / PII REAL. Todo este corte permanece QA y DRAFT.
