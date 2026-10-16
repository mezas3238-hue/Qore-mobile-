# Continuidad de ingeniería — G0/G1 — 2026-10-16

## Acción G0 realmente aplicada
- Se trasladan los blobs originales de movilidad del HEAD PR #3 `e06f110...` a `apps/mobility-expo/` en una rama nueva **desde main**, sin escribir en PR #2 ni editar `main`.
- Workflows ROOT separados (`.github/workflows/mobility-ci.yml`). Antiguo `.github/workflows/ci.yml` de Expo NO copiado a raíz.
- `docs/adr/0010-two-product-isolation.md` explica estrategia de monorepo, aislamiento de seguridad y criterios de revisión.
- La fuente de movilidades PR #3 se conserva como borrador/historia hasta confirmar paridad y proceso de merge.
- Se agregan tests de validación pasajeros/registro auto y bloqueo runtime de viajes, además de un guard CI que verifica los package IDs y `LIVE_TRIPS_ENABLED=false`.
- No se han hecho modificaciones en Supabase, entorno Lovable, pasarela, mapas ni dispositivos físicos.

## Inspección del backend Lovable (read only)
- Proyecto ID `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, no publicado; backend Supabase habilitado.
- Consulta de `information_schema.columns` confirma tablas `driver_applications`, `profiles`, `user_roles`, `vehicles`, `rides`, `fare_configs`.
- `vehicles`: `category` enum sin `vehicle_type`, sin `insurance_verified`; `rides`: `driver_id` pero sin `vehicle_id`, sin versión de tarifa, sin quote_id.
- Consultas adicionales pg_policies/pg_proc quedaron **NO EJECUTADAS**: límite de acciones SQL del plan gratuito de Lovable, respuesta indicó reintentar en 44 minutos. No afirmar RLS segura por esta inspección.
- NINGUNA consulta SQL mutó datos ni leyó datos privados de usuarios.

## Próximo trabajo prioritario G1 (pendiente / sin afirmar completado)
1. Recuperar permisos de consulta y crear SNAPSHOT de RLS, SECURITY DEFINER, grants y migraciones reales del backend; revisar tablas/índices/roles y bucket privado.
2. Preparar entorno Supabase **staging separado** con URL/key publicable propia; verificar confirmación correo, signup/login/logout/revocación, perfiles y roles.
3. E2E con dos pasajeros, dos conductores AUTO, vehículos y admin asignado mediante servidor; probar RLS de aislamiento y prohibición de autopromoción; documento privado.
4. Solo después preparar migración additive vehicle_type AUTO/MOTO, service_category moto_pasajero, vehicle_id y verificación de documentos/seguros por autoridad local.
5. No habilitar categoría comercial moto ni viajes/cobros. FairPrice en UI es hipótesis; 15% en fare_configs Supabase es seed, no precio de producción.
6. Validar en CI rama de este PR, y test Android/iOS físicos por separado; export web NO certifica SDK nativo.

## Puertas no satisfechas
Legalidad remunerada moto por municipio, póliza comercial por categoría, verificación KYC, provisión PSP/QR, rutas Google Routes server-side, RLS, replay/idempotencia, ledger reconciliable, SOS operativo y pilotos.
