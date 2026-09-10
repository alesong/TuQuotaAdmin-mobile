# Guía de Generación de APK y Control de Versiones

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  API (version-config.json)                              │
│  ├─ version: "3.0.0"                                    │
│  ├─ forceUpdate: true                                   │
│  ├─ downloadUrl: "https://tuquotaadmin.com/...apk"      │
│  └─ releaseNotes: "Descripción..."                      │
│           │                                             │
│           ▼                                             │
│  App (useVersionCheck hook)                             │
│  ├─ GET /app-version                                    │
│  ├─ Compara: API version > Constants.expoConfig.version │
│  ├─ Si es nueva → Alert obligatorio                     │
│  └─ Botón "Actualizar ahora" → Linking.openURL          │
│           │                                             │
│           ▼                                             │
│  Usuario descarga e instala nuevo APK                   │
│           │                                             │
│           ▼                                             │
│  Nuevo APK con requestHeaders embebido                  │
│  └─ expo-channel-name: "production"                     │
│           │                                             │
│           ▼                                             │
│  OTA funciona → eas update --channel production         │
└─────────────────────────────────────────────────────────┘
```

## Paso 1: Actualizar la Versión en el Código

### 1.1 `app.json`

```json
{
  "expo": {
    "version": "3.0.0",    // ← Cambiar aquí
    ...
    "updates": {
      "url": "https://u.expo.dev/f0d5303a-8cc9-4d2a-ae51-7a7ebf190995",
      "requestHeaders": {
        "expo-channel-name": "production"   // ← NO borrar, requerido para OTA
      }
    }
  }
}
```

### 1.2 `package.json`

```json
{
  "version": "3.0.0"    // ← Cambiar aquí
}
```

### 1.3 `android/app/build.gradle`

```gradle
defaultConfig {
    versionCode 10          // ← Incrementar en 1 (era 9)
    versionName "3.0.0"     // ← Cambiar aquí
}
```

### 1.4 `android/app/src/main/res/values/strings.xml`

```xml
<resources>
  <string name="app_name">TuQuotaAdmin</string>
  <string name="expo_runtime_version">3.0.0</string>   <!-- ← Cambiar aquí -->
</resources>
```

### 1.5 `src/screens/ProfileScreen.tsx`

```tsx
<Text style={styles.version}>Versión 3.0.0</Text>   {/* ← Cambiar aquí */}
```

## Paso 2: Construir el Nuevo APK

```bash
# En el directorio TuQuotaAdmin-mobile:
npx expo prebuild --clean
npx expo run:android --variant release
```

El APK se genera en:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Copiar el APK a la landing page

```bash
# Copiar con el nombre de la nueva versión
copy android\app\build\outputs\apk\release\app-release.apk ^
     ..\TuQuotaAdmin\apps\landing\download\TuQuotaAdmin-3.0.0.apk
```

## Paso 3: Actualizar la Configuración en la API

### 3.1 `apps/api/src/common/config/version-config.json`

```json
{
    "mobile": {
        "version": "3.0.0",
        "forceUpdate": true,
        "downloadUrl": "https://tuquotaadmin.com/download/TuQuotaAdmin-3.0.0.apk",
        "releaseNotes": "Descripción de los cambios de esta versión."
    }
}
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `version` | string | Versión semver que se compara con el APK instalado |
| `forceUpdate` | boolean | `true` = alerta sin botón "Más tarde", `false` = usuario puede cerrar |
| `downloadUrl` | string | Link directo de descarga del APK |
| `releaseNotes` | string | Mensaje que ve el usuario en el alert |

### 3.2 Actualizar el link en `download.html`

Archivo: `apps/landing/download.html`

```html
<a href="https://tuquotaadmin.com/download/TuQuotaAdmin-3.0.0.apk" class="btn btn--ghost btn--xl btn--full">
```

### 3.3 Actualizar el QR code dinámico

En `download.html`, el QR se genera dinámicamente. Actualizar la URL:

