# QORE Mobile — Arquitecto B | R36 Modo simple accesible (24-10-2026)

## Cambio funcional
Como avance independiente tras R35, se añadió **Modo simple** opcional a la app Expo Cliente para facilitar el uso básico sin esperar al backend.

- `src/ClientRuntime.tsx`: contexto React de preferencia visual `simpleMode` en RAM, sin red, sin identidad ni persistencia accidental. Si la app reinicia, el modo se restablece al predeterminado.
- `src/ClientUI.tsx`: `Action large` opcional (alto mínimo 68 px, fuente 20 px); las acciones anteriores mantienen sus dimensiones y funcionamiento.
- `app/index.tsx`: cuando el usuario activa el modo, Inicio presenta acciones esenciales legibles — preparar viaje AUTO, preparar envío, ver comercios, seguridad/ayuda y cuenta — más regreso de un toque a todas las opciones. No modifica navegación de las otras pantallas, roles, pricing, permisos ni pagos.
- `app/cuenta.tsx`: botón reversible Activar/Desactivar Modo simple, con aviso de que es temporal y no modifica el backend.

## Evidencia y límites
Los componentes siguen usando las rutas existentes y de estado real: las funciones no certificadas permanecen bloqueadas. No se declara modo global completo (solo acceso simplificado desde Inicio), persistencia multi-dispositivo, lectura de pantalla certificada ni nueva autenticación. Es necesario verificar manualmente la accesibilidad y recorrido de tareas en Android/iOS físicos más adelante.

## Relación con referencias
- Issue #12: Uber Cliente menciona modo simple para personas mayores. Movete Fácil no restringe esta preferencia por edad: es voluntaria para cualquier usuario.
- Issue #11: opciones de rutas, soporte, comercio; R35 ya introdujo editor de paradas QA seguro.
- Issue #9: Auth, mapas, precio, PSP y backend solo Arquitecto A.

## QA y propiedad
Cortes de R36: `79dbdee1` contexto, `be78ad18` Action large, `a8cae7ac` preferencia en Cuenta, `3943418d` Inicio. Comprobar TS, tests Node de dominio, Expo WEB y control ownership mediante los 3 workflows del mismo HEAD antes de certificar. Todos los cambios son propiedad B en `apps/movete-cliente/**` y `docs/architect-b/**`. **NO MERGE, NO LIVE, NO DEPLOY**. El Owner decidirá cuándo habilitar infra real y UI final Lovable.

## Continuidad
R37 sugerido: crear flujo de ayuda al primer uso omisible y accesible, sin falsa Auth ni canales de soporte conectados. Priorizar después controles de seguridad para código de recogida con verificación únicamente del servidor, y seguimiento compartido bajo consentimiento y privacidad.
