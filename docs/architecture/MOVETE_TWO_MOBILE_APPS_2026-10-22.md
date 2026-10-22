# Movete Fácil — dos apps móviles independientes

**Decisión obligatoria del Owner: DOS aplicaciones instalables distintas**, NO una app con un conmutador de roles.

| Proyecto | Audiencia | Paquete Android y bundle iOS | Esquema de enlaces |
|---|---|---|---|
| `apps/movete-driver/` | Conductores y repartidores | `com.movetefacil.driver` | `movetefacildriver` |
| `apps/movete-cliente/` | Pasajeros y remitentes | `com.movetefacil.cliente` | `movetefacilcliente` |

Ambas apps incluyen **su propio** `package.json`, `app.json`, rutas Expo y compilación CI. No tienen imports entre ellas ni desde `apps/mobility-expo`. El verificador `scripts/check-mobile-boundaries.mjs` hace fallar el CI si se mezclan pantallas, identificadores o imports.

## Funciones exclusivas

**Driver**: registro y verificación del conductor/vehículo, documentación privada, disponibilidad autorizada, ofertas dirigidas al conductor, aceptación/rechazo, navegación, ingresos y liquidaciones.

**Cliente**: registro del pasajero, solicitar AUTO y envíos, visualización de tarifa y ETA verificados, seguimiento, historial, pagos y soporte. Los viajes **de pasajeros** en moto permanecen deshabilitados hasta verificación legal por zona; la mensajería en moto requiere habilitación separada.

## Estado operativo exacto

Los nuevos proyectos son proyectos Expo **independientes con pantallas funcionales de demostración local y validación de formularios**. Sus identificadores nativos y rutas quedan separados. **NO** conectan todavía autenticación real, viajes reales, pagos, GPS ni notificaciones push. Ningún botón simula una operación como realizada en el backend. Web export en CI **NO equivale** a Android/iOS firmadas ni a publicar en tiendas.

La antigua `apps/mobility-expo/` continúa intacta **solo como laboratorio/harness mixto de investigación y pruebas** hasta extraer o adaptar cada contrato server-side; no se debe lanzar como Cliente ni Driver ni renombrar de forma engañosa.

El backend compartido sigue siendo QORE Mobile (G1–G15: Auth, roles, documentación, despacho, G5/G10/G13/G15, seguridad, precios); la app del cliente y la del conductor nunca deben compartir sesiones, menús, documentos locales ni estado UI. La autorización se hará siempre en el servidor por identidad JWT verificada; nunca mediante una bandera editable por el usuario.

El panel administrativo web será un **tercer proyecto web**, separado de ambos móviles, para KYC, zonas, monitoreo y revisiones; no se instalará dentro de las apps Driver ni Cliente. Su implementación y auditoría están pendientes.

## Ruta de finalización antes de LIVE

1. Adaptar a los dos proyectos autenticación segura y políticas por rol (`driver`/ `passenger`) manteniendo prohibido el registro de acciones cross-role.
2. Driver: almacenamiento privado, carga y revisión administrativa de documentos, vehículos, G15 ofertas privadas, G13 recuperación de push, ubicación y ganancias.
3. Cliente: cotización versionada, solicitud, cancelación, seguimiento y pagos simulados; envíos y órdenes comerciales.
4. Backend compartido: aislar los contratos del laboratorio `mobility-expo` en paquetes de servidor, confirmar RLS y permisos contra SQL real y usar adaptadores con Auth.
5. Panel administrativo web: revisión de licencias/seguros, zonas, incidentes, reportes y auditoría.
6. Pruebas E2E de ambos binarios en dispositivos, legales y de seguridad, disponibilidad por zonas y aprobación explícita del Owner para cualquier despliegue.

**Prohibiciones**: NO MERGE; NO LIVE; NO VPS; NO SQL remoto; NO pagos reales; NO desplegar servicios ni habilitar push real sin aprobación.
