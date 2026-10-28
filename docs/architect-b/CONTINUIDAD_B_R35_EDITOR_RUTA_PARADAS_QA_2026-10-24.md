# QORE Mobile — Arquitecto B | R35 Editor privado de rutas y paradas (24-10-2026)

## Objetivo
Responder a las referencias funcionales de Bolt Cliente y Uber Cliente recibidas el 24-oct-2026, avanzando el editor de rutas de Movete Fácil sin declarar que existen navegación, geocodificación, pricing multistop ni viajes reales.

## Cambios realizados
- `client-route-editor.mjs` y `.d.mts`: estado puro e inmutable por formulario con origen, destino, paradas intermedias, inversión, alta, edición, eliminación, reordenamiento y revisión de unicidad. Sin persistencia ni red. Hasta 8 paradas **por borrador local**, solo para proteger la UI mientras no existe contrato de paradas; esto NO constituye límite de viajes/registros globales.
- `client-route-editor.test.mjs`: 10 tests negativos y positivos (estado congelado, inversión, orden, duplicación, blank/control/bidi, límites locales, corrupción, invalidación por revisión y prohibición de preparar paradas).
- `app/viaje.tsx`: pantalla ahora permite intercambiar origen/destino, añadir y reordenar paradas y revisarlas localmente. El texto advierte que no hay distancia, precio, disponibilidad ni backend multistop. El botón de preparar solicitud segura **desaparece cuando hay paradas**, y `prepare()` vuelve a validar compatibilidad antes de crear `requestKey`.
- Formulario privado se remonta en `privateViewRevision` tras cambio de cuenta/JWT, evitando retener ruta al cerrar sesión. Nunca se incluyen las paradas en un `rideRequest` básico ni se envían a servidor.

## Riesgo y protección
El contrato actual `prepareLocalRideRequest` / `rideRequest` sólo acepta un origen y un destino. R35 **no lo modifica** ni lo extiende localmente fingiendo compatibilidad. Una ruta multistop puede revisarse pero devuelve `WAYPOINTS_NOT_SUPPORTED_BY_SERVER` al intentar prepararla. Tampoco calcula ETA, geocoding, tarifas ni disponibilidad, ni habilita moto pasajero, ofertas o cobros.

## Dependencias del Arquitecto A — issue #9
1. Contrato versionado de geocodificación de puntos/orden, modalidad AUTO y destinos múltiples.
2. Cotización servidor para ruta multistop, con routeVersion, expiración, precio exacto Gs y reglas de modificación.
3. Pedido idempotente/despacho transaccional que preserve el orden completo de paradas; mecanismo seguro para reprice y cancelar.
4. Pruebas 2 identidades/JWT, GPS fresco, fuera de cobertura, precios stale, max paradas **definido por política real**, privacidad y carreras.

## Propiedad y aceptación
Se editaron únicamente `apps/movete-cliente/**` y esta documentación `docs/architect-b/**`, conservando PR #8 DRAFT (base A PR #7). **NO MERGE, NO LIVE, NO DEPLOY**. Ejecutar/consultar CI de ownership B, Admin y aislamiento/Cliente/Driver en el MISMO HEAD final; un commit documental dispara otro SHA y requiere verificación separada.

## Continuidad sin pausas
Siguiente R36: seguridad previa al inicio del viaje (código de recogida validado por A) o modo simple accesible, priorizando controles de Cliente independientes que no requieren infraestructura Live. Coordinar APIs con A mediante issue #9 y no invadir `apps/movete-driver/**`.
