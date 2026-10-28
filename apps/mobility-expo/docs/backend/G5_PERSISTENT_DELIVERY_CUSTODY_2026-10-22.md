# QORE Mobile — entregas persistentes y cadena de custodia G5

**Fecha:** 2026-10-22

**Estado:** implementado para PostgreSQL 16 desechable y runtime loopback
STAGING; NO aplicado remotamente, NO LIVE.

## Alcance implementado

- Solicitudes de documentos, paquetes, supermercado, farmacia OTC y
  restaurante para `AUTO` o `MOTO`.
- Límites de peso, volumen y lado máximo, tanto de plataforma como por
  vehículo revisado.
- Habilitación de carga independiente de la habilitación MOTO-pasajero. La
  autorización de paquetes no abre viajes de pasajeros en moto.
- Asignación atómica de courier y vehículo, GPS reciente, consentimiento,
  licencia, seguro de carga, rol y revisión administrativa.
- Exclusión mutua entre viajes activos y entregas activas del mismo conductor.
- Cadena durable `requested → accepted → picked_up → delivered`, con
  comprobante obligatorio; disputa y devolución quedan auditadas.
- Categorías restringidas no modeladas y declaración de artículo restringido
  rechazada. `PHARMACY_OTC` no autoriza medicamentos controlados.
- RLS de lectura solo para remitente/courier; escrituras únicamente mediante
  RPC del servidor. Eventos de custodia append-only.

## API autenticada

- `POST /v1/staging/sender/deliveries/request`
- `POST /v1/staging/courier/deliveries/:deliveryId/accept`
- `POST /v1/staging/deliveries/:deliveryId/transition`
- `GET /v1/staging/deliveries/:deliveryId/status`

El servidor deriva remitente y courier del JWT verificado. Los cuerpos de
entrada no admiten IDs de actor, roles, estados ni banderas LIVE. Cada comando
usa UUID de idempotencia y el estado persistido decide si la transición es
válida.

## Componentes

- `docs/backend/staging_only/G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql`
- `scripts/sql/g5_delivery_smoke.sql`
- `server/g5-supabase-delivery-repository.mjs`
- `server/g5-delivery-command-gateway.mjs`

El workflow principal instala G1→G5 en PostgreSQL 16 desechable y ejecuta el
smoke de capacidad AUTO/MOTO, permisos, idempotencia, prueba de entrega,
disputa, devolución y aislamiento RLS. La suite Node agrega pruebas unitarias,
de integración HTTP real en loopback y del runtime con adaptador estilo
Supabase.

## Límites deliberados

No hay despliegue, migración remota, dirección exacta, fotografía/archivo real,
OTP, notificación push, courier automático, cobro ni liquidación. Los tags de
ubicación son referencias no sensibles. Farmacia se limita a OTC hasta tener
reglas regulatorias, prescripción, habilitación, cadena de frío y revisión
legal. La próxima capa funcional es pedido comercial persistente: comercio,
sucursal, catálogo/inventario, preparación, sustituciones y enlace con esta
entrega.

