import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';
import { playDoorbellSound } from '../utils/sounds';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PREFS_KEY = '@TuQuotaAdmin:doorbellPrefs';

export interface DoorbellPreferences {
  enabled: boolean;
  sound: string;
  notify: boolean;
}

const DEFAULT_PREFS: DoorbellPreferences = {
  enabled: true,
  sound: 'doorbell.wav',
  notify: true,
};

const DOORBELL_MAX_AGE_MS = 30000;

interface DoorbellContextType {
    connected: boolean;
    showAlert: boolean;
    doorbellServiceId: string | null;
    doorbellProvider: string | null;
    preferences: DoorbellPreferences;
    dismissAlert: () => void;
    triggerRing: () => void;
    updatePreferences: (prefs: DoorbellPreferences) => Promise<void>;
}

const DoorbellContext = createContext<DoorbellContextType>({
  connected: true,
  showAlert: false,
  doorbellServiceId: null,
  doorbellProvider: null,
  preferences: DEFAULT_PREFS,
  triggerRing: () => {},
  dismissAlert: () => {},
  updatePreferences: async () => {},
});

async function applyChannelPreferences(prefs: DoorbellPreferences) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.deleteNotificationChannelAsync('doorbell_v2');
    await delay(200);
  } catch (e) {
    console.warn('No se pudo eliminar el canal doorbell_v2 (puede no existir):', e);
  }
  try {
    await Notifications.setNotificationChannelAsync('doorbell_v2', {
      name: 'Timbre',
      importance: prefs.notify
        ? Notifications.AndroidImportance.MAX
        : Notifications.AndroidImportance.NONE,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#6366f1',
      sound: prefs.enabled && prefs.notify ? prefs.sound : null,
    });
  } catch (e) {
    console.error('Error applying channel preferences:', e);
  }
}

export function DoorbellProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [doorbellServiceId, setDoorbellServiceId] = useState<string | null>(null);
  const [doorbellProvider, setDoorbellProvider] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<DoorbellPreferences>(DEFAULT_PREFS);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsRef = useRef<DoorbellPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(stored => {
      try {
        const parsed = stored ? JSON.parse(stored) as DoorbellPreferences : {};
        const merged = { ...DEFAULT_PREFS, ...parsed };
        setPreferences(merged);
        prefsRef.current = merged;
        applyChannelPreferences(merged);
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!token) {
      setDoorbellServiceId(null);
      return;
    }

    let cancelled = false;

    fetch(`${Config.API_URL}/resident-services/my-services`, {
      cache: 'no-cache',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        const isDoorbellProvider = (p: string) => p === 'Doorbell' || p === 'TuyaSmart';
        const doorbellService = arr.find((s: any) => isDoorbellProvider(s.provider));
        setDoorbellServiceId(doorbellService?.serviceId || null);
        setDoorbellProvider(doorbellService?.provider || null);
        if (typeof doorbellService?.lastSnapshot === 'string') {
          setLastSnapshot(doorbellService.lastSnapshot);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'doorbell') {
        if (!prefsRef.current.notify) return;
        const timestamp = typeof data.timestamp === 'number' ? data.timestamp : undefined;
        if (timestamp && Date.now() - timestamp > DOORBELL_MAX_AGE_MS) return;
        const identifier = notification.request.identifier;

        if (typeof data.image === 'string') setLastSnapshot(data.image);
        setShowAlert(true);
        if (prefsRef.current.enabled) {
          playDoorbellSound(prefsRef.current.sound);
        }
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => setShowAlert(false), 30000);

        if (!dismissTimers.has(identifier)) {
          dismissTimers.set(identifier, setTimeout(async () => {
            try {
              await Notifications.dismissNotificationAsync(identifier);
            } catch {}
            dismissTimers.delete(identifier);
          }, 30000));
        }
      }
    });

    return () => {
      subscription.remove();
      dismissTimers.forEach(t => clearTimeout(t));
      dismissTimers.clear();
    };
  }, []);

  const handleRing = useCallback(() => {
    if (doorbellServiceId && token) {
      fetch(`${Config.API_URL}/resident-services/doorbell/ring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ serviceId: doorbellServiceId }),
      }).catch(() => {});
    }
  }, [doorbellServiceId, token]);

  const dismissAlert = useCallback(() => {
    setShowAlert(false);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
  }, []);

  const updatePreferences = useCallback(async (prefs: DoorbellPreferences) => {
    setPreferences(prefs);
    prefsRef.current = prefs;
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Error al guardar preferencias del timbre:', e);
    }
    await applyChannelPreferences(prefs);
  }, []);

  return (
    <DoorbellContext.Provider
      value={{ connected: true, showAlert, doorbellServiceId, doorbellProvider, preferences, triggerRing: handleRing, dismissAlert, updatePreferences }}
    >
      {children}
      {showAlert && (
        <View style={styles.doorbellAlert}>
          <Bell size={22} color="#fff" />
          <Text style={styles.alertText}>¡Alguien está en la puerta!</Text>
          <TouchableOpacity onPress={dismissAlert} style={styles.closeBtn}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
          {lastSnapshot ? (
            <Image source={{ uri: lastSnapshot }} style={styles.alertImage} resizeMode="cover" />
          ) : null}
        </View>
      )}
    </DoorbellContext.Provider>
  );
}

const styles = StyleSheet.create({
  doorbellAlert: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    paddingTop: 48,
  },
  alertText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  alertImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginTop: 8,
  },
});

export const useDoorbell = () => useContext(DoorbellContext);
