import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { Config } from '../constants/Config';
import { getResidentServicesCache } from '../lib/serviceCache';

// Servicio de acceso (categoría ACCESS) tal como viene del backend: el menú del
// botón flotante lo renderiza con su propio button_config (colores/textos/icono).
export interface FloatingAccessService {
  serviceId: string;
  serviceName: string;
  category?: string;
  status?: string;
  description?: string;
  condominioName?: string;
  button_config?: Record<string, any>;
}

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
  // Servicios de acceso disponibles (para cambiar el flotante rápidamente)
  accessServices: FloatingAccessService[];
  accessServicesLoading: boolean;
  accessServicesError: boolean;
  refreshAccessServices: (opts?: { force?: boolean }) => Promise<void>;
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
  accessServices: [],
  accessServicesLoading: false,
  accessServicesError: false,
  refreshAccessServices: async () => {},
});

const STORAGE_KEY_PREFIX = '@TuQuotaAdmin:floatingGate';
const LEGACY_POSITION_KEY_PREFIX = '@TuQuotaAdmin:floatingGatePos';

// La posición es una preferencia de UI del dispositivo (no un dato del
// usuario), así que se guarda en UNA sola clave global. Antes se guardaba con
// sufijo `:{userId}` / `:anon`, y como AuthContext restaura el usuario de
// forma asíncrona, la clave cambiaba en caliente (`:anon` -> `:{userId}`) y la
// posición guardada "desaparecía" al iniciar sesión.
const DEVICE_POSITION_KEY = '@TuQuotaAdmin:floatingGatePos:device';

function getStateKey(userId?: string | null) {
  return `${STORAGE_KEY_PREFIX}${userId ? `:${userId}` : ':anon'}`;
}

// Solo la categoría ACCESS: el botón flotante dispara /resident-services/open-gate,
// así que no tiene sentido ofrecer cámaras, amenidades, etc.
const isAccessService = (s: any): s is FloatingAccessService =>
  !!s && s.category === 'ACCESS' && typeof s.serviceId === 'string';

const dedupeAccess = (list: any[]): FloatingAccessService[] =>
  Array.from(new Map(list.map(s => [s.serviceId, s])).values()) as FloatingAccessService[];

// Evita repetir GET /my-services si el usuario abre el menú varias veces seguidas.
const ACCESS_REFRESH_MIN_INTERVAL_MS = 60000;

function isValidPosition(pos: any): pos is { x: number; y: number } {
  return (
    !!pos &&
    typeof pos.x === 'number' && Number.isFinite(pos.x) && pos.x >= 0 &&
    typeof pos.y === 'number' && Number.isFinite(pos.y) && pos.y >= 0
  );
}

// Lee la posición: primero la clave global (actual) y, si está vacía o es
// inválida, migra la que haya quedado en las claves legacy por usuario.
async function readPersistedPosition(userId?: string | null): Promise<{ x: number; y: number } | null> {
  const suffix = userId ? `:${userId}` : ':anon';
  const candidates = [
    DEVICE_POSITION_KEY,
    `${LEGACY_POSITION_KEY_PREFIX}${suffix}`,
    `${LEGACY_POSITION_KEY_PREFIX}:anon`,
  ];
  for (const key of candidates) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const pos = JSON.parse(raw);
      if (!isValidPosition(pos)) continue;
      if (key !== DEVICE_POSITION_KEY) {
        // Promover la legacy a la clave global para que el próximo arranque
        // no dependa del userId vigente. Si la escritura falla, devolvemos la
        // posición igualmente (mejor restaurar que perderla).
        try {
          await AsyncStorage.setItem(DEVICE_POSITION_KEY, JSON.stringify(pos));
        } catch {
          // no bloquear la restauración por un fallo de escritura
        }
      }
      return pos;
    } catch {
      // clave ilegible/corrupta: probar la siguiente
    }
  }
  return null;
}

