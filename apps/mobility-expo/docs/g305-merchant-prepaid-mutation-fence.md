# G305 — Bloqueo de preparación de Comercio sin prepago verificado

## Decisión de negocio
Todos los productos de Comercios se compran **solo con prepago digital**. No hay efectivo en compras de Comercios. Viajes y envíos particulares pueden permitir efectivo/tarjeta independientemente.

## Brecha que se ha cerrado a nivel HTTP del runtime G4 STAGING
En el laboratorio PG16 existían rutas merchant G6/G173 que permiten confirmar, preparar, declarar listo o enlazar un envío para probar los cinco recorridos, **sin PSP**. Son pruebas sintéticas y NO deben exponerse como operación comercial real.

El nuevo wrapper `createG305MerchantPrepaymentMutationFence` se conecta directamente en `g4-staging-runtime.mjs` por fuera de los controles existentes G175/G173. Bloquea **todas las solicitudes a `/v1/staging/merchant/orders*`** con HTTP 409 `G305_MERCHANT_PREPAYMENT_ATOMIC_GATE_NOT_CERTIFIED`, sin delegar llamadas a SQL G173. Conserva las rutas no mercantiles (G139 stock QA, lecturas, viajes, Driver, admin) y las pruebas descartables de laboratorio que ejecutan G173 directamente.

G305 no es un checkout LIVE; al contrario, impide que el runtime Railway-STAGING transforme órdenes sintéticas sin pagar en productos listos para entregar.

## Lo que falta para implementar el prepago REAL
1. Proveedor PSP habilitado en Paraguay capaz de capturar tarjetas o confirmar QR/transferencia; canales y destinatarios legítimos, tokenización y webhook firmado.
2. Persistencia de orden y cotización del servidor con stock reservado (y TTL), importe/currency/versión de comisión Owner congelados, referencias PSP y clave idempotente; no guardar tarjeta ni secretos en Cliente.
3. Webhook autentificado y reconciliado contra el proveedor. Una tarjeta `AUTHORIZED` no equivale a cobrada; exige `CAPTURED` irrevocablemente aceptable bajo contrato. Transferencia y QR requieren acreditación `SETTLED`.
4. **Gate en la MISMA transacción SQL** que `start_preparing`, `ready` y `hand_to_courier`: `SELECT FOR UPDATE` sobre orden y pago, verificaciones de importe y estado, no refund/chargeback, estado de inventario, staff/session, y única transición idempotente. Un simple `SELECT` previo en Node tiene ventana TOCTOU y no sirve para LIVE.
5. No asignar Driver antes del cobro: después de pagar se asigna un reparto real. El recibo de Driver y de entrega legitima la liquidación independiente.
6. Una vez certificado el gate SQL, se reemplazará el bloqueo G305 por una operación transaccional autenticada, **sin ruta secundaria que lo evite**. Tests exigidos: pago tardío, pago ajeno, pago parcial, doble webhook, fallo de conexión, refund, revocación de empleado, dos Workers, dos transiciones concurrentes, TTL, bloqueo aun cuando cliente miente.
7. Los fondos de Comercio/Driver/QORE se distribuyen por el ledger G304 (actualmente solo QA) y desembolsos bancarios pactados con proveedor marketplace. Confirmar transferencias y conciliación independientemente.

## Estado / riesgos
- G305 es un **cierre de bypass** a nivel de request HTTP en el runtime G4 STAGING, NO una modificación de Supabase PG17 ni despliegue Railway verificado. No cambia los recorridos históricos PG16 certificados en laboratorio.
- El estado comercial y las liquidaciones reales permanecen **OFF**.
- Los nueve tests G305 y su CI deben quedar verdes antes de considerar merge.
- Atajos con flags desde app, recibos firmados solo por móvil, webhooks sin firma o cambios manuales de estado no desbloquean el comercio.
