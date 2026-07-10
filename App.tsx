import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AuthProvider, AlertProvider, initializeConfig, registerAssets, registerForPushNotificationsAsync, setStorageProvider } from './src/index';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/RootNavigation';

console.log("Iniciando App.tsx");

const { GOOGLE_CLIENT_ID } = Constants.expoConfig?.extra || {};

initializeConfig({
  APP_NAME: 'TuQuota',
  API_URL: 'https://api.tuquotaadmin.com',
  GOOGLE_CLIENT_ID,
});
console.log("Configuración inicializada");

registerAssets({
  logoBig: require('./assets/icon.png'),
  logoQ: require('./assets/icon.png'),
});

setStorageProvider(AsyncStorage);

export default function App() {
  console.log("Rendering App");
  useEffect(() => {
    // registerForPushNotificationsAsync(); // Comentada
    console.log("App iniciado");
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StatusBar style="auto" />
        {console.log("Rendering Providers")}
        <AuthProvider>
          <AlertProvider>
            {console.log("Rendering Navigation")}
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
            </NavigationContainer>
          </AlertProvider>
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