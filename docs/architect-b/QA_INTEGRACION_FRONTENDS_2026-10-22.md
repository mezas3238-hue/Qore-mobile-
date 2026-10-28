# Movete Fácil — QA de integración Frontends B (22 octubre 2026)
**Propietario:** Arquitecto B · [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT · ramas exclusivas. **No LIVE, no merge, no pagos reales, no documentos reales.**

## Resultado verificable de esta ronda
- `b5640dd58775249f72afbdd76f4c751a0a64927b`: creó `apps/movete-cliente/src/domain/client-experience.mjs`, composición efímera de sesión, mutación idempotente, cotización, seguimiento y privacidad de historial. Pruebas `client-experience.test.mjs` para cambio de actor, petición repetida, logout/fallo de revocación, ubicación, datos ajenos y respuesta tardía. [CI Cliente/isolation #39884794024](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39884794024) **SUCCESS**.
- `1f226178fa9ffffca819ca84e975d44564e21950`: agregó `ClientRuntime.tsx`, contrato .d.mts y conectó las cuatro pantallas Expo `seguimiento`, `historial`, `cotizacion`, `cuenta` al estado común. Provider de UI **sin Auth/API por defecto**, sin solicitar viajes ni mostrar GPS falso. [CI Cliente/isolation #39885053406](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39885053406) **SUCCESS**.
- `010f2f50fa7a0cfdbe942fed486e92d6bd955a61`: suscripciones/actualizaciones de sesión y refresco de vista mientras está enfocada, cada cinco segundos, **sin hacer llamadas de red por ese temporizador**. Evita que GPS/ETA y cotización expirados permanezcan dibujados sin evento. [CI Cliente/isolation #39885185094](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39885185094) **SUCCESS**.
- `0f549954ed7cfea3a31face593b03088f2fc6abb`: `admin-experience.mjs` y tests para unir sesión Admin/MFA, cola KYC, cambio de cuenta, 403, relectura tras decisión y ausencia de permisos optimistas. Aún **sin validación independiente de Admin en CI**.
- `912a6cb966de175159c48f6099dbd643635549b7` y `caabeffb2aaa0a33fe5241c7dfa05d507df0cfa9`: AdminRuntime React + vistas KYC de solo lectura con whitelist de campos y TTL; mantuvo la bandeja de entrenamiento claramente sintética cuando no existe Auth real. Corrigió colisión local de variable `view` en TypeScript. Control de propiedad de archivos aprobado; comprobar CI más reciente por SHA. **No asumir que el build Admin pasó.**

## Arquitectura en uso
```
Movete Fácil Cliente (Expo, paquete com.movetefacil.cliente)
  ClientRuntimeProvider (sin conexión predeterminada)
    client-experience (sin datos persistentes)
      client-session -> tokens efímeros, roles Passenger
      client-mutations -> idempotencia / retries / rechazo del doble toque
      quote-view -> Gs server-derived, vencimiento
      rider-polling + rider-status -> revisiones, TTL GPS, sesión propia
      history-feed -> paginación estrictamente propia
    Pantallas de lectura: cuenta / seguimiento / historial / cotización

Movete Fácil Admin (React web, NO móvil)
  AdminRuntimeProvider (sin conexión predeterminada)
    admin-experience
      admin-session -> Admin MFA efímero
      kyc-queue -> DTO mínimo, protección PII, TTL
      admin-access -> POST revisión condicionado a API certificada
    Pantalla KYC: entrenamiento sintético o lectura autorizada, jamás aprobación optimista

Movete Fácil Driver: rama A, app separada, **no tocada por B**.
```

## Mapa de fallos esperados y cobertura
| Caso | Resultado esperado |
|---|---|
| Sin token, rol driver en Cliente o Passenger en Admin | No lectura, no solicitud |
| Cambio de cuenta con sesión activa | Borrar precios, historial, ubicación, token temporal |
| Logout remoto fallido | Borrar estado local y señalar revocación no confirmada |
| Timeout de viaje | Mantener requestKey; reintento solo explícito |
| Dos taps simultáneos | Una única mutación en vuelo |
| Viaje sin aceptación persistida | No identidad, placa, GPS ni ETA |
| GPS viejo o sin red | Ocultar coordenadas/ETA; no inventar cierre |
| Cotización vencida | Ocultar Gs; jamás cobrar por teléfono |
| Historial ajeno | Rechazar respuesta y borrar lista |
| Cola KYC con PII o caducada | Rechazar respuesta y no mostrar documentos |
| Decisión KYC en frontend | Requiere respuesta autorizada; limpiar cola y reconsultar |

## Dependencias de A / bloqueos reales
**Contrato OpenAPI observado en última lectura A:** `version=1.0.0-g11`, 39 rutas (antes 34), todavía sin Auth Passenger/Admin versionada, consulta de historial pasajero, lectura cola KYC, cancelación Rider independiente ni respuestas específicas completas de Estado/Tarifa. **39 rutas no equivalen a 39 endpoints desplegados.**

1. A define Auth Passenger/Admin, MFA Admin auditado, expiración/revocación y matriz rol/actor. No service_role en JS/Expo.
2. A publica DTOs tipados con response status/quote/history/KYC/merchant para consumo B, revisión/TTL/permisos/códigos 401,403,409,410,429,503.
3. A valida staging HTTPS de QA, JWT/roles reales, escenarios adversariales, RLS/Storage y disponibilidad del gateway. Sin autorización LIVE.
4. **A añade job específico Admin WEB** ejecutando `cd apps/movete-admin && npm install --no-audit --ignore-scripts && npm run check && npm run build`. B no tiene permiso de editar `.github/**`. El CI de aislamiento actual solo verifica Cliente y Driver; nunca atribuirle build Admin.
5. El Arquitecto B continúa pruebas UI/accesibilidad y luego integración usando solo `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

**Contratos pendientes centralizados en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).**
