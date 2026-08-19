import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Copy, RefreshCw, Smartphone, CheckCircle, XCircle, Cloud, Cpu } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { Config } from '../constants/Config';

export const DebugPushTokenScreen = ({ navigation }: any) => {
  const { user, token: authToken, updateUser } = useAuth();
  const serverPushToken = (user as any)?.push_token || null;
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [deviceTokenLoading, setDeviceTokenLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeviceToken();
  }, []);

  const fetchDeviceToken = async () => {
    setDeviceTokenLoading(true);
    setDeviceError(null);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          setDeviceToken(null);
          setDeviceError('Permiso de notificaciones no concedido');
          setDeviceTokenLoading(false);
          return;
        }
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const result = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : {}
      );
      setDeviceToken(result.data);
    } catch (e: any) {
      setDeviceToken(null);
      setDeviceError(e?.message || String(e));
    }
    setDeviceTokenLoading(false);
  };

  const handleCopy = (token: string, setter: (v: boolean) => void) => {
    if (!token) return;
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(token).then(() => {
        setter(true);
        setTimeout(() => setter(false), 2000);
      });
    } else {
      Clipboard.setString(token);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  const handleRefreshFromServer = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`${Config.API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const profile = await res.json();
        await updateUser(profile);
        if (profile?.push_token) {
          setRefreshError(null);
        } else {
          setRefreshError('El servidor no devolvió un push_token. ¿Ya activaste las notificaciones en la app?');
        }
      } else {
        setRefreshError(`Error HTTP ${res.status} al consultar perfil.`);
      }
    } catch (err: any) {
      setRefreshError(`Error de conexión: ${err?.message || err}`);
    } finally {
      setRefreshing(false);
    }
    fetchDeviceToken();
  };

  const handleTestPush = async () => {
    setTestSending(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch(`${Config.API_URL}/users/test-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const { sent, webPush, total, skipped } = data?.result || {};
        setTestResult(
          `Push enviado a ${total ?? 0} token(s) (expo: ${sent ?? 0}, web: ${webPush ?? 0}, omitidos: ${skipped ?? 0}). Revisa la barra de notificaciones con la app cerrada o en segundo plano.`
        );
      } else {
        setTestError(data?.reason === 'no_push_tokens'
          ? 'No hay tokens de push registrados para tu usuario.'
          : `El servidor respondió ${res.status}.`);
      }
    } catch (err: any) {
      setTestError(`Error de conexión: ${err?.message || err}`);
    } finally {
      setTestSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Depuración Push</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Device Token Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Cpu size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Token Directo del Dispositivo</Text>
            </View>
            <Text style={styles.cardDescription}>
              Token Expo obtenido directamente desde el dispositivo vía expo-notifications.
              Este es el token real que usa Expo para enviarte notificaciones.
            </Text>

            {deviceTokenLoading ? (
              <View style={styles.noToken}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.noTokenDesc}>Obteniendo token del dispositivo...</Text>
              </View>
            ) : deviceToken ? (
              <View style={styles.tokenContainer}>
                <View style={styles.tokenWrapper}>
                  <Text style={styles.tokenLabel}>Expo Push Token (dispositivo)</Text>
                  <Text style={styles.tokenText} selectable>{deviceToken}</Text>
                </View>
                <View style={styles.tokenActions}>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(deviceToken, setCopiedDevice)}>
                    {copiedDevice ? (
                      <CheckCircle size={18} color={Colors.success} />
                    ) : (
                      <Copy size={18} color="#fff" />
                    )}
                    <Text style={styles.copyButtonText}>{copiedDevice ? 'Copiado' : 'Copiar Token'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noToken}>
                <XCircle size={40} color={Colors.muted} />
                <Text style={styles.noTokenTitle}>No disponible</Text>
                <Text style={styles.noTokenDesc}>
                  No se pudo obtener el token directamente del dispositivo.
                  {Platform.OS === 'web'
                    ? ' En web no hay Expo Push Token, solo Web Push.'
                    : ''}
                </Text>
                {deviceError && (
                  <Text style={styles.errorText}>{deviceError}</Text>
                )}
                <TouchableOpacity style={styles.retryButton} onPress={fetchDeviceToken}>
                  <RefreshCw size={16} color={Colors.primary} />
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Server Token Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Smartphone size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Token del Servidor</Text>
            </View>
            <Text style={styles.cardDescription}>
              Token almacenado en el perfil del servidor ({`/auth/profile`}).
              Puede diferir del token directo si el dispositivo se registró con otro proyectoId.
            </Text>

            {serverPushToken ? (
              <View style={styles.tokenContainer}>
                <View style={styles.tokenWrapper}>
                  <Text style={styles.tokenLabel}>push_token (servidor)</Text>
                  <Text style={styles.tokenText} selectable>{serverPushToken}</Text>
                </View>
                <View style={styles.tokenActions}>
                  <TouchableOpacity style={styles.copyButton} onPress={() => handleCopy(serverPushToken, setCopied)}>
                    {copied ? (
                      <CheckCircle size={18} color={Colors.success} />
                    ) : (
                      <Copy size={18} color="#fff" />
                    )}
                    <Text style={styles.copyButtonText}>{copied ? 'Copiado' : 'Copiar Token'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.retryButton} onPress={handleRefreshFromServer} disabled={refreshing}>
                    {refreshing ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <RefreshCw size={16} color={Colors.primary} />
                    )}
                    <Text style={styles.retryButtonText}>Recargar</Text>
                  </TouchableOpacity>
                </View>
                {refreshError && (
                  <Text style={styles.errorText}>{refreshError}</Text>
                )}
              </View>
            ) : (
              <View style={styles.noToken}>
                <XCircle size={40} color={Colors.muted} />
                <Text style={styles.noTokenTitle}>Token no disponible</Text>
                <Text style={styles.noTokenDesc}>
                  No hay un push token registrado en tu perfil.{'\n'}
                  {refreshError || 'Presiona "Consultar servidor" para obtenerlo desde la API.'}
                </Text>
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={handleRefreshFromServer}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Cloud size={18} color="#fff" />
                  )}
                  <Text style={styles.registerButtonText}>
                    {refreshing ? 'Consultando...' : 'Consultar servidor'}
                  </Text>
                </TouchableOpacity>
                {refreshError && (
                  <Text style={styles.errorText}>{refreshError}</Text>
                )}
              </View>
            )}
          </View>

          {/* Test Push Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Cloud size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Push de Prueba</Text>
            </View>
            <Text style={styles.cardDescription}>
              Envía una notificación de prueba desde el servidor a todos tus
              dispositivos registrados ({`/users/test-push`}). Verifica la entrega
              con la app abierta, en segundo plano y con la app cerrada.
            </Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleTestPush}
              disabled={testSending}
            >
              {testSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Cloud size={18} color="#fff" />
              )}
              <Text style={styles.copyButtonText}>
                {testSending ? 'Enviando...' : 'Enviar Push de Prueba'}
              </Text>
            </TouchableOpacity>
            {testError && (
              <Text style={styles.errorText}>{testError}</Text>
            )}
            {testResult && (
              <Text style={styles.successText}>{testResult}</Text>
            )}
          </View>

          {/* Instructions Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <RefreshCw size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Instrucciones</Text>
            </View>
            <View style={styles.instructionList}>
              <Text style={styles.instructionItem}>
                1. Usa el token de la sección "Token Directo del Dispositivo" (es el token Expo real)
              </Text>
              <Text style={styles.instructionItem}>
                2. Copia el token con el botón "Copiar Token"
              </Text>
              <Text style={styles.instructionItem}>
                3. Abre el panel Doorbell Detector en tu navegador
              </Text>
              <Text style={styles.instructionItem}>
                4. En la sección "Probar Push (TuQuotaAdmin)", pega el token
              </Text>
              <Text style={styles.instructionItem}>
                5. Presiona "Enviar Push de Prueba"
              </Text>
              <Text style={styles.instructionItem}>
                6. Recibirás la notificación en este dispositivo
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  tokenContainer: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    padding: 12,
  },
  tokenWrapper: {
    marginBottom: 12,
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    color: Colors.text,
    lineHeight: 18,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  noToken: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  noTokenTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  noTokenDesc: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
  successText: {
    fontSize: 13,
    color: Colors.success,
    textAlign: 'center',
    marginTop: 8,
  },
  instructionList: {
    gap: 8,
    marginTop: 4,
  },
  instructionItem: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    paddingLeft: 4,
  },
});
