# QORE Mobile / Movete Fácil — ACTA R60 DE CERTIFICACIÓN INTEGRAL (NO_GO)

**Fecha del corte:** 2026-10-24 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **PR #8 DRAFT** · **Alcance:** Arquitecto B, sin tocar archivos de A ni activar LIVE.

## Regla soberana e innegociable
La instrucción Owner es **«Todo tiene que estar certificado, sin ambigüedades»**. Bajo esa regla, **una función no está terminada por tener código o CI verde**. Solo puede aspirar a aceptación cuando se acredita su comportamiento completo, con seguridad negativa, integración real, persistencia y cuando corresponda pruebas de dispositivo y revisión operativa. Un resultado web/CI no se transforma en evidencia física. Ningún test sintético se etiquetará E2E real.

**Estado actual inequívoco:**
- **Lanzamiento:** NO_GO. **Certificados para operación comercial:** **0 de 17 gates P0**.
- **Inventario fuente A:** 15 gates `blocked`; 2 `qa-only` (PostgreSQL disposable y chat transport QA). El resto carece de evidencia completa de producción.
- **Flujos funcionales del producto:** 20 circuitos que deben cerrarse y auditarse; **0 declarados certificados**. La existencia del flujo de código no es el certificado del circuito funcional.
- **Fuente de datos:** `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json` de Arquitecto A, observado en SHA `dff966f340fd463f4597df7014853ed3912b5f19`. Es una **instantánea fija** y NO sustituye nueva lectura del HEAD A al solicitar GO.
- **Última CI previa B comprobada:** SHA `a631eb8444370f1fafaf8773778ac40505c60f18`, ownership/Admin/two-app isolation 3/3 SUCCESS; QA automatizada, no certificación operativa. Arquitecto A SHA `dff966f340fd463f4597df7014853ed3912b5f19` tenía 4/4 SUCCESS, pero no habilita operación.

## Cómo se evalúa sin permitir falsas certificaciones

**Registro canónico de R60:** `docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json`, formato máquina `qore-mobile-r60-v1`.

**Verificador independiente de UI:** `apps/movete-admin/src/release-certification.mjs` con suite `release-certification.test.mjs` ejecutada por QA de Admin Web. Se verifica que:
1. **No falta ninguno** de los 17 gates y 20 flujos, ni hay duplicados.
2. El inventario espejo mantiene IDs, responsables y estados de la fuente soberana A (test que lee ambos JSON en la misma rama).
3. Una etiqueta `CERTIFIED` sin todas sus pruebas obligatorias **es inválida**; también es inválida si A todavía marca ese gate bloqueado o QA-only.
4. Los tipos de evidencia deben corresponder al ambiente: `ANDROID_DEVICE` requiere `ANDROID_PHYSICAL`; `IOS_DEVICE` requiere `IOS_PHYSICAL`; `STAGING_E2E` no se acredita mediante `CI_QA`, `LEGAL_REVIEW` requiere revisión específica.
5. Se rechazan enlaces de evidencia HTTP, externos no aprobados, con query/secret o SHA inválido. La estructura de metadatos sola **NO prueba la autenticidad** de la ejecución: cada enlace debe verificarse de forma independiente.
6. El resultado del verificador es **siempre NO_GO** y como máximo `readyForIndependentAudit`. Solo un acto independiente firmado y una **orden explícita del Owner** pueden permitir, en otro control separado, pasar a GO. Cambiar un campo booleano del JSON no autoriza LIVE.

**Estados estrictos:**
- `BLOCKED`: faltan dependencias, pruebas o alcance completo.
- `QA_ONLY`: pruebas de código, laboratorio o entorno aislado; aún no es función final certificada.
- `CERTIFIED`: solo utilizable después de evidencias completas y validadas externamente; **ningún gate/flujo está así ahora**.
- `NO_GO`: el único estado de lanzamiento vigente.

## Los 17 controles P0, con pruebas obligatorias por tipo

| Nº | Gate | Propietario | Estado | Tipos de evidencia exigida |
|---:|---|---|---|---|
| 1 | `IDP_BACKEND_AUTH` | A | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E |
| 2 | `HTTPS_BACKEND` | A | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E |
| 3 | `POSTGRES_PERSISTENCE` | A | QA_ONLY | DOMAIN_CI · NEGATIVE_SECURITY · STAGING_E2E · POSTGRES_DURABILITY |
| 4 | `DRIVER_ONBOARDING` | A | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E · ANDROID_DEVICE · IOS_DEVICE |
| 5 | `DRIVER_LIVE_TRIPS` | A | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E · ANDROID_DEVICE · IOS_DEVICE |
| 6 | `CLIENT_LIVE_BOOKINGS` | B | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E · POSTGRES_DURABILITY · ANDROID_DEVICE · IOS_DEVICE |
| 7 | `PAYMENT_SETTLEMENT` | A/B | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E · PSP_RECONCILIATION |
| 8 | `PRIVACY_KYC` | A/B | BLOCKED | NEGATIVE_SECURITY · STAGING_E2E · LEGAL_REVIEW |
| 9 | `EMERGENCY_SAFETY` | A/B | BLOCKED | NEGATIVE_SECURITY · STAGING_E2E · ANDROID_DEVICE · IOS_DEVICE · OPS_EXERCISE |
| 10 | `MAPS_GPS_DEVICE` | A/B | BLOCKED | STAGING_E2E · ANDROID_DEVICE · IOS_DEVICE · NEGATIVE_SECURITY |
| 11 | `DELIVERY_MERCHANTS` | A/B | BLOCKED | API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E · POSTGRES_DURABILITY · ANDROID_DEVICE · IOS_DEVICE |
| 12 | `CHAT_PHYSICAL` | A/B | QA_ONLY | DOMAIN_CI · NEGATIVE_SECURITY · STAGING_E2E · ANDROID_DEVICE · IOS_DEVICE |
| 13 | `ADMIN_OPERATIONS` | B | BLOCKED | DOMAIN_CI · API_CONTRACT · NEGATIVE_SECURITY · STAGING_E2E |
| 14 | `NATIVE_RELEASES` | A/B | BLOCKED | DOMAIN_CI · ANDROID_DEVICE · IOS_DEVICE · NEGATIVE_SECURITY |
| 15 | `LEGAL_COMPLIANCE` | Owner | BLOCKED | LEGAL_REVIEW · OWNER_SIGNOFF |
| 16 | `OPS_24_7_MONITORING` | Owner/A/B | BLOCKED | OPS_EXERCISE · STAGING_E2E |
| 17 | `PROD_GO_NOGO` | Owner | BLOCKED | OWNER_SIGNOFF · OPS_EXERCISE · LEGAL_REVIEW |