export function FloatingGateProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [buttonConfig, setButtonConfig] = useState<Record<string, any> | null>(null);
  const [position, setPositionState] = useState(DEFAULT_POSITION);
  const [loaded, setLoaded] = useState(false);

  const stateKey = getStateKey(userId);

  const { token } = useAuth();

  // ==========================================
  // Servicios de acceso (menú de cambio rápido)
  // ==========================================
  const [accessServices, setAccessServices] = useState<FloatingAccessService[]>([]);
  const [accessServicesLoading, setAccessServicesLoading] = useState(false);
  const [accessServicesError, setAccessServicesError] = useState(false);
  const accessLastFetchAtRef = useRef(0);

  // Semilla desde la caché local que ya mantiene MyServicesScreen: el menú se
  // pinta al instante y también sin conexión.
  useEffect(() => {
    let cancelled = false;
    // No heredar la lista del usuario/modo anon anterior.
    setAccessServices(prev => (prev.length ? [] : prev));
    if (!userId) return;
    getResidentServicesCache(userId)
      .then(cache => {
        if (cancelled || !cache?.services?.length) return;
        setAccessServices(dedupeAccess(cache.services.filter(isAccessService)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  // Refresh perezoso: se dispara al abrir el menú (con throttle), no en cada
  // arranque, para no duplicar la llamada que ya hacen DoorbellContext y
  // MyServicesScreen.
  const refreshAccessServices = useCallback(async (opts?: { force?: boolean }) => {
    if (!token) return;
    const now = Date.now();
    if (!opts?.force && now - accessLastFetchAtRef.current < ACCESS_REFRESH_MIN_INTERVAL_MS) return;
    accessLastFetchAtRef.current = now;
    setAccessServicesLoading(true);
    setAccessServicesError(false);
    try {
      const response = await fetch(`${Config.API_URL}/resident-services/my-services`, {
        cache: 'no-cache',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list = dedupeAccess((Array.isArray(data) ? data : []).filter(isAccessService));
      setAccessServices(list);
    } catch (e) {
      // Se conserva la semilla de la caché; el menú decide qué mostrar.
      console.warn('FloatingGate: no se pudieron cargar los servicios de acceso', e);
      setAccessServicesError(true);
    } finally {
      setAccessServicesLoading(false);
    }
  }, [token]);

  // Load persisted state on mount / userId change
  useEffect(() => {
    let cancelled = false;
    // Bloquea la persistencia mientras se lee la clave nueva: sin esto, al
    // cambiar el userId los efectos de escritura podían volcar el estado en
    // memoria (todavía sin cargar) sobre la clave recién cambiada.
    setLoaded(false);
    (async () => {
      try {
        const [stateRaw, pos] = await Promise.all([
          AsyncStorage.getItem(stateKey),
          readPersistedPosition(userId),
        ]);
        if (cancelled) return;

        if (stateRaw) {
          try {
            const parsed = JSON.parse(stateRaw);
            setEnabled(!!parsed.enabled);
            setServiceId(parsed.serviceId || null);
            setServiceName(parsed.serviceName || null);
            setButtonConfig(parsed.buttonConfig || null);
          } catch {
            setEnabled(false);
            setServiceId(null);
            setServiceName(null);
            setButtonConfig(null);
          }
        } else {
          // Sin estado guardado para ESTA clave: no heredar el del usuario o
          // del modo anon anterior.
          setEnabled(false);
          setServiceId(null);
          setServiceName(null);
          setButtonConfig(null);
        }

        setPositionState(pos ?? DEFAULT_POSITION);
      } catch (e) {
        console.warn('FloatingGate: error loading state', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, stateKey]);

  // Persist state changes
  // (stateKey va en el closure pero NO en las deps: al cambiar de usuario el
  // efecto de carga baja `loaded` a false y este efecto no debe escribir con la
  // clave nueva hasta terminar de leerla).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(stateKey, JSON.stringify({ enabled, serviceId, serviceName, buttonConfig })).catch(() => {});
  }, [enabled, serviceId, serviceName, buttonConfig, loaded]);

  // Persist position changes (clave global del dispositivo)
  useEffect(() => {
    if (!loaded) return;
    if (position.x === DEFAULT_POSITION.x && position.y === DEFAULT_POSITION.y) return;
    if (!isValidPosition(position)) return;
    AsyncStorage.setItem(DEVICE_POSITION_KEY, JSON.stringify(position)).catch(() => {});
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
      value={{
        enabled, serviceId, serviceName, buttonConfig, position,
        toggleEnabled, setService, setPosition, dismiss,
        accessServices, accessServicesLoading, accessServicesError, refreshAccessServices,
      }}
    >
      {children}
    </FloatingGateContext.Provider>
  );
}

export const useFloatingGate = () => useContext(FloatingGateContext);
