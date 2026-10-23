# Movete Fácil Driver — G20: licencia vigente antes de crear y aceptar ofertas

**Owner mandate:** dos aplicaciones diferentes, `movete-driver` y `movete-cliente`. **Responsable de este bloque:** Arquitecto A, Backend + Driver. Arquitecto B conserva Cliente/Admin UI. Fecha de trabajo: 22–23 octubre de 2026 (hora Paraguay).

**Estado:** DRAFT en `feature/mobility-monorepo-isolated-20261016` / PR #7; PostgreSQL desechable y backend LOCAL QA. No LIVE, no merge, no VPS, no acceso a datos/documentos reales.

## Problema de fondo

G2/G5 exigían compliance aprobado y licencia con fecha vigente; G17–G19 añadieron referencias privadas y revisión de licencia, pero las reglas de despacho originales **no consultaban el estado de la evidencia más reciente**. Eso permitía que un expediente antiguo aprobara la licencia en G2 mientras existía una nueva evidencia pendiente o rechazada en G17.

G20 une las dos condiciones, sin sustituir comprobaciones existentes ni otorgar habilitación LIVE.

## Implementación SQL — migración CI solamente

`apps/mobility-expo/docs/backend/staging_only/G20_DRIVER_KYC_PREFLIGHT_FENCING_POSTGRES_CI_ONLY.sql`

- Guardas estrictas de base: `qore_disposable_chain` y aplicación `qore_ci_disposable_chain`; no ejecutar SQL en Supabase remoto.
- RPC `mobility_stage_driver_current_license_approved(_driver_id)` de solo lectura `SECURITY INVOKER`, exclusivamente `service_role`, sin acceso `anon/authenticated`.
- Exige exactamente un rol persistido `driver` y toma **la licencia más reciente** por `submitted_at DESC, id DESC`, el mismo criterio de G17.
- La evidencia más reciente solo pasa si está en `approved`, tiene revisión auditada del mismo documento, mismo admin exclusivo, revisión posterior a la presentación y nunca permite autorrevisión. Una licencia más antigua aprobada NO rehabilita una más reciente pendiente/rechazada.
- Sobrescribe conservando los controles originales de G2 `mobility_vehicle_preflight` (AUTO) y G5 `mobility_stage_delivery_courier_preflight` (envíos AUTO/MOTO) y agrega esa condición.
- G4/G10 ya vuelven a llamar sus preflights cuando **se crea y se acepta** una oferta. Por tanto, un documento nuevo/rechazado impide aceptar ofertas que habían sido ofrecidas antes de la revocación.
- La licencia vencida G2, seguros, ubicación consentida y clearance de carga siguen siendo condiciones obligatorias. **Los pasajeros MOTO continúan bloqueados**; habilitar una moto para paquetes no autoriza transportar personas.

**Precisión crítica:** un documento aprobado es necesario, no suficiente. Tampoco se ha incorporado escáner de archivos real, proveedor Storage versión-inmutable ni certificados normativos por zonas. Nada aquí autoriza operaciones reales.

## Pruebas de extremo a extremo sobre esquema real

`G20_DRIVER_KYC_PREFLIGHT_ASSERT_POSTGRES_CI_ONLY.sql` se ejecuta **después** de G1–G18:
- Un Driver AUTO con evidencia antigua aprobada y nueva pendiente es rechazado.
- El admin aprueba la última: el preflight AUTO pasa junto con todos los controles originales.
- Se genera una oferta AUTO; cuando aparece una nueva licencia pendiente, la aceptación transaccional **falla** sin asignar al conductor.
- Una revisión rechazada mantiene el bloqueo. Una nueva evidencia revisada, con idempotencia y auditoría, puede restaurar la elegibilidad de QA.
- La caducidad explícita de la licencia G2 bloquea incluso si la evidencia G17 está aprobada.
- El courier MOTO es rechazado sin revisión; una licencia aprobada permite el *preflight de carga* sujeto a sus demás requisitos, pero el preflight de pasajeros MOTO sigue siendo falso.
- Una nueva licencia pendiente impide aceptar una oferta de envío previamente creada. Al aprobarla y revalidar el resto, la transacción es válida.
- Las pruebas respetan la restricción de **un viaje activo por conductor**; se cierra primero el viaje sintético G16 antes de ensayar una segunda asignación.

## Backend de estado — vista limitada y sin habilitar viaje

Ruta privada STAGING: `GET /v1/staging/driver/license-readiness`.

- `server/g20-driver-kyc-readiness-repository.mjs`: llama al único RPC interno.
- `server/g20-driver-kyc-readiness-gateway.mjs`: JWT confirmado, rol `driver` exclusivo consultado en servidor, limitador por actor, sin parámetros de conductor enviados desde móvil.
- `server/g4-loopback-http-transport.mjs`, `server/g4-staging-runtime.mjs` y OpenAPI: solo loopback `127.0.0.1`, sin CORS/cookies, `Cache-Control: no-store`, 503 sin servicio.
- En respuesta 200 devuelve únicamente `currentLicenseApproved` booleano junto a `mode=STAGING_DEMO_ONLY`, `verificationScope=CURRENT_LICENSE_REVIEW_ONLY`, `driverEligible=false`, `liveOperationsEnabled=false`. No informa documentación escaneada, rutas privadas, identidad admin ni disponibilidad de vehículo.

Aplicación independiente Driver:
- `apps/movete-driver/src/domain/driver-license-readiness.mjs` y archivos `.d.mts`/`.test.mjs`: lectura puntual con bearer externo, únicamente localhost QA, sin caché ni estado persistente; valida minuciosamente respuesta.
- Sin conexión real a Auth, sin estado de habilitación LIVE ni simulación de actividad como real. La pantalla de documentos debe incorporar esta lectura solo después de conectar una sesión STAGING autorizada.

## Dependencias sin resolver

1. Integración de autenticación real Driver y reconciliación de cuenta/session revocation en la nueva app móvil independiente; los bearer sintéticos no equivalen a un login productivo.
2. Documentación real: proveedor Storage con identidad y versión de objeto fiables, escáner real y auditoría aprobada para todas las clases de documentos; G19 falla cerrado sin ellos.
3. Verificar equivalencias legales/administrativas en Paraguay por ciudad y servicio; separar viajes AUTO, pasajeros MOTO y envíos de carga MOTO.
4. Integración explícita del check documental en documentación/compliance renovado y en las interfaces del conductor, sin editar código Cliente/Admin del Arquitecto B.
5. Pruebas con dispositivos Android/iOS y carga sintética bajo ambiente STAGING autorizado, con gates de pagos, GPS y disponibilidad.

**Control de autoría:** no modificar `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`; PR #7 permanece DRAFT y no se hace merge por cuenta propia.
