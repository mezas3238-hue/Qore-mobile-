# QORE Mobile — Candidato UNIFICADO A+B+C+D, misma revisión

**27 octubre 2026 · Sin merge de PR #7/#8/#19/#20 · Sin deploy · No LIVE**

## Objetivo del Owner

Dejar de contar suites unitarias independientes como progreso. Una única versión del sistema debe permitir **Cliente solicitar → Backend precotizar y persistir → Driver recibir y aceptar → completar/entregar → Admin auditar el mismo ID y comisión Owner**.

## Primera acción de integración real

Se crea la rama `integration/qore-mobile-e2e-four-apps-20261027` desde A, incorporando los árboles **íntegros** de:
- **Backend A:** SHA `b3fabd3632b5f1ff5735d689783edf519b2d1385` (PG16, G73/G98, G124/G128/G130).
- **Cliente B:** SHA `5c66e1616e0e75ac73b88b0b4ab6683536406bb6` (B25, flujos AUTO/MOTO, G5-G121, G7/G122/G126, G68, tarifas del servidor).
- **Driver C:** SHA `e025177f6125a9322bc90e763578f4d9d770f92e`.
- **Admin D:** SHA `2f71f6672ac6f29b4092bddb8a31df9c000be75a`.

Se conserva A para los componentes de backend, B para **únicamente** `apps/movete-cliente`, C para **únicamente** `apps/movete-driver` y D para **únicamente** `apps/movete-admin`. No se fusionan ni se cambian sus ramas; la rama de integración es otra versión explícita.

La ejecución G98 A↔B ya tenía una debilidad: hacía checkout del Cliente desde un commit B obsoleto. Se elimina esa copia: ahora importa la máquina de estados Cliente directamente **del mismo árbol** `apps/movete-cliente/src/domain`. En ese escenario, Node HTTP y SQL PostgreSQL persisten y vuelven a leer el mismo viaje en A, B y auditoría del backend. No hay simulación del almacenamiento. Las sesiones son QA y las rutas son sintéticas hasta conectar proveedor autorizado.

## Criterio de aceptación real del Owner (NO cumplido aún)

1. Entorno STAGING confiable en Render + PostgreSQL/Supabase existente/autorizado, Auth JWT, secretos server-only, geocoding, cobertura, peajes y cuota real de Geoapify sin sobrecostos.
2. Tarifas por servicio y vehículo aprobadas y modificables por Owner **desde la interfaz D**, incluidos COMERCIOS por categoría; aplicar versión de regla a nuevas precotizaciones. Subsidio 10% fijo en pasajeros, no en carga.
3. **Un viaje real** AUTO y MOTO: Usuario registrado hace precotización verificada, acepta precio, crea orden; Driver legalmente elegible G38/G71 recibe oferta privada, acepta y finaliza, sin bypass; Cliente y Admin observan mismo tripId/ledger.
4. **Un envío real** AUTO y MOTO: cotización ANTES del request, carga legal, mismo deliveryId de B a C y Admin, recolecta, entrega con prueba y liquidación auditable.
5. **Comercios**: catálogo/stock, merchant elegible, costo productos más movilidad, comisiones Owner independientes y fulfillment Driver, recibos de servicio.
6. Pruebas de operación REAL de la versión desplegada, no una secuencia de fixtures; luego release Store aprobado por Owner.

## Bloqueos verificados

- **La conexión Supabase actual devuelve `projects: []`**. No hay proyecto visible donde desplegar el backend o inspeccionar esquema de STAGING real.
- Render devuelve el workspace `My Workspace` pero exige que el propietario confirme qué workspace usar. No se crea ni despliega ningún servicio sin esa confirmación y aprobación de costos/configuración.
- Las rutas G128 y cuotas G130 están implementadas en entorno CI/fixtures, pero el enlace a un proveedor y PostgreSQL STAGING autorizados está pendiente.
- G98 **rechaza intencionalmente la aceptación real de Driver sin G38/G71**; no se falsifica KYC/seguro/legal.
- Admin D contiene permisos de lectura QA y flags OFF por defecto. El contrato de comisiones COMMERCE y pagos PSP no está certificado.
- No se puede presentar un checkout QA con token sintético ni build Expo como app funcionando de punta a punta.

## Ejecución en GitHub

El workflow `qore-four-apps-unified.yml` verifica que Cliente, Driver, Admin y Backend comparten el mismo commit y pueden compilar. El workflow `mobility-g4-postgres-disposable.yml` debe ejecutar el recorrido real HTTP ↔ PostgreSQL ↔ Cliente B integrado ↔ auditoría Admin sobre la misma rama, ya **sin** commit B desactualizado. Esta demostración sigue siendo STAGING de ingeniería, NO prueba comercial con conductor/PSP real.

**Sin merge, Live, despliegue o gastos antes de autorización explícita.**
