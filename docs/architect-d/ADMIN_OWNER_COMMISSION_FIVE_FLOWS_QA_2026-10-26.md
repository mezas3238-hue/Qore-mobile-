# Arquitecto D — Entrega funcional QA: comisiones Owner y cinco flujos

**Fecha:** 2026-10-26 · **Issue:** #18 · **Rama:** `feature/mobility-arquitecto-d-admin-e2e-20261026` · **PR:** DRAFT hacia B. Sin merge, despliegue o datos reales.

## Función con código y pruebas preparadas
- El Owner puede consultar separadamente comisiones AUTO_RIDE y MOTO_RIDE de G116; la respuesta de prueba sólo puede venir del backend y exige 10 % de subsidio fijo (1000 bps). La UI continúa BLOQUEADA hasta JWT AAL2/roles/revocación/HTTPS/PG y autorización real.
- El gateway descarta la respuesta si cambia el rol o MFA durante el HTTP, rechaza cuerpo excesivo antes/después de leerlo, evita operaciones concurrentes y aborta lecturas bloqueadas. Esta función previene presentar una comisión antigua a un actor no autorizado.
- El estado de edición se vuelve a crear al cambiar la identidad Owner. Una tasa del Owner anterior no puede permanecer visible tras el cambio de cuenta.
- La navegación Admin muestra explícitamente **cinco flujos**: AUTO pasajeros, MOTO pasajeros, ENVÍOS AUTO, ENVÍOS MOTO, COMERCIOS, todos QA/NO LIVE. No se inventa cobertura ni disponibilidad.

## Contrato G116 existente (Arquitecto A)
- `GET /v1/staging/owner/commissions/{AUTO_RIDE|MOTO_RIDE}`.
- `POST /v1/staging/owner/commissions/{AUTO_RIDE|MOTO_RIDE}` con `{requestKey: UUID, commissionBps: entero 1000..3000}`.
- JWT bearer, Owner exclusivo, MFA AAL2 confirmado por proveedor, token/sesión vigente y no revocada, límite de tasa, PostgreSQL y respuesta `{serviceKind,commissionBps,subsidyBps:1000,version,mode:'STAGING_DEMO_ONLY',productionEnabled:false}`.
- Precios de cotizaciones históricas no se recalculan en el panel. ENVÍOS y COMERCIOS necesitan política explícita separada de A; D no inventa porcentajes.

## Matriz de entrega E2E (a completar mediante mismo serviceId persistido)
| Flujo | Backend A | Cliente B | Driver C | Admin D | Ledger |
| --- | --- | --- | --- | --- | --- |
| AUTO pasajeros | QA parcial G75/G116, sin STAGING externo | QA parcial | QA parcial | F1 lectura QA, sin E2E certificado | Pendiente conciliación real |
| MOTO pasajeros | QA contrato de viajes, legal G38/G71 pendiente | QA parcial | QA parcial | Estado NO_GO, G116 comisión preparada | Pendiente |
| ENVÍOS MOTO | QA parcial | QA parcial | QA parcial | Visibilidad sin contrato E2E | Pendiente |
| ENVÍOS AUTO | QA parcial | QA parcial | QA parcial | Visibilidad sin contrato E2E | Pendiente |
| COMERCIOS | QA parcial | QA parcial | QA parcial | Bandeja casos desconectada | Pendiente |

Ninguna celda significa GO comercial. `PASS` E2E requiere mismo ID leído en Cliente, Driver y Admin y ledger PostgreSQL bajo JWT/RLS, prueba positiva y negativa.

## Pruebas, bloqueo y pedido a A
- Nuevo `owner-commission-hardening.test.mjs`: comisiones distintas por modalidad, 10% invariable, downgrade de rol, MFA revocado, respuesta incorrecta, exceso de bytes, concurrencia y timeout.
- Ejecutar `npm run check && npm run build` en `apps/movete-admin` con el HEAD exacto de D. **No declarar CI SUCCESS hasta que exista URL de ejecución verificada.**
- El workflow `movete-admin-web-qa.yml` de A filtra PRs cuyo destino es la rama A. El PR D exige como base la rama B, por lo que A debe habilitar el job de verificación para PR D (sin ampliar ownership D).
- A debe proporcionar entorno HTTPS STAGING autorizado e integrable, roles Owner/Admin AAL2 reales, revocación, SQL persistente y endpoints de consulta por serviceId de los cinco flujos, con estado G38/G71, historial y liquidación. Hasta entonces **NO_GO**.
