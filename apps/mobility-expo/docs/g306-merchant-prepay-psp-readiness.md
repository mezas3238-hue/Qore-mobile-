# G306 — prepago digital de Comercios: verificador + transacción privada

## Regla Owner
Toda mercadería de Comercios se **paga digitalmente antes de que el Comercio empiece la preparación y antes de que el repartidor retire productos**. Ni el Driver ni el Comercio pueden activar efectivo contraentrega para mercadería. Viajes AUTO/MOTO y entregas particulares siguen una política separada (efectivo o tarjeta, según disponibilidad).

## Entregado — CI PG16, sin operaciones bancarias
- `server/g306-merchant-prepay-provider-verifier.mjs`: acepta solo `orderId` y una referencia opaca de pago (no importe, medios, tarjetas, supuesta confirmación o credenciales suministradas por el móvil). Consulta un **pedido original** en un proveedor de datos del servidor y después un **comprobante PSP** mediante adaptador privado. Requiere firma de callback y segunda consulta al PSP, comprador y orden idénticos, moneda PYG, importe total y prueba no reembolsada.
- Tarjeta: `CAPTURED` o `SETTLED`. Transferencia o QR: solamente `SETTLED`. Efectivo, `AUTHORIZED`, screenshots, pagos parciales y cambios de monto son rechazados.
- La respuesta positiva del verificador **NO** cambia el estado del pedido, no habilita preparación y no desembolsa al Comercio ni al Repartidor. El módulo sigue con `G306_REAL_PSP_CONNECTED=false`, `G306_ORDER_RELEASE_ENABLED=false` y `G306_LIVE_COMMERCE_ENABLED=false`.
- `docs/g306-atomic-commerce-prepay-pg17-draft.sql`: diseño de comprobantes en el esquema privado `qore_stage_internal`, RLS, sin permisos de lectura/escritura para Clientes. `UNIQUE(order_id)`, `UNIQUE(psp_payment_ref)`, `UNIQUE(provider_event_ref)`. La función `SECURITY INVOKER` bloquea `merchant_orders` y luego la prueba de pago, comprueba que el original `fare_quote` tiene el mismo comprador/pedido y total (productos + tarifa de envío) y ejecuta la transición G173 de Comercio dentro de la **misma transacción**.
- `scripts/sql/g306-prepaid-atomic-disposable-ci.sql` prueba esa función contra **PostgreSQL 16 aislado** con stub explícito de G173 y casos de permiso, importes, comprador falso, ausencia de cobro, devolución e idempotencia. La prueba separada G305 comprueba el bloqueo HTTP de Railway-STAGING si no está certificado el PSP.

## Distinción crítica: prueba vs. dinero real
El conector PSP NO está contratado ni instalado. Las marcas `signedCallbackVerified` e `independent_lookup_verified` son **contratos de entrada del adaptador de confianza futuro**, no una verificación criptográfica ejecutada por este módulo. No permitir que el teléfono ni endpoints de Cliente puedan insertar/actualizar la tabla de pruebas. Tampoco permitir que operadores de Soporte cambien pagos, saldos o destinatarios.

La función G173 prevista en el SQL de G306 debe encontrarse **efectivamente instalada y verificada** en el PG17 destino antes de una instalación. Las pruebas PostgreSQL 16 emplean un reemplazo descartable para aislar el control de prepago; ello no certifica la composición real de Supabase, la autenticación de merchant ni la posibilidad de cobrar y pagar.

## Próximas acciones para operación comercial
1. Seleccionar PSP bajo acuerdo para Paraguay que confirme cobro electrónico con firmas + API de consulta y que soporte marketplace/subcomercios, conciliación y transferencias a beneficiarios (o contratar servicio autorizado separado). Bancard Tpago, una pasarela de cobro simple y SPI no se deben confundir automáticamente con split/payout.
2. Contrato proveedor, entorno sandbox con cuenta de prueba, documentación KYC/KYB y facturación, tarifas y liquidación; guardar credenciales solo en Railway de servidor, nunca en repositorio/ChatGPT/Cliente.
3. Implementar el **adaptador real de firma + consulta PSP** y un único escritor financiero en PG17; crear/actualizar la prueba de pago con anti-replay, intenciones, TTL, devolución y conciliación, dentro de límites de acceso.
4. Verificar sesión independiente del Comercio, instalar/migrar función G173 y la transacción G306 auditada. Reemplazar G305 por la única ruta autorizada para preparar/despachar con todo bloqueado por defecto si falta PSP/identidad.
5. Implementar recibos y pagos independientes a Comercio + Repartidor, manteniendo regla de comisión Owner versionada. Fallos, contracargos y reclamaciones dejan pago retenido, nunca "PAGADO" si no hubo desembolso confirmado.
6. Ejecutar E2E externos reales de Cliente, Comercio, Repartidor y Admin y demostrar: sin pago no se prepara; captura válida permite avanzar; webhook duplicado no duplica orden; reembolso bloquea; suspensión de Comercio bloquea; pagos se concilian sin intervención de Soporte.

## Estado STAGING
PR DRAFT y CI PG16; no se ha aplicado SQL a Supabase PG17 ni cambiado la configuración Railway; **0 compras reales y 0 desembolsos certificados**. No confundir aprobaciones CI con 5/5 recorridos externos certificados.
