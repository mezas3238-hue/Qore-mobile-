# G300/G301 — Primero APK interna de pruebas; después Google Play y Apple App Store

Decisión revisada del Owner, 2026-11-01: **primero desarrollar y probar APK internas en Android**, corregir cada requisito funcional hasta superar las pruebas reales y **solo entonces publicar para el público** en Google Play y Apple App Store. Las APK internas pueden compartirse con evaluadores autorizados y no equivalen a publicación comercial. El formato de Play es **AAB** y el de App Store **IPA** firmado. Para iPhone, la ruta de pruebas es **TestFlight** u otra distribución firmada conforme a Apple, no APK.

## Inventario verificado
| Componente | Código actual | Publicación |
|---|---|---|
| Cliente | `apps/movete-cliente`: Expo Android/iOS, `com.movetefacil.cliente` | Google Play + Apple App Store, aplicación independiente |
| Driver | `apps/movete-driver`: Expo Android/iOS, `com.movetefacil.driver` | Google Play + Apple App Store, aplicación independiente |
| Admin | `apps/movete-admin`: aplicación React + Vite web | Portal web privado con MFA/RBAC; no declarar app móvil publicada |
| Comercio | Portal comercial existente; **no se validó bundle nativo independiente en esta auditoría** | Definir si será web/PWA o app nativa publicable; no inventar un paquete ni ficha |

No renombrar el producto a ViajeYa por la existencia de `apps/mobility-expo`: su identificador `com.qore.viajeya` y el nombre antiguo no forman parte de este par de apps aprobadas para publicación.

## Artefactos preparados
- `apps/movete-cliente/eas.json` y `apps/movete-driver/eas.json`: **`qa-apk`** (distribución `internal`, APK instalable en Android), más perfiles separados **`store-review`** y **`production`** (AAB para Google Play, build iOS firmado para App Store). LIVE OFF en todos, sin `eas submit`, ni publicar automáticamente.
- `scripts/g300-app-store-readiness.test.mjs`: pruebas estáticas de flags y IDs; `.github/workflows/qore-g300-app-store-readiness.yml`: ejecución sin cuentas ni secretos.
- Esto **NO** significa que esté lista una compilación publicable o un lanzamiento. Aún falta iniciar cada proyecto en EAS y verificar firmas reales, certificados y políticas.

## Fases y criterios de aprobación antes de publicar

**Fase 1 — QA Android en APK interna.** Conectar cada aplicación a STAGING controlado, crear/autorizar proyectos Expo EAS y credenciales de firma internas, generar un APK separado para Cliente y Driver desde `qa-apk`, distribuir **solo a testers**. Ejecutar registro Cliente/KYC, registro documental Driver y cámara con nitidez real, ofertas AUTO/MOTO, envíos/Comercio, tarifas/comisiones, mapa, recepción de asignaciones, botón 🆘 voluntario OFF por defecto y permisos telefónicos, pruebas sin cobertura, accesibilidad y seguridad. Registrar errores y versiones; iterar hasta que todos los criterios estén aprobados. **Nunca hacer llamadas de prueba al 911 real.** Probar la interfaz y el flujo del marcador mediante simulaciones seguras.

**Fase 2 — QA externo certificado.** Completar los cinco recorridos externos con identidades reales de QA y el backend Railway/Supabase; demostrar roles/Owner MFA, identidad del pasajero, privacidad, RLS, pagos en simulación y no-promesa de emergencias automáticas. Cualquier bloqueo impide lanzamiento. Las pruebas automatizadas de GitHub no reemplazan estas pruebas físicas.

**Fase 3 — Beta oficial de tiendas.** Con presupuesto/cuentas/certificados y consentimiento Owner, compilar **AAB** mediante `store-review` para Play Console (pruebas internas/cerradas), y versión **iOS** para TestFlight. Evaluar permisos, App Privacy/Data safety, fichas e información de seguridad. Verificar los mismos flujos en Android e iPhone.

**Fase 4 — Producción.** Solo cuando el Owner apruebe expresamente: firmas finales, planes de publicación, soporte, seguridad, cumplimiento y revisión Google/Apple. No realizar `submit` ni despliegues desde CI automáticamente.

