import { useEffect, useRef } from 'react';
import { StyleSheet, LogBox, AppState } from 'react-native';

LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AuthProvider, useAuth, AlertProvider, initializeConfig, registerAssets, registerForPushNotificationsAsync, setStorageProvider, setupNotificationHandler, DoorbellProvider, getStoredPushToken } from './src/index';
import NotificationDeepLinkHandler from './src/components/NotificationDeepLinkHandler';
import { navigationRef } from './src/navigation/RootNavigation';
import { AppNavigator } from './src/navigation/AppNavigator';

console.log("Iniciando App.tsx");

const { GOOGLE_CLIENT_ID, eas } = Constants.expoConfig?.extra || {};
const EAS_PROJECT_ID = eas?.projectId;

initializeConfig({
  APP_NAME: 'TuQuota',
  API_URL: 'https://api.tuquotaadmin.com',
  GOOGLE_CLIENT_ID,
});
console.log("Configuración inicializada");

registerAssets({
  logoBig: require('./assets/logo_big.png'),
  logoQ: require('./assets/icon.png'),
});

setStorageProvider(AsyncStorage);

function PushRegistration() {
  const { user, updateUser } = useAuth();
  const registered = useRef(false);
  const inFlight = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const ensurePushToken = async (uid: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const currentUser = userRef.current;
      const serverToken = (currentUser as any)?.push_token || null;
      const stored = await getStoredPushToken();
      // Si hay un token local que coincide con el del servidor, no hace falta
      // registrar de nuevo. Si difiere o falta, se regenera (cubre builds/
      // instancias donde el token quedó obsoleto o el backend lo perdió).
      if (stored && (!serverToken || serverToken === stored)) {
        console.log('Push token ya registrado en este dispositivo');
        return;
      }
      console.log('Push token local difiere del servidor; re-registrando...');
      for (let attempt = 1; attempt <= 5; attempt++) {
        const newToken = await registerForPushNotificationsAsync(EAS_PROJECT_ID, uid);
        if (newToken) {
          console.log('Push token registered for user', uid);
          if (updateUser && typeof updateUser === 'function') {
            try {
              updateUser({ ...userRef.current, push_token: newToken } as any);
            } catch {}
          }
          return;
        }
        console.log(`Reintentando registro push (intento ${attempt}/5)...`);
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (!user?.id || registered.current) return;
    registered.current = true;
    void ensurePushToken(user.id);

    // Revalidación por cada retorno a primer plano: el token pudo expirar o ser
    // eliminado del backend mientras la app estaba en segundo plano.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensurePushToken(user.id);
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  return null;
}

export default function App() {
  console.log("Rendering App");

  useEffect(() => {
    setupNotificationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StatusBar style="auto" />
        <AuthProvider>
          <PushRegistration />
          <NotificationDeepLinkHandler />
          <DoorbellProvider>
          <AlertProvider>
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
            </NavigationContainer>
          </AlertProvider>
          </DoorbellProvider>
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});