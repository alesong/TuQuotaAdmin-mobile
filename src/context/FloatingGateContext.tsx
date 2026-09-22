import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FloatingGateContextType {
  enabled: boolean;
  serviceId: string | null;
  serviceName: string | null;
  buttonConfig: Record<string, any> | null;
  position: { x: number; y: number };
  toggleEnabled: (on: boolean) => void;
  setService: (serviceId: string, serviceName: string, buttonConfig: Record<string, any>) => void;
  setPosition: (x: number, y: number) => void;
  dismiss: () => void;
}

const DEFAULT_POSITION = { x: -1, y: -1 }; // Sentinel: use screen defaults

const FloatingGateContext = createContext<FloatingGateContextType>({
  enabled: false,
  serviceId: null,
  serviceName: null,
  buttonConfig: null,
  position: DEFAULT_POSITION,
  toggleEnabled: () => {},
  setService: () => {},
  setPosition: () => {},
  dismiss: () => {},
});

const STORAGE_KEY_PREFIX = '@TuQuotaAdmin:floatingGate';
const POSITION_KEY_PREFIX = '@TuQuotaAdmin:floatingGatePos';

function getStorageKeys(userId?: string | null) {
  const suffix = userId ? `:${userId}` : ':anon';
  return {
    state: `${STORAGE_KEY_PREFIX}${suffix}`,
    position: `${POSITION_KEY_PREFIX}${suffix}`,
  };
}

export function FloatingGateProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [buttonConfig, setButtonConfig] = useState<Record<string, any> | null>(null);
  const [position, setPositionState] = useState(DEFAULT_POSITION);
  const [loaded, setLoaded] = useState(false);

  const keys = getStorageKeys(userId);

  // Load persisted state on mount / userId change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stateRaw, posRaw] = await Promise.all([
          AsyncStorage.getItem(keys.state),
          AsyncStorage.getItem(keys.position),
        ]);
        if (cancelled) return;
        if (stateRaw) {
          const parsed = JSON.parse(stateRaw);
          setEnabled(!!parsed.enabled);
          setServiceId(parsed.serviceId || null);
          setServiceName(parsed.serviceName || null);
          setButtonConfig(parsed.buttonConfig || null);
        }
        if (posRaw) {
          const pos = JSON.parse(posRaw);
          if (typeof pos.x === 'number' && typeof pos.y === 'number') {
            setPositionState(pos);
          }
        }
      } catch (e) {
        console.warn('FloatingGate: error loading state', e);
      } finally {
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Persist state changes
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(keys.state, JSON.stringify({ enabled, serviceId, serviceName, buttonConfig })).catch(() => {});
  }, [enabled, serviceId, serviceName, buttonConfig, loaded]);

  // Persist position changes
  useEffect(() => {
    if (!loaded) return;
    if (position.x === DEFAULT_POSITION.x && position.y === DEFAULT_POSITION.y) return;
    AsyncStorage.setItem(keys.position, JSON.stringify(position)).catch(() => {});
  }, [position, loaded]);

  const toggleEnabled = useCallback((on: boolean) => {
    setEnabled(on);
  }, []);

  const setService = useCallback((id: string, name: string, config: Record<string, any>) => {
    setServiceId(id);
    setServiceName(name);
    setButtonConfig(config);
  }, []);

  const setPosition = useCallback((x: number, y: number) => {
    setPositionState({ x, y });
  }, []);

  const dismiss = useCallback(() => {
    setEnabled(false);
  }, []);

  return (
    <FloatingGateContext.Provider
      value={{ enabled, serviceId, serviceName, buttonConfig, position, toggleEnabled, setService, setPosition, dismiss }}
    >
      {children}
    </FloatingGateContext.Provider>
  );
}

export const useFloatingGate = () => useContext(FloatingGateContext);
