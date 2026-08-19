import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { navigationRef, navigate } from '../navigation/RootNavigation';
import { Config } from '../constants/Config';

const POLL_INTERVAL = 300;

export type DoorbellDetailTarget =
  | { type: 'event'; id: string }
  | { type: 'snapshot'; id: string };

function doorbellTarget(data: any): DoorbellDetailTarget | null {
  if (data?.eventId) return { type: 'event', id: data.eventId };
  if (data?.snapshotId) return { type: 'snapshot', id: data.snapshotId };
  return null;
}

// tuquotaadmin://open?target=doorbell&eventId=..&snapshotId=..
// Parseo manual: Hermes/RN no garantizan URLSearchParams completos.
function deepLinkToTarget(url: string): DoorbellDetailTarget | null {
  try {
    if (!/^tuquotaadmin:\/\/open/i.test(url)) return null;
    const query = url.includes('?') ? url.split('?')[1] : '';
    const get = (key: string) => {
      const m = query.match(new RegExp(`(^|[?&])${key}=([^&]*)`));
      return m ? decodeURIComponent(m[2]) : null;
    };
    if (get('target') !== 'doorbell') return null;
    const eventId = get('eventId');
    if (eventId) return { type: 'event', id: eventId };
    const snapshotId = get('snapshotId');
    if (snapshotId) return { type: 'snapshot', id: snapshotId };
    return null;
  } catch {
    return null;
  }
}

function tryNavigateToMyServices(target?: DoorbellDetailTarget | null, imageUrl?: string): boolean {
  if (!navigationRef.isReady()) return false;
  navigate('MyServices', {
    initialSection: 'others',
    fromDoorbell: true,
    ...(imageUrl ? { imageUrl } : {}),
    ...(target ? { doorbellDetail: target } : {}),
  });
  return true;
}

function tryNavigateWithRetry(target?: DoorbellDetailTarget | null, imageUrl?: string) {
  if (tryNavigateToMyServices(target, imageUrl)) return;
  const interval = setInterval(() => {
    if (tryNavigateToMyServices(target, imageUrl)) clearInterval(interval);
  }, POLL_INTERVAL);
}

async function markDoorbellReceipt(token: string | null, target: DoorbellDetailTarget | null) {
  if (!token || !target) return;
  try {
    await fetch(`${Config.API_URL}/resident-services/doorbell/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: target.type, id: target.id }),
    });
  } catch {
    // Silencio: el receipt se reintenta al abrir el detalle desde la UI.
  }
}

export default function NotificationDeepLinkHandler() {
  const { user, token, loading } = useAuth();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const handledColdStart = useRef(false);

  const runTarget = (target: DoorbellDetailTarget | null, imageUrl?: string): boolean => {
    if (handledColdStart.current) return true;
    if (!navigationRef.isReady()) return false;
    if (loading || !user) return false;

    handledColdStart.current = true;
    markDoorbellReceipt(token, target);
    navigate('MyServices', {
      initialSection: 'others',
      fromDoorbell: true,
      ...(imageUrl ? { imageUrl } : {}),
      ...(target ? { doorbellDetail: target } : {}),
    });
    return true;
  };

  // Notificación del timbre (cold start: app abierta desde la notificación)
  useEffect(() => {
    const data = lastNotificationResponse?.notification.request.content.data;
    const isDoorbell = data?.type === 'doorbell';
    if (!isDoorbell || handledColdStart.current) return;

    const target = doorbellTarget(data);
    const imageUrl = typeof data?.image === 'string' ? data.image : undefined;

    const tryNavigate = (): boolean => runTarget(target, imageUrl);

    tryNavigate();
    const interval = setInterval(() => {
      if (tryNavigate()) clearInterval(interval);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [lastNotificationResponse, user, loading, token]);

  // Notificación del timbre (app ya abierta / en segundo plano)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'doorbell') {
          const target = doorbellTarget(data);
          markDoorbellReceipt(token, target);
          tryNavigateWithRetry(target, typeof data.image === 'string' ? data.image : undefined);
        }
      },
    );

    return () => subscription.remove();
  }, [token]);

  // Deep link externo tuquotaadmin://open?target=doorbell&eventId=..&snapshotId=..
  // (abierto desde una notificación web u otro origen)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const target = deepLinkToTarget(url);
      if (!target) return;
      markDoorbellReceipt(token, target);
      tryNavigateWithRetry(target);
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [token]);

  return null;
}
