import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { navigationRef, navigate } from '../navigation/RootNavigation';

const POLL_INTERVAL = 300;

function tryNavigateToMyServices(): boolean {
  if (!navigationRef.isReady()) return false;
  navigate('MyServices', { initialSection: 'cameras' });
  return true;
}

function tryNavigateWithRetry() {
  if (tryNavigateToMyServices()) return;
  const interval = setInterval(() => {
    if (tryNavigateToMyServices()) clearInterval(interval);
  }, POLL_INTERVAL);
}

export default function NotificationDeepLinkHandler() {
  const { user, loading } = useAuth();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const handledColdStart = useRef(false);

  useEffect(() => {
    const isDoorbell =
      lastNotificationResponse?.notification.request.content.data?.type === 'doorbell';
    if (!isDoorbell || handledColdStart.current) return;

    const tryNavigate = (): boolean => {
      if (handledColdStart.current) return true;
      if (!navigationRef.isReady()) return false;
      if (loading || !user) return false;

      handledColdStart.current = true;
      navigate('MyServices', { initialSection: 'cameras' });
      return true;
    };

    tryNavigate();
    const interval = setInterval(() => {
      if (tryNavigate()) clearInterval(interval);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [lastNotificationResponse, user, loading]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'doorbell') {
          tryNavigateWithRetry();
        }
      },
    );

    return () => subscription.remove();
  }, []);

  return null;
}
