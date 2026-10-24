# QORE Mobile — Arquitecto B · Handoff Admin zonas, incidentes y carreras Auth
**Fecha:** 22 octubre 2026 · **PR:** [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) · **NO MERGE / NO LIVE**

## 1. Inventario de nuevos commits
| Commit | Propósito | Carpeta única B |
|---|---|---|
| `4ab0b543cf6a0f2b6ba63e0fd2009c1c54fb3512` | Eliminación de race de login tardío tras logout o refresh simultáneo, Cliente y Admin. KYC rechaza ACK de sesión reemplazada | Admin y Cliente |
| `427f19c37c650235b1e92957f431b43acd16bb9c` / `0e5d28925f126e72e074fae65f16a811186566bc` | Limpiar datos sensibles tras cambio de rol owner↔admin con mismo sujeto; test de recuperación de datos antiguos | Admin |
| `c1bab299221a89d905f6f6ceac8f0f475dab5765` | `zone-overview.mjs`: DTO de lectura de cobertura por municipio y tipo AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY. Datos de vehículos en línea no son oferta ni reserva real | Admin |
| `0d411f51b55708070b3687bf789265c0162f2f1c` | `admin-experience`, types y UI de zonas read-only; Owner no hereda permiso de zonas | Admin |
| `28af479e38d3d22ab849400e5ee74919f2969217` / `3e304c789dc17a5b6e4938195b7b641444d03399` | Resolver TTL de disponibilidad: a los 60 s se ocultan recuentos aunque no haya nueva comunicación del servidor | Admin |
| `a30604c1b41c923309c12eb6c77acb2d6b9f395d` | `incidents-overview.mjs`: DTO mínimo, sin nombre/ubicación/descripción, lectura solo de Admin | Admin |
| `3375ea31262fc44b851bf08c682bece65900ff82` | Conexión de la bandeja de incidentes a AdminRuntime y UI read-only | Admin |

## 2. Matriz de rol, privacidad y UI
| Función | `passenger` | `driver` | `admin` | `owner` |
|---|---:|---:|---:|---:|
| Cliente: preparar viaje/envío, cotización de su cuenta | Sujeto a Auth backend | No | No | No |
| Ver cola KYC mínima | No | No | Sí, con permiso de A | No implícito |
| Leer zonas por servicio (cobertura/vehículos declarados) | No | No | Sí, con permiso de A | No implícito |
| Leer metadatos de incidentes | No | No | Sí, con permiso de A | No implícito |
| Resumen de finanzas conciliadas | No | No | No | Sí, con permiso de A |
| Habilitar zona/suspender cuenta/cambiar comisión | NO | NO | NO en UI | NO en UI |

**Todos los sí anteriores son proyecciones locales propuestas**. La autorización final siempre está en el servidor, aún pendiente de certificación por A.

## 3. DTOs nuevos para A — NO endpoints confirmados
### GET /v1/staging/admin/zones/overview (propuesta)
- Escopo `admin.zones.read` y JWT admin con MFA efectivo, 401/403/429/503 y auditoría; máximo 200 filas, `revision` monotónica, `generatedAt` y `expiresAt` en epoch-ms, TTL <=300s.
- `items`: `zoneId` UUID, `municipality` texto, `serviceKind` `AUTO_RIDE|AUTO_DELIVERY|MOTO_DELIVERY`, `coverageStatus` `ACTIVE|PLANNED|PAUSED|CLOSED`, `eligibleByPolicy`, `onDutyVehicles` entero, `availabilityObservedAt` epoch-ms.
- Si recuento tiene más de 60s o no existe permiso, ocultar conteo. **Cobertura ACTIVE no significa conductores disponibles, ETA o despachos garantizados.**

### GET /v1/staging/admin/incidents/queue (propuesta)
- Escopo `admin.incidents.read`, rol Admin con MFA servidor, paginación autenticada, sin PII o campos sensibles por defecto.
- `items`: `incidentId` UUID, `category` `SAFETY|RIDE|DELIVERY|PAYMENT_SIMULATED|OTHER`, `severity` `LOW|MEDIUM|HIGH|CRITICAL`, `status` `OPEN|TRIAGED|INVESTIGATING|RESOLVED|CLOSED`, `createdAt` epoch-ms y `revision` monotónica.
- **No implica un centro de emergencias activo**. Acciones de suspensión, priorización y escalamiento siguen deshabilitadas hasta especificar procesos de seguridad/soporte y auditoría real.

## 4. Verificación real y limitaciones
- `4ab0b543`: control de ownership + Cliente/typecheck/domain/web export #39890156697 / #39890156655 **SUCCESS**; el CI de Cliente ejecuta pruebas de carrera añadidas.
- `0d411f51`: ownership #39890466190 SUCCESS; Client/Driver isolation #39890466173 SUCCESS.
- El código Admin posee pruebas unitarias `src/*.test.mjs` nuevas de Auth, KYC, zonas, incidentes, finanzas y roles, pero **las Actions actuales NO EJECUTAN Admin**.
- El job Admin debe incorporarlo el Arquitecto A en su carpeta `.github/**`. Se ha solicitado en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). Comandos desde `apps/movete-admin`:
  `npm install --ignore-scripts --no-audit --no-fund`
  `npm run check`
  `npm run build`
- Después de CI Admin, todavía faltan Auth Admin real, MFA, endpoint versionado, RLS/DB, pruebas E2E en navegador, seguridad de documentos y aprobación final del Owner. **No declarar finalizada la app**, sin medios de pago reales.
- El desarrollo permanece en `apps/movete-admin/**`, `apps/movete-cliente/**` y `docs/architect-b/**`; sin cambios a Driver, backend, SQL, workflows o migraciones.

## 5. Próximas acciones del Arquitecto B
1. Al recibir contratos de A, integrar `readZones` y `readIncidents` solo mediante gateway autenticado, con cancellation, 401/403, retry, revisión y pruebas adversariales.
2. Completar auditoría de permisos y exposición de datos antes de habilitar paneles de producción.
3. Diseñar el ciclo de soporte y auditoría administrativa con datos redactados.
4. Certificar Admin mediante CI independiente y test navegador real sin datos personales.
5. Entregar a Lovable **solo interfaz visual** cuando infraestructura y gates estén verificados.

**No hay bloqueos para continuar preparando validadores y UI; hay bloqueos reales para activar datos y operaciones externas.**
