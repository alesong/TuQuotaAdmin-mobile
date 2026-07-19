import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { Config } from '../constants/Config';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';
import { playDoorbellSound } from '../utils/sounds';

interface DoorbellContextType {
  connected: boolean;
  showAlert: boolean;
  doorbellServiceId: string | null;
  triggerRing: () => void;
  dismissAlert: () => void;
}

const DoorbellContext = createContext<DoorbellContextType>({
  connected: true,
  showAlert: false,
  doorbellServiceId: null,
  triggerRing: () => {},
  dismissAlert: () => {},
});

export function DoorbellProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [doorbellServiceId, setDoorbellServiceId] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const doorbellService = arr.find((s: any) => s.provider === 'Doorbell');
        setDoorbellServiceId(doorbellService?.serviceId || null);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'doorbell') {
        const identifier = notification.request.identifier;

        setShowAlert(true);
        playDoorbellSound();
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

  return (
    <DoorbellContext.Provider
      value={{ connected: true, showAlert, doorbellServiceId, triggerRing: handleRing, dismissAlert }}
    >
      {children}
      {showAlert && (
        <View style={styles.doorbellAlert}>
          <Bell size={22} color="#fff" />
          <Text style={styles.alertText}>¡Alguien está en la puerta!</Text>
          <TouchableOpacity onPress={dismissAlert} style={styles.closeBtn}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
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
});

export const useDoorbell = () => useContext(DoorbellContext);
