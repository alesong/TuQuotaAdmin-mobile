import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';

interface UseDoorbellWSOptions {
  url: string | null;
  onRing: () => void;
  enabled?: boolean;
}

let nativeWs: WebSocket | null = null;
let nativeReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let nativeReconnectAttempts = 0;
let nativeCurrentUrl: string | null = null;

function connectNativeWs(url: string, onRing: () => void, onConnected: (v: boolean) => void) {
  if (nativeCurrentUrl === url && nativeWs && nativeWs.readyState === WebSocket.OPEN) {
    return;
  }
  nativeCurrentUrl = url;

  if (nativeWs) {
    nativeWs.close();
    nativeWs = null;
  }

  try {
    nativeWs = new WebSocket(url);

    nativeWs.onopen = () => {
      nativeReconnectAttempts = 0;
      onConnected(true);
    };

    nativeWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'doorbell_ring') {
          onRing();
        }
      } catch {
        // non-JSON message
      }
    };

    nativeWs.onclose = () => {
      nativeWs = null;
      onConnected(false);
      scheduleNativeReconnect(url, onRing, onConnected);
    };

    nativeWs.onerror = () => {
      nativeWs?.close();
    };
  } catch {
    scheduleNativeReconnect(url, onRing, onConnected);
  }
}

function scheduleNativeReconnect(url: string, onRing: () => void, onConnected: (v: boolean) => void) {
  if (nativeReconnectTimer) {
    clearTimeout(nativeReconnectTimer);
  }
  const delay = Math.min(1000 * Math.pow(2, nativeReconnectAttempts), 30000);
  nativeReconnectAttempts++;
  nativeReconnectTimer = setTimeout(() => {
    connectNativeWs(url, onRing, onConnected);
  }, delay);
}

function disconnectNativeWs() {
  nativeCurrentUrl = null;
  nativeReconnectAttempts = 0;
  if (nativeReconnectTimer) {
    clearTimeout(nativeReconnectTimer);
    nativeReconnectTimer = null;
  }
  if (nativeWs) {
    nativeWs.close();
    nativeWs = null;
  }
}

export function useDoorbellWS({ url, onRing, enabled = true }: UseDoorbellWSOptions) {
  const [connected, setConnected] = useState(false);
  const onRingRef = useRef(onRing);
  onRingRef.current = onRing;

  if (Platform.OS === 'web') {
    // Web version: communicate with Service Worker
    const sendMessage = useCallback((message: any) => {
      if ('serviceWorker' in navigator) {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage(message);
        } else {
          navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage(message);
          });
        }
      }
    }, []);

    useEffect(() => {
      if (!url || !enabled) {
        sendMessage({ type: 'disconnect_doorbell' });
        setConnected(false);
        return;
      }

      sendMessage({ type: 'connect_doorbell', url });

      const handleMessage = (event: MessageEvent) => {
        const { type } = event.data || {};
        if (type === 'doorbell_connected') {
          setConnected(true);
        } else if (type === 'doorbell_disconnected') {
          setConnected(false);
        } else if (type === 'doorbell_ring') {
          onRingRef.current();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }, [url, enabled, sendMessage]);

    return { connected };
  }

  // Native version: direct WebSocket
  useEffect(() => {
    if (!url || !enabled) {
      disconnectNativeWs();
      setConnected(false);
      return;
    }

    connectNativeWs(url, () => onRingRef.current(), setConnected);

    return () => {
      // Don't disconnect on cleanup — keep alive across re-renders
    };
  }, [url, enabled]);

  return { connected };
}
