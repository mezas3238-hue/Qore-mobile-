# QORE Mobile / Movete Fácil — G77 proveedor ÚNICO de rutas AUTO

**Corte:** 24–25 octubre de 2026 · **Responsable:** Arquitecto A · **Estado:** QA, sin despliegue, sin llamadas pagas ni autorización LIVE.

## Decisión de convergencia A/B

**Único código operativo:** `apps/mobility-expo/server/g77-f1-google-verified-route-resolver.mjs`, exporta `createG77VerifiedAutoRouteResolver`. La anterior variante geocode-first (`g77-google-f1-verified-route.mjs`) y su test se retiraron de la rama A: consultaba Geocoding y Routes antes de comprobar la elegibilidad zonal, con riesgo de facturación indebida. Las pruebas de cadena `g77-f1-provider-to-g73-chain.test.mjs` fueron migradas al único proveedor; las pruebas unitarias `g77-f1-google-verified-route-resolver.test.mjs` se mantienen como fuente de contrato.

### Circuito único — autorización antes de consumo

1. El servidor comprueba Passenger JWT, autoriza rol y valida origen, destino y servicio. No acepta distancias, coordenadas, peajes ni zonas como precio del cliente.
2. El servicio independiente `resolveCoveredPlaces({actorId,origin,destination,service})` debe devolver `source:'INDEPENDENT_COVERAGE_AUTHORITY'`, `coverageVerified:true`, UUID de evidencia, `revision`, sello temporal menor a 60 s, Place IDs de origen/destino distintos y zoneTag válido. **NO se llama Google si esta prueba falta o está vencida.** Por sí sola no implica disponibilidad de autos ni autorización comercial.
3. Solo con **aprobación expresa del Owner de facturación** y clave restringida del servidor se hace **una solicitud Google Routes v2 ComputeRoutes** con dos Place IDs precomprobados, `DRIVE`, `TRAFFIC_AWARE`, sin alternativas, respuesta JSON acotada, distancia y duración; se rechaza `fallbackInfo`. No se permite un segundo proveedor simultáneo.
4. Después del cálculo, `verifyRouteTolls` debe confirmar fuente independiente `INDEPENDENT_TOLL_AUTHORITY`, misma evidencia de cobertura y Place IDs, misma distancia y duración, UUID de prueba y peajes en guaraníes, incluso cuando el importe certificado sea cero. Un valor ausente rechaza el viaje.
5. Los Place IDs respaldados se transforman en etiquetas opacas `LOC_`+32 letras A–P usando HMAC SHA-256 y un secreto **distinto de Google API key**. El resultado contiene exactamente los diez campos esperados por G73: `routingVerified,coverageVerified,trafficAware,fallbackUsed,originTag,destinationTag,zoneTag,distanceMeters,durationSeconds,tollsPyg`. No expone claves, Place IDs, GPS, direcciones personales ni identidades del Driver.
6. G73 crea cotización del servidor en PYG, exige consentimiento explícito y registra una reserva idempotente. G74 usa el mismo viaje para GET Passenger; G75 usa GET Admin AAL2/rol exclusivo (solo QA). La asignación de Driver exige G71 KYC válido y autorización atómica independiente.

### G4 runtime

El runtime de backend G4 importa el único resolver G77 por inyección `g77RouteOptions`. Su valor por defecto continúa **null**, y `verifiedAutoRoute` no se activa si no existe proveedor. `g77RouteOptions` requiere controles de activación aprobada, llave secreta aislada, secreto de etiquetas, función independiente de cobertura, peajes y transporte. Las pruebas sintéticas pueden inyectar un transporte sin credenciales reales: eso NO constituye aprobación de Google/billing ni certificación del entorno.

### Gate externo NO_GO

Faltan datos/Place IDs de origen/destino autorizados por geocercas versión activa; acuerdo/API real para obtención y actualización de Place IDs sin geocodificación anticipada no autorizada; prueba comercial de peajes; autorización Owner para proveedor/billing con límites de coste; HTTPS IdP/MFA PG compartido; dos dispositivos; mismo `tripId` Cliente→Driver→Admin con KYC válido, completado e historial; verificación de leyes y privacidad.

Fuentes API: Google Routes v2 https://developers.google.com/maps/documentation/routes/compute_route_directions y respuesta/fallback https://developers.google.com/maps/documentation/routes/understand-route-response. Rechazar fallback, no presentar ETA sin asignación y GPS certificado.

**Gobierno:** PR #7 y #8 permanecen DRAFT; sin MERGE, LIVE, DEPLOY, PSP, PII real ni costos autorizados de Google por este corte.
