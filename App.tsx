import { useEffect, useRef } from 'react';
import { View, StyleSheet, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AuthProvider, useAuth, AlertProvider, initializeConfig, registerAssets, registerForPushNotificationsAsync, setStorageProvider, setupNotificationHandler, addNotificationResponseListener, DoorbellProvider } from './src/index';
import { navigationRef } from './src/navigation/RootNavigation';
import { AppNavigator } from './src/navigation/AppNavigator';

console.log("Iniciando App.tsx");

const { GOOGLE_CLIENT_ID } = Constants.expoConfig?.extra || {};

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
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user?.id || registered.current) return;
    registered.current = true;

    registerForPushNotificationsAsync(undefined, user.id).then(token => {
      if (token) {
        console.log('Push token registered for user', user.id);
      }
    });
  }, [user?.id]);

  return null;
}

export default function App() {
  console.log("Rendering App");
  const notificationListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    setupNotificationHandler();

    notificationListener.current = addNotificationResponseListener(response => {
      const data = response.notification?.request?.content?.data;
      if (data?.type === 'doorbell') {
        const navigate = navigationRef.current?.navigate;
        if (navigate && data.url) {
          navigate('MyServices' as any);
        }
      }
    });

    return () => {
      notificationListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StatusBar style="auto" />
        <AuthProvider>
          <PushRegistration />
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