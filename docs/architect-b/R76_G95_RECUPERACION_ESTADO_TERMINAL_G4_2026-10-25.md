# R76 — Estado G4 autenticado después de reinicio y cancelación G95

Cliente B, QA-only, PR #8 DRAFT, 2026-10-25.
Tras un reinicio, G73 confirma propietario/bookingKey/routeId/quoteId/tripId
y G95 recupera la cancelación persistida (GET privado). R76 permite un
tercer GET de estado **G4** limitado a ese tripId ya autorizado. Solo
`cancelled` con Owner original, revisión >= recibo G95 y timestamp fresco
puede informar al pasajero que el viaje está cancelado. Ante respuesta
`searching`, 403, timeout, JWT rotado o contradicción, se revoca el
seguimiento parcial y NO se declara cancelación final. Nunca se envía POST.

**Separación contable:** la UI siempre señala que G94 NO está certificado
tras reiniciar porque aún falta recuperar el G93 histórico del mismo viaje.
`statusIndependentlyVerified` es solo G4; nunca se activa
`independentlyVerified` de G4+G94 sin recibo financiero propio.
Para resolverlo, A debe ofrecer el recibo histórico inmutable firmado
/owner-scoped con los montos G93 y correlación bookingKey.

CI sintética: pendiente corroborar con Android e iOS instalados y
PostgreSQL persistente externo. El G98 PG16 real de A valida backend
HTTP loopback sintético, no un conductor ni mapas comerciales.
No merge/LIVE/recursos pagos ni activación de flags.
