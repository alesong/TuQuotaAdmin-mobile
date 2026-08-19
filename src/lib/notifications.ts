import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const PUSH_TOKEN_KEY = '@TuQuotaAdmin:pushToken';

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearStoredPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {}
}

const VAPID_PUBLIC_KEY = "BAB0CuKg20VHuCrfGBUG1ddz2DUnQZvJyg5vFnsMHvLRc-AjSPMWTagWviDOIONB_h0euBuqavie2ORx3oY5vEM";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const CHANNEL_DEFAULT = 'default_v2';

export async function ensureNotificationChannelsAsync() {
  if (Platform.OS !== 'android' || isExpoGo) return;
  try {
    await Notifications.deleteNotificationChannelAsync('default');
  } catch {}
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  } catch {
    console.log('Could not create default notification channel');
  }
  try {
    // El canal del timbre debe existir SIEMPRE (se actualiza in-place en el
    // DoorbellProvider según preferencias). Si no existe cuando llega el push
    // con la app cerrada, Android descarta la notificación silenciosamente.
    await Notifications.setNotificationChannelAsync('doorbell_v2', {
      name: 'Timbre',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#6366f1',
      sound: 'doorbell.wav',
    });
  } catch {
    console.log('Could not create doorbell channel');
  }
}

export async function registerForPushNotificationsAsync(projectId?: string, userId?: string) {
  if (isExpoGo) {
    console.log('Skipping push notification registration in Expo Go');
    return null;
  }

  await ensureNotificationChannelsAsync();

  if (Platform.OS === 'web') {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    if (!isSupported) {
      console.log('Push notifications are not supported on this browser');
      return null;
    }

    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permission not granted for notifications');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      const token = JSON.stringify(subscription);
      await api.patch('/users/push-token', { user_id: userId, push_token: token });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      console.log('Real Web-Push subscription saved to backend');
      return token;
    } catch (error) {
      console.error('Error during Web Push subscription', error);
      return null;
    }
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const resolvedProjectId = projectId || Constants.expoConfig?.extra?.eas?.projectId;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  let token = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      resolvedProjectId ? { projectId: resolvedProjectId } : {}
    );
    token = result.data;
    console.log('Push token:', token);
  } catch (error) {
    // No marcar skip permanente: reintentar el registro en el próximo login
    // por si el problema fue transitorio (ej. Firebase aún no configurado).
    console.log('[Push Token] No se pudo obtener token Expo. Reintentará en la próxima apertura.');
    return null;
  }

  if (token) {
    try {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      await api.patch('/users/push-token', { user_id: userId, push_token: token });
      console.log('Push token saved to backend');
    } catch (error) {
      console.error('Error saving push token to backend', error);
    }
  }

  return token;
}

export async function setupNotificationHandler() {
  if (isExpoGo) return;

  await ensureNotificationChannelsAsync();

  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isDoorbell = notification.request.content.data?.type === 'doorbell';
        return {
          shouldShowAlert: true,
          shouldPlaySound: !isDoorbell,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
  } catch (e) {
    console.log('Error setting notification handler:', e);
  }
}

export function addNotificationResponseListener(handler: (response: Notifications.NotificationResponse) => void) {
  if (isExpoGo) return { remove: () => {} };

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener(handler);
    return subscription;
  } catch (e) {
    console.log('Error adding notification response listener:', e);
    return { remove: () => {} };
  }
}

export async function updateAppBadge(count: number) {
  try {
    if (Platform.OS === 'web') {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      }
    } else {
      await Notifications.setBadgeCountAsync(count);
    }
  } catch (error) {
    console.error('Error updating app badge:', error);
  }
}

export async function getExpoPushToken(projectId?: string) {
  if (isExpoGo || !Device.isDevice) return null;
  const resolvedProjectId = projectId || Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(
      resolvedProjectId ? { projectId: resolvedProjectId } : {}
    )).data;
    return token;
  } catch {
    return null;
  }
}
