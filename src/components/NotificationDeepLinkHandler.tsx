import { useEffect, useRef } from 'react';
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

function tryNavigateToMyServices(target?: DoorbellDetailTarget | null, imageUrl?: string): boolean {
  if (!navigationRef.isReady()) return false;
  navigate('MyServices', {
    initialSection: 'others',
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

  useEffect(() => {
    const data = lastNotificationResponse?.notification.request.content.data;
    const isDoorbell = data?.type === 'doorbell';
    if (!isDoorbell || handledColdStart.current) return;

    const target = doorbellTarget(data);
    const imageUrl =
      typeof data?.image === 'string' ? data.image : undefined;

    const tryNavigate = (): boolean => {
      if (handledColdStart.current) return true;
      if (!navigationRef.isReady()) return false;
      if (loading || !user) return false;

      handledColdStart.current = true;
      markDoorbellReceipt(token, target);
      navigate('MyServices', {
        initialSection: 'others',
        ...(imageUrl ? { imageUrl } : {}),
        ...(target ? { doorbellDetail: target } : {}),
      });
      return true;
    };

    tryNavigate();
    const interval = setInterval(() => {
      if (tryNavigate()) clearInterval(interval);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [lastNotificationResponse, user, loading, token]);

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

  return null;
}