```html
<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://tuquotaadmin.com/download/TuQuotaAdmin-3.0.0.apk" alt="Código QR Descargar APK Android" />
```

## Paso 4: Desplegar

### 4.1 Commitear y pushear ambos repos

```bash
# Backend (TuQuotaAdmin)
cd ..\TuQuotaAdmin
git add apps/api/src/common/config/version-config.json apps/landing/download.html apps/landing/download/TuQuotaAdmin-3.0.0.apk
git commit -m "release: v3.0.0 - [descripción]"
git push origin main

# Mobile (TuQuotaAdmin-mobile)
cd ..\TuQuotaAdmin-mobile
git add app.json package.json android/ src/screens/ProfileScreen.tsx
git commit -m "release: v3.0.0 - [descripción]"
git push origin master
```

### 4.2 EAS Update (para updates OTA futuros)

```bash
cd TuQuotaAdmin-mobile
npx eas update --channel production --environment production --message "v3.0.0 - [descripción]"
```

### 4.3 Deploy automático

El push a `main` en el backend activa el auto-deploy en **Render**.

## Flujo del Dispositivo

```
1. Usuario abre la app (versión anterior)
2. useVersionCheck ejecuta GET /app-version
3. API retorna: { version: "3.0.0", forceUpdate: true }
4. Hook compara: "3.0.0" > "2.0.0" (versión instalada)
5. Muestra Alert:
   ┌─────────────────────────────────────┐
   │  Actualización Disponible           │
   │                                     │
   │  Una nueva versión (3.0.0) está     │
   │  disponible.                        │
   │                                     │
   │  Descripción de los cambios.        │
   │                                     │
   │  [Actualizar ahora]  ← Solo este    │
   └─────────────────────────────────────┘
6. Al tocar "Actualizar ahora" → abre downloadUrl en navegador
7. Usuario descarga e instala el APK
8. Nuevo APK tiene expo-channel-name embebido
9. A partir de ahí, las actualizaciones OTA funcionan
```

## Archivos Clave

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| `version-config.json` | `TuQuotaAdmin/apps/api/src/common/config/` | Config fuente de versión |
| `app-version.controller.ts` | `TuQuotaAdmin/apps/api/src/common/controllers/` | Endpoint `GET /app-version` |
| `useVersionCheck.ts` | `TuQuotaAdmin-mobile/src/hooks/` | Hook que compara versiones |
| `App.tsx` | `TuQuotaAdmin-mobile/` | Llama a `useVersionCheck()` |
| `app.json` | `TuQuotaAdmin-mobile/` | Versión y config de updates |
| `eas.json` | `TuQuotaAdmin-mobile/` | Perfiles de build (preview, production) |
| `download.html` | `TuQuotaAdmin/apps/landing/` | Página de descarga del APK |

## Comandos Rápidos de Referencia

```bash
# Build local
npx expo prebuild --clean
npx expo run:android --variant release

# EAS Update (OTA)
npx eas update --channel production --environment production --message "descripción"

# Verificar versiones de Prisma (si hay cambios de DB)
npx prisma migrate status --schema=prisma/schema.prisma

# TypeScript check
npx tsc --noEmit
```

## Checklist de Nueva Versión

- [ ] `app.json` → `version` actualizada
- [ ] `package.json` → `version` actualizada
- [ ] `android/app/build.gradle` → `versionCode` incrementado, `versionName` actualizado
- [ ] `android/app/src/main/res/values/strings.xml` → `expo_runtime_version` actualizado
- [ ] `src/screens/ProfileScreen.tsx` → label de versión actualizado
- [ ] `version-config.json` → `version`, `forceUpdate`, `downloadUrl`, `releaseNotes` actualizados
- [ ] `download.html` → link del APK y QR actualizados
- [ ] APK generado y copiado a `apps/landing/download/`
- [ ] Backend commiteado y pusheado (deploy automático en Render)
- [ ] Mobile commiteado y pusheado
- [ ] EAS Update ejecutado
- [ ] APK probado en dispositivo de prueba
- [ ] Force update verificado (alert aparece al abrir app anterior)
