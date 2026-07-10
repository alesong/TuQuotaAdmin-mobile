/*
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import api from './api';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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

export async function registerForPushNotificationsAsync(projectId?: string) {
    if (isExpoGo) {
        console.log('Skipping push notification registration in Expo Go');
        return null;
    }

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

            await api.patch('/users/push-token', { push_token: token });
            console.log('Real Web-Push subscription saved to backend');

            return token;
        } catch (error) {
            console.error('Error during Web Push subscription', error);
            return null;
        }
    }

    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
    }

    token = (await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : {}
    )).data;

    console.log('Push token:', token);

    if (token) {
        try {
            await api.patch('/users/push-token', { push_token: token });
            console.log('Push token saved to backend');
        } catch (error) {
            console.error('Error saving push token to backend', error);
        }
    }

    return token;
}

if (!isExpoGo) {
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (e) {
        console.log('Error setting notification handler:', e);
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
                console.log(`PWA badge updated to: ${count}`);
            }
        } else {
            await Notifications.setBadgeCountAsync(count);
            console.log(`Native badge updated to: ${count}`);
        }
    } catch (error) {
        console.error('Error updating app badge:', error);
    }
}
*/
export async function registerForPushNotificationsAsync(projectId?: string) {
    console.log('Skipping push notification registration in Expo Go (Mock)');
    return null;
}

export async function updateAppBadge(count: number) {
    console.log('Skipping update app badge in Expo Go (Mock)');
}
