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

## Habilitación futura — solo con certificación independiente
Las cuatro variables de G116 constan en `apps/movete-admin/.env.example`, todas bloqueadas inicialmente. La presencia de banderas públicas jamás sustituye Auth/JWT de servidor. Configurar `VITE_G116_OWNER_COMMISSION_ENABLED` o `VITE_G116_OWNER_CONTRACT_VERIFIED` como verdaderas **solo después** de aprobar formalmente el entorno STAGING. El formulario no muestra tasas reales hasta que su propio GET autorizado obtenga un recibo válido.

## D: consulta cinco modalidades por mismo serviceId (QA, sin GO)
- Panel Admin posee búsqueda por `serviceId` y categoría, historial ordenado,
  estado legal `G38/G71` y conciliación del mismo ID; no muestra PII.
- Gateway de solo lectura, OFF hasta autorización Owner + HTTPS STAGING,
  PG16 externo verificado, rol Admin JWT AAL2, revocación y contrato A.
- **Contrato solicitado a A, todavía NO montado:**
  `GET /v1/staging/admin/services/{serviceKind}/{serviceId}/trace`.
  Debe consultar bajo snapshot consistente la misma reserva del Cliente,
  oferta/estado Driver y ledger transaccional. Validar scope, RLS y revocación.
- DTO exacto: `{mode:'STAGING_DEMO_ONLY',viewerId,serviceId,serviceKind,bookingRequestKey,quoteId,status,revision,observedAt,expiresAt,serverPersisted:true,productionEnabled:false,assignment:{state,legalGate},events:[{eventId,serviceId,sequence,status,at}],ledger:null|{serviceId,currency:'PYG',grossGs,platformCommissionGs,customerSubsidyGs,driverPayoutGs,reconciliationStatus}}`.
- UI descarta UUID equivocado, historial/revisión inconsistente, ledger con ID ajeno,
  supuesto conductor asignado con G38/G71 bloqueado, rol/identidad rotada,
  respuesta vencida o HTTP desproporcionado. Las pruebas de gateway no
  sustituyen navegación E2E, RLS ni PG externo.

## Protección adicional D — no retroceder reservas ni alterar ledger
Se integra `service-trace-integrity-fence.mjs` dentro del AdminExperience,
conservando por sesión Admin el último estado de cada serviceId. Previene
retroceso de revisión, sustitución de bookingRequestKey/quoteId, historial
reescrito/truncado, resurrección terminal y modificaciones de ledger
conciliado. Sesión cambiada, cierre y revocación limpian la referencia.
No sustituye pruebas PG16 ni autoriza mover fondos. Nuevos tests Node sobre
transiciones positivas y casos adversariales (pendientes de CI D→B).

## Owner: tarifas de envíos AUTO/MOTO G124 — interfaz y contrato
- Backend A declara GET/POST `/v1/staging/owner/delivery-rates/{AUTO|MOTO}/{CARGO_ZONE}` por Owner exclusivo y MFA AAL2 con PostgreSQL; no es contrato de viajeros ni de comercios.
- D añadió editor separado para base, km, minuto, mínimo, comisión 0-3000 bps y vigencia 1-90 días; **primero GET autorizado** para zona aprobada. El código de zona no concede cobertura.
- DTO POST exacto `{requestKey,basePyg,perKmPyg,perMinutePyg,minimumPyg,commissionBps,durationDays}`. No acepta `subsidyBps` ni asume que el 10% de pasajeros aplica a carga.
- Cliente comprueba rol Owner AAL2 antes y después del HTTP, coincidencia del vehículo+zona, versión, vencimiento, recibo G124, respuesta acotada y timeout. Resultado incierto bloquea nuevo POST hasta un GET fresco. Pasado no se recalcula.
- OFF por defecto en `.env.example`. No se activó STAGING externo ni LIVE. Exigir certificación end-to-end y ejecución Admin CI antes de usarlo con tarifas vigentes.

### G124 — alta inicial REAL del contrato A y readback idempotente
- A confirma en su prueba PostgreSQL16 de G124 que GET devuelve 404 sin tarifa y POST crea **versión 1** para MOTO/AUTO; POST de versión siguiente preserva cotizaciones previas.
- Editor D ahora diferencia 404 certificado (alta inicial permitida) de 401/403/409/503/timeout (bloqueo), con confirmación explícita de Owner respecto de vehículo y zona. No confundir 404 con permiso territorial.
- Después de crear o actualizar, D exige un nuevo GET autorizado con mismo `ruleId` y `version` antes de declarar éxito; si el POST tiene ACK incierto se bloquea la segunda escritura, se consulta por GET. El backend sigue controlando Owner+AAL2/revocación/territorio.
- G124 no define condiciones ni porcentajes de comercio. Subsidio pasajero = 10% separado. Ningún despliegue.

### D Owner G124 — porcentaje legible y conversión exacta
El campo de comisión se presenta al Owner en porcentaje (15 = 15 %, 12.50 = 12,50 %), con hasta dos decimales y rango 0-30 %, convertido sin aproximaciones a `commissionBps` antes de POST. Recibos 1300 bps se presentan como 13 %. El backend G124 sigue siendo la única autoridad para reglas y versión; no aplica el subsidio de pasajeros a envíos.