## Acciones que requieren cuentas propietarias y documentación legal
1. Crear/verificar la cuenta del titular en [Google Play Console](https://play.google.com/console/about/) y [Apple Developer Program](https://developer.apple.com/programs/), preferiblemente como organización titular del servicio cuando exista entidad jurídica verificable.
2. Registrar y **reservar** los identificadores de paquete y bundle (verificar que estén disponibles) antes de elegirlos definitivamente.
3. Crear un proyecto EAS para Cliente y otro para Driver y conectar sus IDs oficiales con `expo.extra.eas.projectId` (no inventar UUID, no incluir tokens privados).
4. Administrar firma Android/Play App Signing y credenciales iOS (Distribution certificate, provisioning, App Store Connect API Key) mediante el proveedor autorizado; secretos SOLO en almacén seguro.
5. Resolver iconos, splash, capturas de pantalla reales, ficha de tienda en español, categoría, soporte, enlace público HTTPS a privacidad y eliminación de cuenta, y calificación por edad.
6. Implementar borrado de cuenta y datos compatible con retención legal de viajes/pagos/seguridad; Google y Apple requieren flujos de eliminación para apps con registro. Evaluar privacidad (KYC, foto de cédula, cámara, ubicación, SOS, contacto de confianza, pagos) y formularios de Data safety y App Privacy.
7. Ejecutar las 5 pruebas E2E **externas** con backend STAGING y las pruebas del dispositivo (Android/iPhone). No lanzar viajes comerciales, despacho, pagos ni emergencias hasta autorización, garantías y verificación reales.
8. Solicitar acceso de prueba: Google Play Internal/Closed Testing; Apple TestFlight. Si Play Console es **cuenta personal abierta después del 13-nov-2023**, Google exige **12 probadores durante 14 días consecutivos** antes de pedir acceso a producción; la condición debe confirmarse en la cuenta.
9. Solo después de aprobar QA, privacidad, pagos, proveedor, disponibilidad operativa y revisión del Owner: construir `store-review`, subir firmados a los entornos de pruebas oficiales, validar y promover a Producción. Ningún CI debe ejecutar `eas submit` ni despliegue automático sin aprobación explícita.

## Comandos de referencia (requieren acceso y proyecto EAS aprobado)
En el directorio de **cada** aplicación (`apps/movete-cliente` y `apps/movete-driver`):
```sh
# Fase de QA interna en teléfonos Android
eas build --platform android --profile qa-apk

# Sólo después de QA aprobado: binarios para pruebas oficiales
eas build --platform android --profile store-review
eas build --platform ios --profile store-review
```
El primer comando debe producir una APK para instalación de evaluadores, no para Play. El segundo un AAB para Play y el tercero un build iOS que, tras firma y envío autorizado, sirve para TestFlight y posterior App Store. **No ejecutar cargas a tiendas, compras ni publicar LIVE sin autorización expresa.**

## Costos oficiales (2026-11-01)
- Google Play Console: cuota de registro única de **USD 25**.
- Apple Developer Program: cuota anual de **USD 99**, precio local/impuestos y disponibilidad según región.
- Compilaciones EAS, SMS, mapas, servidor, tasas y pagos son costos separados; verificar planes antes de contratar.

## Fuentes oficiales
- Android App Bundle: https://developer.android.com/guide/app-bundle
- Expo EAS Build/Submit: https://docs.expo.dev/deploy/submit-to-app-stores/
- Google Play Console: https://support.google.com/googleplay/android-developer/answer/6112435
- Pruebas cerradas para cuentas personales nuevas: https://support.google.com/googleplay/android-developer/answer/14151465
- Apple Developer Membership: https://developer.apple.com/help/account/membership/program-enrollment/
- Apple: eliminación de cuenta: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion

**Limitaciones**: este PR cambia solo archivos de configuración/documentación/CI; no creó APK/IPA/AAB, proyectos EAS, certificados, compras, cuentas, despliegues ni operaciones LIVE. No mezclar ramas de SOS G297–G299 sin revisión de integración.
