import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const BACKGROUND_WEBSOCKET_TASK = 'BACKGROUND_DOORBELL_WS';

let bgWs: WebSocket | null = null;
let bgReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let bgReconnectAttempts = 0;
let bgUrl: string | null = null;

TaskManager.defineTask(BACKGROUND_WEBSOCKET_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Background Doorbell] Task error:', error);
    return;
  }

  const taskData = data as { url?: string } | undefined;
  if (taskData?.url) {
    startBackgroundWs(taskData.url);
  }
});

function startBackgroundWs(url: string) {
  if (bgUrl === url && bgWs && bgWs.readyState === WebSocket.OPEN) return;

  bgUrl = url;
  if (bgWs) { bgWs.close(); bgWs = null; }

  try {
    bgWs = new WebSocket(url);

    bgWs.onopen = () => {
      bgReconnectAttempts = 0;
      console.log('[Background Doorbell] WebSocket connected');
    };

    bgWs.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'doorbell_ring') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '¡Alguien toca el timbre!',
              body: 'Alguien está en la puerta.',
              data: { type: 'doorbell', url: '/my-services' },
              sound: 'doorbell.wav',
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      } catch {
        // non-JSON message
      }
    };

    bgWs.onclose = () => {
      bgWs = null;
      scheduleBgReconnect();
    };

    bgWs.onerror = () => {
      bgWs?.close();
    };
  } catch {
    scheduleBgReconnect();
  }
}

function scheduleBgReconnect() {
  if (!bgUrl) return;
  const delay = Math.min(1000 * Math.pow(2, bgReconnectAttempts), 30000);
  bgReconnectAttempts++;
  if (bgReconnectTimer) clearTimeout(bgReconnectTimer);
  bgReconnectTimer = setTimeout(() => {
    if (bgUrl) startBackgroundWs(bgUrl);
  }, delay);
}

function stopBackgroundWs() {
  bgUrl = null;
  bgReconnectAttempts = 0;
  if (bgReconnectTimer) { clearTimeout(bgReconnectTimer); bgReconnectTimer = null; }
  if (bgWs) { bgWs.close(); bgWs = null; }
}

export async function registerBackgroundDoorbellTask(url: string) {
  if (Platform.OS === 'web') return;

  startBackgroundWs(url);
}

export async function unregisterBackgroundDoorbellTask() {
  stopBackgroundWs();
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEBSOCKET_TASK);
  if (isRegistered) {
    await TaskManager.unregisterTaskAsync(BACKGROUND_WEBSOCKET_TASK);
  }
}
