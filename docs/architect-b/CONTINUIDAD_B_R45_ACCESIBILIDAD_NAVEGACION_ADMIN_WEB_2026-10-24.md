# QORE Mobile — Arquitecto B, R45: accesibilidad de navegación Admin Web
Fecha 24-oct-2026. PR #8 DRAFT, sin despliegue.

## Cambios reales de interfaz
- `apps/movete-admin/src/main.tsx`: enlace de salto al contenido al usar teclado; botón de menú móvil con `aria-expanded`, `aria-controls` y etiqueta Abrir/Cerrar; navegación de secciones con botones tipados, región `nav` rotulada y `aria-current=page`; al abrir se lleva foco al primer enlace; Escape en el panel cierra y devuelve foco al disparador; cambiar de sección desplaza foco al encabezado nuevo (sin anunciar una pantalla anterior).
- `apps/movete-admin/src/styles.css`: skip link visible en foco, foco visible para botones, links y formularios, y respeto de preferencia de movimiento reducido; destino de foco identificable.
- El banner se describe como entorno de validación técnica, sin ocultar que no está conectado al backend.

## Criterios de prueba y límites
Admin Web se valida con el workflow propio (Node tests, TypeScript y Vite build) y el aislamiento Client/Driver en el mismo HEAD. Estos checks NO sustituyen prueba física con teclado, lector de pantalla o contraste/zoom sobre dispositivos reales. Se mantienen como P0/P1 la auditoría manual de NVDA/VoiceOver/TalkBack, manejo de foco al desmontar datos por sesión, y prueba de foco del menú móvil a 320px/200% zoom.

No se tocó Driver, backend, Node/PostgreSQL ni workflows. No hay Auth/MFA real, tickets, contacto, SMS, compras, pagos, SOS o despliegue. `merchantCaseContractReady:false` persiste. Continuar desde R46 con accesibilidad de formularios Cliente/comercio o integración B autorizada cuando A entregue sus contratos.
