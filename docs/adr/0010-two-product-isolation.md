# ADR-0010 — Separación estricta de productos QORE Mobile
Fecha: 2026-10-16
Estado: PROPUESTA TÉCNICA IMPLEMENTADA EN RAMA DRAFT; NO AUTORIZA MERGE NI OPERACIÓN COMERCIAL
Issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/6

## Contexto verificado
En el mismo repositorio existen dos PR drafts desde el mismo main (ef059e1132b10ce3adf1f3f6bc1f84e8ce529ad6):
- #2, rama agent/qore-mobile-foundation-001, Flutter supervisión de trading + Python Gateway, HEAD 4608aeb2519262cef42f722b43caffdfd455701b.
- #3, rama feature/viajeya-expo-mvp-20261015, React Native/Expo movilidad, HEAD e06f110137c0b2fae43188d500a6a8cfa0b3b7d1.

La app de trading NO es plataforma de transporte. PR #2 contiene `apps/mobile/`, `gateway/`, `contracts/`, `ops/`, widgets y workflows dedicados. Esta rama NO altera ninguno de esos archivos.

## Decisión técnica reversible para G0
Organizar un MONOREPO CON AISLAMIENTO FÍSICO:
- `apps/mobile/`: Flutter trading (conservar nombre/rutas presentes en PR #2; no renombrar aquí).
- `gateway/`, `contracts/`, `ops/`: exclusivamente trading, bajo PR #2.
- `apps/mobility-expo/`: aplicación Expo de transporte, importada fielmente desde el PR #3.
- `.github/workflows/mobility-ci.yml`: CI ejecutado con `working-directory: apps/mobility-expo`, rutas filtradas, sin utilizar workflows de trading.
- Infraestructura de movilidad en `apps/mobility-expo/` o servicios dedicados futuros, SIN reutilizar base de trading.
- `docs/adr/0010-two-product-isolation.md`: contrato común de no interferencia.

Se conserva el PR #3 y su historia como referencia original, SIN cerrar ni fusionar automáticamente; esta rama presenta un traslado por blobs originales para evitar un merge raíz a raíz. `main` no se modifica sin revisión.

## Limites obligatorios
1. CERO importaciones de negocio, usuarios, roles, secretos, contratos o servicios entre trading y movilidad.
2. Identidades de app separadas: movilidad `com.qore.viajeya` (PROVISIONAL, sujeto a comprobación de colisiones en stores); trading conserva su propia identidad. No reutilizar push IDs, mapas, dominio auth ni consentimientos.
3. Entornos movilidad dev/staging/prod aislados del Gateway/MT5; Supabase con migraciones versionadas, RLS y revisión humana. No publicar service_role ni credenciales; exigir llaves Maps por plataforma/huella y pasarela solo en servidor.
4. Operación de movilidad permanece `LIVE_TRIPS_ENABLED=false` sin cobros; Flutter sigue read-only respecto a trading.
5. Revisión de CI de ambos stacks por separado; no se puede afirmar que PR #2 pase solo porque pase Expo.
6. No ejecutar migraciones destructivas en Lovable/Supabase antes de snapshot de esquema, revisión RLS/RPC y ambiente staging.
7. Marcas/nombres e identificadores finales, propiedad del dominio, políticas y contratos son decisiones de entrega, no presupuestos automáticos.

## Opciones descartadas por ahora
- Merge directo PR #3 a raíz de PR #2: alto riesgo de reemplazar README, CI, root package e identidad app.
- Fusionar Flutter y React Native en un runtime o un auth compartido: no corresponde a estos productos.
- Crear repo nuevo inmediatamente: alternativa viable si el equipo prioriza ownership e infraestructura separados; esta propuesta no impide futura extracción con historial.

## Criterios de aceptación G0
- El árbol de movilidad está bajo `apps/mobility-expo/`, nunca `app/` o `src/` de raíz.
- CI de movilidad solo instala/ejecuta tests y export web desde su subdirectorio.
- Preservar íntegra la historia y archivos de trading en PR #2; comprobar CI propio de Flutter antes de futuros merges.
- Auditar diff y comprobar que los únicos nuevos paths raíz son `apps/mobility-expo/**`, `.github/workflows/mobility-ci.yml`, y este ADR.
- Verificación posterior de ambas ramas y distinción producto al desplegar.
- Mantener ambos PR drafts; el movimiento NO demuestra que la app esté lista.

## Fuente y verificación
Handoff: `apps/mobility-expo/docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_MOVILIDAD_2026-10-16.md`.
Issues #4, #5, #6. Baseline CI Expo anterior: run 38823736658 (14 tests, export web).
Este ADR no resuelve todavía los E2E Supabase ni permisos/seguros/cobros.