## Los 20 circuitos funcionales que debemos cerrar

| Nº | Recorrido funcional | Responsable | Certificación |
|---:|---|---|---|
| 1 | `AUTH_PASSENGER` | B | BLOCKED |
| 2 | `AUTH_DRIVER_KYC` | A | BLOCKED |
| 3 | `FARE_QUOTE_GS` | A+B | BLOCKED |
| 4 | `AUTO_BOOKING` | B | BLOCKED |
| 5 | `DRIVER_DISPATCH` | A | BLOCKED |
| 6 | `GPS_TRACKING` | A+B | BLOCKED |
| 7 | `TRIP_COMPLETION_CANCELLATION` | A+B | BLOCKED |
| 8 | `MOTO_CARGO_DELIVERY` | A+B | BLOCKED |
| 9 | `AUTO_CARGO_DELIVERY` | A+B | BLOCKED |
| 10 | `SUPERMARKET_ORDER` | A+B | BLOCKED |
| 11 | `PHARMACY_OTC_ORDER` | A+B | BLOCKED |
| 12 | `RESTAURANT_ORDER` | A+B | BLOCKED |
| 13 | `CUSTOMER_DRIVER_CHAT` | A+B | BLOCKED |
| 14 | `PAYMENTS_REFUNDS` | A+B | BLOCKED |
| 15 | `COMMISSIONS_PAYOUTS` | A+B | BLOCKED |
| 16 | `ADMIN_KYC_ZONES` | B | BLOCKED |
| 17 | `EMERGENCY_RESPONSE` | A+B | BLOCKED |
| 18 | `DATA_PRIVACY` | A+B | BLOCKED |
| 19 | `SIGNED_NATIVE_RELEASES` | A+B | BLOCKED |
| 20 | `ZONE_ACTIVATION_SUPPORT` | Owner+A+B | BLOCKED |

Cada circuito tiene criterio de aceptación detallado y dependencias explícitas en el JSON. El estado `BLOCKED` no significa ausencia total de código; significa **ausencia de certificación integral de extremo a extremo**.

## Ruta crítica de certificación (sin invertir el orden)

1. **A — Fundamentos obligatorios:** IdP real Passenger/Driver/Admin, HTTPS accesible desde móviles en STAGING autorizado, roles y revocación server-side, PostgreSQL duradero y backups/restore.
2. **A+B — Circuito AUTO:** Cliente solicita (una clave) → contrato OpenAPI y recibo persistente → oferta atómica Driver → acepta → tracking → inicia y completa o cancela → historial verificable. Probar timeout, doble click, reasignación, JWT rotado, pérdida de GPS y caída de red.
3. **A+B — Envíos/comercios:** moto y automóvil para cargas; supermercados/farmacias OTC/restaurantes con stock y entrega; mensajería segura y confirmaciones de custodia; sin moto pasajero.
4. **A+B — Dinero y seguridad:** PSP aprobado, comisiones/cobros/refunds/ledger reconciliados, KYC/documentos, auditoría, SOS físico, soporte, permisos legales Paraguay.
5. **A+B — App real instalable:** builds Android AAB y iOS IPA firmados de **dos aplicaciones independientes**; pruebas de GPS, permisos, cierre/reanudación, push y cambios de sesión en dispositivos físicos. Admin Web probado contra STAGING real.
6. **Owner — Decisión final:** revisar cada evidencia, los 17 P0, la cobertura legal/operativa, firmar aprobación y autorizar por separado merge, producción, PSP y despliegue. Hasta esa orden **NO MERGE, NO LIVE, NO DEPLOY**.

## Qué hacer cuando hay una evidencia nueva

El responsable genera una prueba reproducible y documento firmado dentro de GitHub, con **commit SHA de 40 caracteres, URL exacta, fecha UTC, actor verificador y entorno**. Se verifica la prueba realmente; se actualiza matriz y se repiten los controles del MISMO SHA. Si falta una sola evidencia o el test falla, el gate **no pasa**. Actualizar el baseline soberano en rama A requiere coordinación; B jamás debe cambiar gates de A para forzar una cifra.

## Nota sobre Lovable

Lovable continúa siendo únicamente la última capa visual autorizable. No resuelve IdP/PSP/backend, pruebas nativas, seguros o certificación E2E. **Primero funciones completas y certificadas; luego interfaz final y publicación bajo orden Owner.**
