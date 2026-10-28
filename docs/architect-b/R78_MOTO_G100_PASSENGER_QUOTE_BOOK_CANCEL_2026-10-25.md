# Arquitecto B R78 — MOTO pasajeros: flujo completo G100 del lado Cliente

**25-oct-2026 — PR #8 DRAFT.** Arquitecto A publicó G100 en PostgreSQL
16 **desechable**: `mobility_stage_g100_moto_quote_qa`,
`...moto_book_qa`, `...moto_cancel_qa`, comprobantes privados;
**no existe aún una ruta HTTPS MOTO certificada**, ni Driver MOTO real.

## Función implementada (QA de Cliente, integración inyectada)
Un flujo MOTO_RIDE totalmente **independiente** de AUTO y ENVÍOS:
- Petición de cotización hacia adaptador externo solo con sesión Passenger,
  ruta proporcionada y reconocimento explícito de seguridad; jamás crea
  tarifas locales o asigna motociclista por su cuenta.
- Valida de forma exacta el comprobante fuente G100 con moneda PYG,
  servicio MOTO_RIDE, identidad del pasajero, caducidad, campaña,
  PSP=false, `commissionBps=1200`, `subsidyBps=1000` y consistencia
  monetaria Gs. p.ej. original 11.000, usuario 9.900, conductor 9.680,
  subsidio 1.100 y plataforma 220.
- Aceptación de importe verificado previa a reserva; `bookingKey` único
  y persistencia servidor, `tripId` original, estado `searching`;
  recibo alterno por GET si el ACK es ambiguo, nunca repetir POST.
- Cancelación expresamente confirmada con `cancellationKey` único,
  exige revisión 2, `VOIDED_QA` balanceado; en incertidumbre solo
  GET de comprobante sin otro POST. Sin pagos, conductor o GPS inventados.
- Gating por sesión y revisión, limpieza de cuenta privada sin
  notificaciones recursivas. UI `app/moto.tsx` muestra cotización
  solo al tener prueba real y muestra recordatorios QA.
- Pruebas adversariales de propietario ajeno, modalidad ENVÍOS,
  importes manipulados, caducidad, PSP, doble reserva y cancelación.

## Bloqueo real A + owner
La app instalada permanece con `motoPassengerOptions=null`, entonces
el botón de cotización está **deshabilitado**, como corresponde.
Para hacerla operativa, A debe montar **rutas independientes HTTPS STAGING**
G100 con origen/destino legalmente cubiertos, proveedor de ruta,
JWT Passenger/RLS, KYC de motorista, tarifa Owner 12/10/2,
reserva/lectura/cancelación/lectura con PostgreSQL persistente, y
compromisos de claves idempotentes recuperables tras reiniciar el proceso.
B deberá conectar ese adaptador autorizado al runtime nativo (no
reutilizar G73 AUTO). Hasta entonces, los tests sintéticos prueban la
lógica del Cliente, **NO** un viaje de moto real.

NO MERGE, NO LIVE, NO costes ni recursos nuevos.
