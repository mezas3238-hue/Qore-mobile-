# QORE Mobile — Gate Auth STAGING y laboratorio de tarifas (2026-10-17)

## Qué está implementado

- `scripts/staging-auth-policy-gate.mjs` consulta **solo lectura** `GET /auth/v1/settings` del Supabase STAGING referenciado por variables servidor; no crea usuarios ni escribe en Auth. Rechaza la ref del backend anterior `qdqrlgzlotnfdxzpacxs`, claves `service_role` / `sb_secret_*` y configuración incompleta. Para aprobar exige **`disable_signup === true`** devuelto por el servidor.
- `scripts/staging-auth-policy-gate.test.mjs` reproduce mediante respuestas controladas la configuración abierta, cerrada, ausente y errores HTTP; `mobility-ci.yml` ejecuta pruebas sin claves reales en GitHub Actions.
- **Ejecución remota pendiente:** no se dispone en GitHub ni en chat de la referencia pública y clave publishable exactas del Supabase STAGING nuevo. No incluir credenciales ni credenciales privadas en el PR o los logs. La última lectura de Auth comunicada por Lovable sigue siendo `disable_signup=false`; no asumir que el estado ha cambiado por ocultar el botón.
- `src/domain/tariff-lab.ts` es una función pura de **investigación**, con importes **hipotéticos** expresados en guaraníes enteros; calcula precio pasajero, comisión de plataforma en puntos básicos y bruto del conductor **antes de combustible, mantenimiento, seguros, impuestos y costes del cobro**. El resultado siempre declara `status=RESEARCH_ONLY` y `commercialRidesEnabled=false`. No genera factura, reserva, viaje, cobro ni habilitación comercial MOTO.
- `src/domain/tariff-lab.test.ts` cubre redondeo entero, mínimo, conciliación de la comisión, entradas no numéricas, recorrido inválido y MOTO bloqueada. No son cifras verificadas de Bolt, Uber, taxis paraguayos ni asesoramiento legal.

## Verificación segura del cierre de signup

En el editor Lovable del proyecto STAGING aislado `9c677bb2-746b-419f-ad9c-dd6d26bab944`, entrar a Más → Cloud → Users → Auth settings, y activar **Disable sign-up** si todavía está desactivado. No cambiar automáticamente el estado de las verificaciones de contraseñas o política HIBP, ya que el conector no deja preservar esos valores con garantías.

Cuando exista la referencia nueva **verificada** y su clave publishable (NO enviar service_role al chat, frontend, repo ni CI), ejecutar en máquina autorizada:

```bash
cd apps/mobility-expo
QORE_MOBILITY_ENV=staging \
QORE_STAGING_PROJECT_REF='<NUEVA_REF_STAGING>' \
QORE_STAGING_ANON_KEY='<CLAVE_PUBLICA_STAGING>' \
node scripts/staging-auth-policy-gate.mjs
```

Esto debe acabar en `PASS` para habilitar la **siguiente fase de pruebas**, pero NO certifica de por sí el aislamiento JWT de usuarios ni la imposibilidad de nuevas cuentas de invitación. Probar luego con **dos usuarios ficticios preprovisionados** (sin alta abierta), mediante `scripts/staging-auth-readonly.mjs`, y posteriormente Storage REST adversarial.

## Metodología de precios pendiente de mercado

Antes de activar tarifas, levantar evidencia externa y local de precio base, km, minuto, mínimo, comisión real, retenciones, cancelaciones, tarifa dinámica, descuentos y coste de adquisición para Bolt/Uber/taxis/motos en Paraguay. Distinguir tarifa visible al pasajero, ingreso bruto del conductor y beneficio real después de gastos; evitar tratar promociones aisladas como precios universales.

Un responsable debe aprobar por ciudad, fecha y servicio las políticas de precios, las rutas de proveedor confiable y la cobertura de seguro/municipal. El simulador **no** establece tarifas por defecto ni autoriza despachos.

## Garantías de aislamiento

Lovable anterior no se modifica. PR #7 es DRAFT, Flutter trading PR #2 sin alterar, `LIVE_TRIPS_ENABLED=false`. Las ocho RPC antiguas de viaje continúan bloqueadas. El gateway G2 sigue local y sin exposición pública. El Supabase remoto ya tiene G1/G2 con auditoría de vehículos pendientes, pero **sin E2E Auth ni pagos**.
