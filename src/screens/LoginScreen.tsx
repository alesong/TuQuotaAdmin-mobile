import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Assets } from '../constants/Assets';
import { useAlert } from '../context/AlertContext';
import { Config } from '../constants/Config';
import { GoogleSignin, statusCodes, GoogleSigninButton } from '@react-native-google-signin/google-signin';

export const LoginScreen = ({ navigation }: any) => {
    const { user, signIn } = useAuth();
    const { showAlert } = useAlert();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const GOOGLE_CLIENT_ID = Config.GOOGLE_CLIENT_ID;

    useEffect(() => {
        if (user) {
            navigation.replace('Main');
        }
    }, [user]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        let isMounted = true;
        let timeoutId: any;

        const initGoogle = () => {
            if (!isMounted) return;

            if (!GOOGLE_CLIENT_ID) {
                console.error("GOOGLE_CLIENT_ID is not defined");
                return;
            }

            if ((window as any).google?.accounts?.id) {
                try {
                    (window as any).google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: handleGoogleResponse,
                        auto_select: false,
                        itp_support: true
                    });
                    
                    const container = document.getElementById("google-login-btn");
                    if (container) {
                        (window as any).google.accounts.id.renderButton(container, {
                            theme: "outline",
                            size: "large",
                            text: "continue_with",
                            shape: "rectangular",
                            width: 342, // Adjust to form width
                        });
                    }
                } catch (e) {
                    console.error("Error initializing Google:", e);
                }
            } else {
                timeoutId = setTimeout(initGoogle, 500);
            }
        };

        initGoogle();
        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [GOOGLE_CLIENT_ID]);

    useEffect(() => {
        if (Platform.OS === 'web') return;

        if (GOOGLE_CLIENT_ID) {
            GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID });
        }
    }, [GOOGLE_CLIENT_ID]);

    const handleNativeGoogleSignIn = async () => {
        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const response = await GoogleSignin.signIn();

            if (response.type === 'success') {
                const { idToken } = response.data;
                if (!idToken) {
                    showAlert({
                        title: 'Error de Acceso',
                        message: 'No se pudo obtener el token de Google.',
                        type: 'error'
                    });
                    return;
                }
                setLoading(true);
                const res = await api.post('/auth/google', { token: idToken });
                const data = await res.json();

                if (res.ok) {
                    await signIn(data.user, data.accessToken);
                } else {
                    showAlert({
                        title: 'Error de Acceso',
                        message: data?.message || 'No pudimos iniciar sesión con Google.',
                        type: 'error'
                    });
                }
            }
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                return;
            }
            console.error('Google Sign-In native error:', error);
            showAlert({
                title: 'Fallo al conectar',
                message: 'No logramos completar el inicio de sesión con Google. Intenta de nuevo más tarde.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleResponse = async (response: any) => {
        setLoading(true);
        try {
            const res = await api.post('/auth/google', { token: response.credential });
            const data = await res.json();

            if (res.ok) {
                await signIn(data.user, data.accessToken);
            } else {
                showAlert({
                    title: 'Error de Acceso',
                    message: data?.message || 'No pudimos iniciar sesión con Google.',
                    type: 'error'
                });
            }
        } catch (error: any) {
            console.error('Google Sign-In error:', error);
            showAlert({
                title: 'Fallo al conectar',
                message: 'No logramos completar el inicio de sesión con Google. Intenta de nuevo más tarde.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            showAlert({
                title: 'Atención',
                message: 'Por favor, ingresa tu correo y contraseña para continuar.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            const data = await response.json();

            if (response.ok) {
                await signIn(data.user, data.accessToken);
            } else {
                const message = data?.message === 'Invalid credentials'
                    ? 'El correo o la contraseña no son correctos. Por favor, verifícalos e intenta de nuevo.'
                    : (data?.message || 'No pudimos iniciar sesión. Por favor, intenta más tarde.');

                showAlert({
                    title: 'Error de Acceso',
                    message: message,
                    type: 'error'
                });
            }
        } catch (error: any) {
            console.error('Login error:', error);
            showAlert({
                title: 'Conexión Fallida',
                message: 'No logramos conectar con el servidor. ¿Podrías revisar tu conexión a internet?',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Image
                                source={Assets.logoBig}
                                style={{ width: 180, height: 180, marginBottom: 20 }}
                                resizeMode="contain"
                            />
                            <Text style={styles.subtitle}>Gestión Residencial Inteligente</Text>
                        </View>

                        <View style={styles.form}>
                            {/* Google Button at the Top */}
                            <View style={styles.googleContainer}>
                                {Platform.OS === 'web' ? (
                                    <div id="google-login-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
                                ) : (
                                    <GoogleSigninButton
                                        size={GoogleSigninButton.Size.Wide}
                                        color="dark"
                                        onPress={handleNativeGoogleSignIn}
                                        disabled={loading}
                                    />
                                )}
                            </View>

                            <View style={styles.divider}>
                                <View style={styles.line} />
                                <Text style={styles.dividerText}>o ingresa con tu correo</Text>
                                <View style={styles.line} />
                            </View>

                            <Input
                                label="Correo Electrónico"
                                placeholder="ejemplo@email.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            <Input
                                label="Contraseña"
                                placeholder="******"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />

                            <View style={styles.spacer} />

                            <Button
                                title="Iniciar Sesión"
                                onPress={handleLogin}
                                loading={loading}
                            />

                            <View style={styles.footer}>
                                <Button
                                    title="¿Olvidaste tu contraseña?"
                                    onPress={() => navigation.navigate('ForgotPassword')}
                                    variant="ghost"
                                />
                                <Button
                                    title="¿No tienes cuenta? Regístrate"
                                    onPress={() => navigation.navigate('Register')}
                                    variant="outline"
                                    style={{ marginTop: 12 }}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.muted,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    spacer: {
        height: 24,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        marginHorizontal: 16,
        color: Colors.muted,
        fontSize: 14,
    },
    footer: {
        marginTop: 16,
    },
    googleContainer: {
        marginBottom: 8,
        alignItems: 'center',
        width: '100%',
    },
});
