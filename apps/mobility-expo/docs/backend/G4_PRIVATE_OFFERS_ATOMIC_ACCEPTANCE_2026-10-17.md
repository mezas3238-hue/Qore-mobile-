# QORE Mobile · G4 Oferta privada → aceptación atómica → evento de pasajero

**Fecha:** 2026-10-17. **Alcance:** contratos de código y PostgreSQL 16 efímero de GitHub Actions. **NO desplegado, NO viajes comerciales, NO contactos reales de conductores o pasajeros, NO claves API.** PR #7 DRAFT y feature flag de viajes deshabilitada.

## Problema anterior

G3 había probado correctamente que dos conductores ficticios no podían aceptar el mismo viaje. Sin embargo, el contrato G3 `mobility_stage_auto_demo_accept` podía ser ejecutado por el rol de servidor sin que el conductor tuviera una **oferta individual vigente**. Esto era aceptable para su test inicial, pero insuficiente para un despacho por notificaciones y aceptación privada tipo QORE Radar.

## Solución G4 implementada

**PostgreSQL (solo CI):** `docs/backend/staging_only/G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql`.

- Tabla `mobility_stage_auto_demo_offers` con `offer_id`, `request_key` único, `trip_id`, `driver_id`, `vehicle_id`, estado, expiración y auditoría de decisión. Una oferta por conductor por viaje; 5 ofertas máximo por viaje en el contrato y TTL de 5 a 30 segundos.
- Tabla `mobility_stage_auto_demo_push_outbox` privada: inserta **intención de notificación** con el destinatario correcto, pero NO declara que Expo la haya entregado ni que exista aceptación. Sin permisos de lectura a clientes y sin DELETE para el rol de servicio.
- RPC `mobility_stage_auto_demo_offer`: crea oferta individual solo si el viaje ficticio busca conductor, no hay autoasignación, y el vehículo pasa **en ese momento** `mobility_vehicle_preflight` de G2. Idempotencia de oferta no renueva TTL.
- RPC `mobility_stage_auto_demo_decline_offer`: verifica que el conductor sea el destinatario y que la oferta esté vigente; el rechazo es idempotente.
- RPC `mobility_stage_auto_demo_accept_offer`: bloquea la fila del viaje, verifica destinatario, TTL y elegibilidad actualizada, produce **una aceptación y un evento auditado**, retira las otras ofertas y protege contra reintentos contradictorios.
- **Cierre del atajo antiguo:** tras instalar el G4 en CI, `service_role` pierde EXECUTE sobre la función antigua `mobility_stage_auto_demo_accept`; su camino autorizado es únicamente `accept_offer`. El contrato G3 se ejecuta ANTES de esta migración para preservar pruebas históricas; jamás aplicar estas migraciones en remoto sin revisión y plan de despliegue.
- RPCs y tablas de ofertas sin permisos directos para `anon` y `authenticated`. No se ha conectado ningún servicio de pagos ni estado LIVE.

**API servidor (no desplegada):** `server/g4-offer-gateway.mjs`.

- GET de oferta privada: `/v1/staging/driver/offers/:id`; POST `/v1/staging/driver/offers/accept` y `.../decline`.
- Exige token de sesión confirmado mediante adaptador de Supabase Auth `getUser(token)`, rol de conductor corroborado en servidor, protección contra exceso de solicitudes mediante adaptador fail-closed y cuenta de **STAGING separada** del Supabase anterior.
- El ID del conductor proviene solamente de Auth. No acepta `driverId`, `role`, `status` o `approved` del JSON. Consulta de oferta valida destinatario, trip id, vigencia, servicio AUTO y etiquetas de lugar ficticias.
- Aceptación/rechazo tienen respuesta solo cuando su RPC confirma la decisión. `pushDelivered=false` y `passengerEventDelivered=false` hasta que un sistema de notificaciones/Realtime verifique publicación y entrega; una aceptación de SQL todavía no es un aviso confirmado al pasajero.
- No expone contacto ni coordenadas de pasajeros a una notificación push. La oferta aún contiene solo etiquetas de lugares ficticios; el backend de producción necesitará una política de divulgación segura y rutas reales.
- El gateway es **una función de contrato**, no un servidor HTTPS arrancado y no está enlazado a la UI. `acceptOffer` y `declineOffer` son adaptadores inyectados; el administrador futuro debe apuntarlos a RPCs autorizadas del Supabase correcto y hacer pruebas con JWT reales.

