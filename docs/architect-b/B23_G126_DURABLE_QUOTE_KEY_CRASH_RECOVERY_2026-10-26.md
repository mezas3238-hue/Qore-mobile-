# B23 — G126 cotización original: recuperación tras reinicio de App Cliente

26 de octubre de 2026 · Arquitecto B · PR #8 DRAFT · STAGING/QA · NO_GO comercial.

## Brecha real cerrada
B22 podía conciliar la cotización G7 original tras un ACK perdido únicamente mientras el proceso estaba vivo. Al cerrar/reiniciar Android/iOS la `quoteRequestKey` original desaparecía, permitiendo una nueva clave y una segunda llamada de ruteo billable o generando un precio diferente de la tarifa Owner publicada previamente.

## Código
- `NativeG126QuoteRecoveryStore.ts`: SecureStore nativo (Keychain/Keystore) por UUID de pasajero con **ocho campos opacos** `version,ownerId,deliveryId,deliveryRequestKey,quoteRequestKey,vehicleKind,createdAt,stage`, `stage` inicial `prepared` o `recovery_attempted` / `consent_attempted`. Sin datos de dirección, ruta, cotización, precio, geolocalización, JWT, PSP ni teléfono. No hay fallback a AsyncStorage, almacenamiento web o almacenamiento inseguro. Las operaciones se serializan para impedir pisar una clave pendiente.
- `g122-delivery-price-consent-flow.mjs`: primero confirma que no existe otra clave, guarda **antes** de POST G7 y verifica la sesión. Error de SecureStore = cero POST. Al iniciar B22/G126 registra persistentemente `recovery_attempted` **ANTES** del único POST con la misma clave; al iniciar consentimiento G122 registra `consent_attempted` **ANTES** de su POST. Un cierre de proceso no puede liberar un segundo POST con nuevo UUID; el estado queda incierto y cerrado a nuevas operaciones.
- `restoreOriginalQuote(scope)` es solo lectura SecureStore y jamás envía HTTP. Acepta exclusivamente Owner UUID, mismo G121 `deliveryId`, misma clave de registro G5, mismo AUTO/MOTO y timestamp del registro. Si falta la clave queda disponible el primer POST; si hay clave `prepared` queda recuperable con G126 de forma expresa. Si marca recovery/consent previa, prohíbe repetirla; necesita un endpoint de lectura certificada para resolver ambigüedad.
- `client-experience.mjs`: después de un GET G121 autorizado que verifica `deliveryId` de la misma cuenta, dispara únicamente lectura de SecureStore, con barrera de JWT/sesión y requestKey. `ClientRuntime.tsx` monta el store por dispositivo y requiere persistencia segura en todos los intentos G7. El flag de backend G126 y certificaciones G121/G122/G123/rutas/Owner están apagados por defecto.
- Pruebas aisladas + integración `g126-durable-quote-key-client.test.mjs`: caída tras G7, clave inmutable tras reiniciar, conflicto de otro envío, sin Store, fallo de escritura/lectura, G122 incierto y prueba G121 GET→restauración→G126 mismo key. QA se adjunta al issue #16.

## Límite intencional
Guardar clave G7 **no demuestra que el backend haya emitido ni cobrado** una cotización. Un error tras guardar sin red puede dejarla bloqueada hasta que el backend tenga GET de conciliación. No borrar marcas "consent_attempted" por logout, expiración o un simple 404. Hace falta GET readback G122 persistente y un cierre de servicio confirmado en PostgreSQL para borrar claves. B19 guarda clave G5 por separado.

## Pendientes A/D
A G127 tiene un adaptador de Google Routes con modos AUTO DRIVE / MOTO TWO_WHEELER, pero sin proveedor real/cobertura/peajes/cuota/pago aprobados; A G116/G124 cubren pasajeros y cargo, COMMERCE por categoría no tiene aún configuración completa. D PR #20 editores Owner parciales. Implementar una sola trayectoria `prequote autorizado→consentimiento→pedido→Driver→Admin→ledger` con la misma ID, G38 legal y G71 KYC antes de producción.

No MERGE, no LIVE, no deploy ni recursos pagos sin Owner.
