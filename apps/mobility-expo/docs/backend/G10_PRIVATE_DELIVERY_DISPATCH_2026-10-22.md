# QORE Mobile — despacho privado de entregas G10

**Fecha:** 2026-10-22  
**Estado:** implementado en rama DRAFT, PostgreSQL 16 desechable; NO desplegado y NO LIVE.

G10 elimina la aceptación abierta por ID de entrega y aplica a envíos
particulares y entregas comerciales el patrón privado que ya usa QORE Radar:

- ranking interno AUTO/MOTO con GPS consentido y reciente;
- rutas viales verificadas con tráfico, sin Haversine como ETA;
- elegibilidad, vehículo, seguro, capacidad y disponibilidad revalidados;
- máximo cinco destinatarios, oferta individual con TTL de 5–45 segundos;
- outbox privado que no confunde ticket de push con entrega al dispositivo;
- bloqueo común de la entrega y exactamente un ganador;
- perdedores retirados, decisiones idempotentes y evento de custodia durable.

El despachador interno es `server/g10-delivery-dispatch.mjs`. La persistencia
atómica reside en
`docs/backend/staging_only/G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql`.
Después de instalar G10, `service_role` deja de poder ejecutar la aceptación
directa G5 por `delivery_id`: aceptar exige una oferta privada vigente.

La API autenticada para el repartidor es:

- `GET /v1/staging/courier/delivery-offers/:offerId`
- `POST /v1/staging/courier/delivery-offers/accept`
- `POST /v1/staging/courier/delivery-offers/decline`

El actor proviene de Supabase Auth. La lectura se filtra en BD por `offer_id` y
`courier_id`; no expone remitente, coordenadas ni contacto. La creación de
ofertas es interna, no una ruta cliente.

Verificación local inicial: 234/234 pruebas de servidor en menos de 1 s. El workflow
G1→G10 añade smoke PostgreSQL y una carrera real de dos clientes `psql`. Push,
GPS y proveedor vial reales siguen siendo adaptadores externos fail-closed;
Lovable no implementará ninguna de estas reglas.
