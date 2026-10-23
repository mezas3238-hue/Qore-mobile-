# G38.0 / G38.1 — Caso de disputa y primera cerca transaccional de aceptación

**Fecha:** 23-10-2026. **Propietario:** Arquitecto A. **Entorno:** PostgreSQL 16 descartable, sin LIVE.

## G38.0: separa custodia física de casos administrativos
- G36 libera el slot único en `delivered` y NO intenta readquirirlo en `delivered → disputed` ni `disputed → returned`.
- Índice exclusivo de courier para `accepted/picked_up` (las disputas son casos; los bloqueos de nueva elegibilidad se mantienen por preflights y G38, no por una reserva fantasma).
- Prueba real de transición e idempotencia de disputa, retorno, eventos y ausencia de reserva luego de entrega.
- Riesgo explícito: una disputa tardía podría coexistir con otra asignación; no debe cancelar una misión ajena ya aceptada, pero suspende futuras aceptaciones bajo G38. El procedimiento de retorno físico requiere su propia reasignación segura y autorización legal.

## G38.1: intento inicial de cerca transaccional, fail-closed
- Tabla privada sin grants `mobility_stage_g38_trusted_offer_proofs` vincula oferta/job/Driver/vehículo/zona/revisión de consentimiento/geometría/política y TTL.
- Un trigger en cada aceptación privada valida que exista prueba específica, oferta pendiente, consentimiento actual bloqueado `FOR SHARE`, último GPS de cuarentena coincidente, identidad KYC, ausencia de disputa y zona habilitada por política auténtica.
- **El esquema G31 obliga `eligible_by_policy=false` en QA** y no existe emisor real de pruebas firmadas/geofence. En consecuencia, ninguna aceptación G38 está autorizada para operación, incluso con registros simulados.
- Las pruebas adversariales intentan aceptación AUTO y DELIVERY sin attestation; ambas deben rechazar `G3801` sin cambiar estado, historial ni slot.
- Las pruebas G36 de doble aceptación privada se ejecutan **antes de activar G38** para conservar verificación de integridad/slot sobre los flujos del laboratorio G36. No confundir con disponibilidad real.

## Desbloqueos pendientes
Conectar Auth JWT/MFA de proveedor verdadero, validador criptográfico de pruebas geofence, GPS antifraude, política legal y seguro por zona, storage KYC verificado, HTTPS STAGING autorizado, dispositivos y e2e. La mera presencia de una fila privada no certifica una geocerca o una licencia. No exponer `service_role` al móvil/browser ni habilitar dinero o usuarios reales.

**NO MERGE / NO LIVE / NO SQL REMOTO / NO DESPLIEGUE.** Ruta CI: `.github/workflows/mobility-g4-postgres-disposable.yml`.
