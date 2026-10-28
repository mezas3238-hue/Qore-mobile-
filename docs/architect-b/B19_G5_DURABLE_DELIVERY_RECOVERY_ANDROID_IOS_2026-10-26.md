# B19 — G5 recuperación duradera de envíos AUTO/MOTO tras cierre de la App Cliente

26 octubre 2026 · Cliente B · PR #8 DRAFT · NO_GO comercial

## Fallo que corrige
La clave original de un `deliveryRequest` G5 se guardaba únicamente en memoria. Un cierre de Android/iOS entre POST y respuesta podía eliminar la clave, impidiendo consultar G121 y facilitando pedidos duplicados. Los 1.119 tests B18 no certificaban recuperación tras terminación del proceso.

## Entrega técnica
- `NativeDeliveryRecoveryStore.ts`: `expo-secure-store` Keychain/Keystore **por UUID de propietario**, operaciones serializadas; sin acceso web/AsyncStorage; guarda **solo** `version,ownerId,requestKey,createdAt`, sin JWT, teléfono, dirección, importe, recorrido o carga.
- `g5-durable-delivery-recovery.mjs`: persiste *antes* del primer POST, bloquea cuando existe una clave desconocida, falla sin POST si SecureStore está inaccesible o hay clave previa, recupera únicamente el mismo UUID. No elimina silenciosamente la clave al cerrar sesión ni al recibir GET 404.
- `client-mutations.mjs`: `restoreUnconfirmedDelivery` restaura una mutación `deliveryRequest` en estado `failed` **sin body**, por lo que no puede reejecutar POST. La clave queda solo para consulta G121.
- `client-experience.mjs`: al autenticar un Passenger, lee exclusivamente su clave (sin otra identidad); bloquea nueva preparación cuando la clave está sin conciliar; antes de `submit` exige gateway QA configurado y guardado seguro previo; tras reinicio el panel existente de G121 consulta por GET privado y B18 G7/G122 puede trabajar con el mismo `deliveryId` comprobado. El vendedor/repartidor no ve datos del dispositivo.
- `ClientRuntime.tsx`: instala almacenamiento nativo con un factory memoizado.
- `g5-durable-delivery-recovery.test.mjs`: casos interrupción, nuevo proceso, usuario distinto, Keychain fallido, registro malformado, logout/relogin, solo GET, sin duplicados.

## Restricciones
No se habilita ningún nuevo botón de POST comercial. `bookingHttpOptions` permanece no configurado en la App por defecto y el botón "Cotizar y solicitar repartidor" sigue apagado. Esta corrección robustece una ruta **QA opt-in futura**, no conecta tarifación comercial, ni prueba KYC/zonas/rutas reales. Persistir un UUID opaco no equivale a consentimiento de tarifa ni a reserva comercial.

## Pendiente
A G124 agregó reglas separadas, históricas e Owner/AAL2 para MOTO/AUTO CARGO, todavía sobre datos sintéticos. Es necesario contratar/validar routing, tarifa oficial previa a reserva, A prequote+booking atómica, conciliar G122 tras pérdida de ACK, C ofertar solo con G38/G71 y Admin D auditar el mismo `deliveryId` en PostgreSQL. No merge, no LIVE/deploy, no recursos pagos.
