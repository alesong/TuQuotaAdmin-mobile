# Backend: Push Notifications para el Timbre (Doorbell)

## Resumen

Actualmente, cuando alguien toca el timbre, la app recibe un mensaje WebSocket y hace un POST a `/resident-services/doorbell/ring` para notificar al servidor. Sin embargo, este mecanismo **no funciona si la app está cerrada o el teléfono bloqueado**, porque el WebSocket se pierde.

Para solucionarlo, se necesita que el **servidor envíe push notifications** a través de **Expo Push API** a todos los residentes asociados al servicio de timbre.

## Flujo Completo Deseado

```
Timbre físico → Hardware → Servidor WebSocket

  Servidor WebSocket:
    ├── 1. Envía mensaje "doorbell_ring" por WebSocket a los conectados
    ├── 2. Recibe POST /resident-services/doorbell/ring del cliente
    └── 3. Envía Push Notification vía Expo Push API a TODOS los residentes
         (incluso los que NO tienen WebSocket activo)
```

## Requerimientos del Servidor

### Endpoint: `POST /resident-services/doorbell/ring`

**Ya existe**, pero actualmente solo registra el evento. Debe mejorarse para:

#### 1. Obtener los Push Tokens de los residentes

Al recibir el ring, el servidor debe consultar:
- El `serviceId` del doorbell
- Todos los `userId` asociados a ese servicio (dwellings/viviendas)
- El `push_token` de cada usuario (campo en la tabla `users`)

```sql
-- Ejemplo de consulta
SELECT u.push_token, u.id
FROM users u
JOIN dwelling_residents dr ON dr.user_id = u.id
JOIN dwelling d ON d.id = dr.dwelling_id
JOIN resident_services rs ON rs.dwelling_id = d.id
WHERE rs.service_id = :serviceId
  AND rs.provider = 'Doorbell'
  AND u.push_token IS NOT NULL
```

#### 2. Enviar Push Notification via Expo Push API

Usar el endpoint de Expo: `https://exp.host/--/api/v2/push/send`

**Payload:**
```json
{
  "to": "<expo-push-token>",
  "title": "¡Alguien toca el timbre!",
  "body": "Alguien está en la puerta.",
  "sound": "doorbell.wav",
  "priority": "high",
  "channelId": "doorbell",
  "data": {
    "type": "doorbell",
    "url": "/my-services"
  }
}
```

**Headers:**
```
Content-Type: application/json
Accept: application/json
Accept-Encoding: gzip, deflate
```

#### 3. Manejar Respuestas de Expo Push API

Expo devuelve un array con el resultado de cada push. El servidor debe:

- Si `status === 'error'`:
  - Si `details.error === 'DeviceNotRegistered'`: eliminar el `push_token` del usuario
  - Si `details.error === 'MessageTooBig'`: loguear y omitir
  - Otros errores: loguear

- Si `status === 'ok'`: loguear éxito

#### 4. Envío en Lote (Batch)

Si hay muchos residentes, usar el endpoint batch de Expo:
`POST https://exp.host/--/api/v2/push/send`

Este endpoint acepta un **array de hasta 100 mensajes** por request.

```json
[
  { "to": "ExponentPushToken[xxx1]", "title": "...", ... },
  { "to": "ExponentPushToken[xxx2]", "title": "...", ... }
]
```

### Almacenamiento de Push Tokens

#### Endpoint: `PATCH /users/push-token`

**Ya existe.** La app mobile ya envía el push token aquí. El servidor debe:

```json
// Request body
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}

// Response 200
{
  "success": true,
  "message": "Push token actualizado"
}
```

Campos requeridos en tabla `users`:
- `push_token` (VARCHAR/STRING, nullable) — Almacena el Expo Push Token

### Recomendaciones Técnicas

#### Librería para Node.js

```bash
npm install expo-server-sdk
```

```typescript
import { Expo } from 'expo-server-sdk';
const expo = new Expo();

async function sendDoorbellPush(serviceId: string) {
  const tokens = await getPushTokensForService(serviceId);
  const messages = tokens
    .filter(t => Expo.isExpoPushToken(t))
    .map(token => ({
      to: token,
      sound: 'doorbell.wav',
      title: '¡Alguien toca el timbre!',
      body: 'Alguien está en la puerta.',
      priority: 'high' as const,
      channelId: 'doorbell',
      data: { type: 'doorbell', url: '/my-services' },
    }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < receipts.length; i++) {
        const { status, details } = receipts[i];
        if (status === 'error' && details?.error === 'DeviceNotRegistered') {
          await removePushToken(tokens[i]);
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
}
```

#### Sin Expo Server SDK (HTTP directo)

```typescript
async function sendPushNotification(token: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title: '¡Alguien toca el timbre!',
      body: 'Alguien está en la puerta.',
      sound: 'doorbell.wav',
      priority: 'high',
      channelId: 'doorbell',
      data: { type: 'doorbell', url: '/my-services' },
    }),
  });
  return response.json();
}
```

### Configuración Expo Push Token

- No requiere API Key ni configuración especial
- Expo Push API es gratuita y pública
- El token se obtiene del lado del cliente con `expo-notifications`
- Formato: `ExponentPushToken[xxxxxx]` o `ExpoPushToken[xxxxxx]`

### Pruebas

1. **App en foreground**: WebSocket directo → sonido + alerta (ya funciona)
2. **App en background**: Push notification → banner + sonido (requiere backend)
3. **App cerrada**: Push notification → banner en centro de notificaciones (requiere backend)
4. **Teléfono bloqueado**: Push notification → sonido + pantalla bloqueada (requiere backend)
5. **Prueba manual desde backend**: Usar Expo Push API directamente con un token de prueba

### Notas Adicionales

- iOS requiere configuración adicional (certificado APNs via Expo)
- Android usa FCM que Expo maneja automáticamente
- Si se usa un proyecto Expo propio (no Expo Go), se necesita el `projectId` de `app.json`
- El sonido `doorbell.wav` debe estar presente en el bundle de la app
- Se debe crear el canal de notificación `doorbell` (la app ya lo crea en `notifications.ts`)