## Evidencias CI

- `scripts/sql/g4_offers_smoke.sql`: pruebas con identidades falsas de PostgreSQL de G1/G2/G3 para plazo de oferta, rechazo, expiración, retries, pertenencia del vehículo, ganadores/perdedores, outbox y denegación SQL real bajo rol `authenticated`.
- `scripts/sql/g4_concurrent_offer_accept_ci.sh`: **dos conexiones SQL independientes**, dos conductores AUTO sintéticos elegibles, dos ofertas distintas al **mismo viaje**, un ganador, una oferta perdedora retirada, un único evento de aceptación; no confundir con prueba de dispositivos o Google.
- `server/g4-offer-gateway.test.mjs`: suplantación de conductor, role check, sesión sin confirmar, timestamp vencido, ID de oferta cruzado, respuestas truthy y expiración, DB errors sin filtración, roles de Auth obligatorios, claves antiguas denegadas.
- El workflow `.github/workflows/mobility-ci.yml` ejecuta G1/G2/G3 y luego G4 **solo en PostgreSQL desechable**. También se ejecutan tests Expo/domain/server previos y guard no-LIVE.

## Pasos ordenados para integrar sin falsear un sistema real

1. **Cerrar Auth del nuevo Supabase STAGING**: verificar `disable_signup=true` mediante Auth REST nativo; el valor histórico era false y Lovable reportó créditos agotados. Provisionar al menos pasajero y **dos conductores ficticios distintos**, probar permisos G1/Storage y revocación de sesión.
2. Diseñar tabla/servicio de **push tokens** con opt-in por conductor, registro Auth y expiración, borrar tokens inválidos con Expo Push receipts, medir latencia de entrega y probar Android/iPhone con builds de desarrollo.
3. Revisar contrato SQL de ofertas bajo migración versionada, evaluar migración en DB STAGING solo después de aprobaciones P0, y demostrar explícitamente que aceptar sin oferta es imposible.
4. Conectar servicio HTTPS autenticado con protección de borde y limitador distribuido, adaptar SQL G4 y motor de ranking QORE Radar / Google Routes por calles con presupuesto de API controlado; nunca secretos en app.
5. Vincular eventos de oferta y aceptación a **Supabase Realtime privado con RLS**; el pasajero confirma conductor y placa únicamente a partir del snapshot autorizado del servidor; eventos con `revision` monótona, no de push.
6. Activar GPS foreground/background únicamente con consentimiento efectivo; reportar precisión y fecha, recalcular distancia carretera y minutos, ocultar ETA caducada. Definir retención de historial y bloqueo por privacidad.
7. E2E de al menos tres teléfonos (pasajero + dos conductores), aceptación simultánea, expiración de ofertas, mala conectividad, app cerrada, falsos GPS, cancelación, recibo falso/verdadero; el contrato inicial no sustituye esta certificación.
8. Resolver habilitación municipal y pólizas remuneradas y verificar modelo tarifario/PSP. Solo tras revisión legal, seguridad y autorización final del usuario considerar piloto AUTO. **MOTO comercial bloqueada**.

## Aislamiento y no regressión

**Supabase STAGING remoto** sigue en G1/G2 y sin migraciones G3/G4. **Lovable antiguo** `qdqrlgzlotnfdxzpacxs` no se modifica. **Flutter trading PR #2** permanece aislado; no fusionar. Ninguna función G4 crea pedidos comerciales, facturas, GPS o pagos.

## Seguimiento

Documento arquitectónico previo: `docs/backend/G4_QORE_RADAR_DISPATCH_REALTIME_ETA_2026-10-17.md`; registrar cada falla intermedia de CI y el resultado de la última ejecución antes de anunciar certificación.
