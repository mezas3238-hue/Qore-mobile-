# QORE Mobile — G127: misma ruta Google DRIVE para AUTO y MOTO
26 octubre 2026. Decisión Owner.

La geometría de Google Routes `DRIVE` se usa para el cálculo vial
de ENVÍOS tanto AUTO como MOTO. Sin embargo, QORE mantiene `vehicleKind`
separado para capacidades de carga, selección Driver, seguros, KYC,
elegibilidad y reglas tarifarias independientes G124. El presupuesto de
Maps reserva el mismo SKU `ROUTES_DRIVE_TRAFFIC_AWARE` para ambos.

**Seguridad:** Google diferencia `DRIVE` y `TWO_WHEELER`, y las rutas
no siempre son idénticas. Una ruta `DRIVE` NO se debe mostrar como
navegación certificada legal para motocicletas ni como ETA de un Driver.
Antes de navegación MOTO, verificar restricciones de circulación,
prohibiciones/seguridad vial y autorización local independientemente.

La consulta requiere primero cobertura de zona y Place IDs
certificados de la solicitud; luego reserva DURABLE de presupuesto
antes del HTTP; luego verificación independiente de peajes. No aceptar
kilómetros, zonas, tolls ni tarifas del Cliente.

## Activación Google Cloud todavía pendiente
- Crear/seleccionar proyecto con facturación autorizada y habilitar Routes API.
- Crear clave restringida por API y origen de servidor. Guardarla como secreto
  fuera de GitHub, la App Cliente y Driver.
- Imponer límites de cuota Google y limitador durable en backend; alertas
  por sí solas no bloquean facturas.
- Validar cobertura territorial, Place IDs y peajes de forma independiente.
- Verificar coste en la factura real y con móviles antes de NO_GO→GO.

El proyecto aún NO contiene credenciales reales ni conexión a Google Cloud.
CI: datos y respuestas de rutas sintéticos, no navegación comercial.
Sin MERGE, LIVE, pagos o despliegue.

Fuentes:
https://developers.google.com/maps/documentation/routes/vehicles
https://developers.google.com/maps/documentation/routes/usage-and-billing
https://developers.google.com/maps/billing-and-pricing/pricing
