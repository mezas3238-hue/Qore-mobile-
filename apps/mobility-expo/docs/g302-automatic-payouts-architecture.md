# G302 — Cobro, reparto y pago automático al Driver (Paraguay)

## Requisito aprobado
Movete Fácil debe cobrar electrónicamente al Cliente, aplicar de forma automática la **comisión vigente y aprobada por Owner**, y abonar el monto correspondiente al Driver, sin participación diaria de Soporte ni aprobación manual de cada operación.

## Flujo real que debe construirse y certificar
1. La app Cliente muestra una cotización PYG versionada; el pasajero acepta el cobro y el PSP recibe una **autorización explícita**, con tokenización. No se guardan PAN/CVV en QORE.
2. El PSP autorizado verifica/captura el cobro y remite evento autenticado (firma, anti-replay, importe, moneda, referencia, destinatario). Nunca confiar en pantalla Cliente, webhook sin firma ni la sola respuesta HTTP del proveedor.
3. Al confirmar **fondos liquidados y disponibles** y recorrido completado legítimamente (Driver/KYC/vehículo habilitados, sin disputa ni reversión), el motor crea una única transacción contable por reserva.
4. Cálculo en números enteros PYG: importe cobrado = pago Driver + comisión bruta de Movete Fácil. Comisión neta = comisión bruta - arancel PSP (si el contrato asigna el costo a la plataforma). Los peajes no se deben gravar con comisiones no contempladas por la tarifa persistida.
5. El proveedor soportará **split/subcomercios y payouts** o un contrato explícito con entidad habilitada para realizar desembolsos a terceros. Una pasarela de simple cobro NO acredita automáticamente a los Drivers. QORE no debe custodiar o intermediar fondos de terceros sin esquema legal autorizado.
6. Enviar desembolso al destino tokenizado del Driver previamente validado; **solo tras comprobar el recibo firmado y conciliado** se muestra PAGADO. Un payout solicitado, pendiente o con timeout NO equivale a transferencia exitosa.
7. Repeticiones de webhooks/cron/reintentos deben usar UNIQUE(serviceKind,bookingId), evento PSP y referencia PSP, transacción SQL, bloqueo concurrencia y consulta PSP antes de reintentar resultados inciertos. No pagar dos veces.
8. Reversiones, contracargos, cancelaciones, reclamos de seguridad, beneficiario bloqueado, saldo no disponible y fallo de firmas producen retención o reconciliación, no transferencias silenciosas.

## Permisos
- **Owner con MFA AAL2** configura versiones futuras de comisión y ve estados conciliados; no es operador de cada transferencia.
- **Driver** ve su neto, referencia de liquidación, estado y medio aprobado; no administra porcentajes ni claves PSP.
- **Soporte** atiende casos, consulta solo estado mínimo del ticket/operación autorizado, deriva reclamaciones a finanzas. No posee ejecución de transferencias, reembolsos o modificación de importes.
- **El sistema** ejecuta pagos aprobados conforme a política una vez certificado el PSP y controles regulatorios. No se dan permisos de pago a usuarios sin legitimidad.

## Estado actual comprobado
- `server/staging-ledger.mjs`, G7 y G116 son prototipos de libro contable/finanzas de STAGING y no transfieren fondos reales.
- G302 añade `server/g302-auto-settlement-qa.mjs` con 10 pruebas estrictas de condiciones de cobro, cálculo y bloqueos; no hay integración PSP, enlace de cobro ni transferencia.
- `g302-settlement-pg17-qa.sql` es **propuesta de tabla**; no se aplicó a PG17, no se modifica Railway ni se habilitan flags.
- No prometer pago inmediato: SPI en Paraguay opera 24/7, pero el tiempo real de disponibilidad depende de método de cobro, liquidación PSP y contrato de pagos a terceros.
- Para **COMERCIO** hace falta partición multibeneficiaria (comercio, repartidor y plataforma), separada de la de pasajero/conductor. Nunca reducirla a dos beneficiarios sin datos.

## Dependencias para LIVE
Acuerdo PSP por escrito: marketplace/subcomercios, split o payouts bancarios, cronograma, tarifas, disponibilidad, cuentas de Drivers, AML/KYB, KYC, fraude/contracargos, facturación; revisar Ley 7503/2025 y regulación BCP con profesionales habilitados. Pruebas E2E con sandbox autorizado para cobro, captura, liquidación, desembolso, fallo parcial, revocación y reclamos, antes de habilitar operación comercial.
