import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, LockKeyhole, Eye, EyeOff, Users, ShieldCheck } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Assets } from '../constants/Assets';
import { useAlert } from '../context/AlertContext';
import { Config } from '../constants/Config';
import { GoogleSignin, statusCodes, GoogleSigninButton } from '@react-native-google-signin/google-signin';

const bgImage = require('../../assets/BgLoginScreen.png');

const DS = {
    navy: '#173B7A',
    deepBlue: '#123A78',
    mediumBlue: '#3F82E8',
    turquoise: '#08A6A6',
    gold: '#F2B52A',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#172B4D',
    textSecondary: '#64748B',
    border: '#D9E1EA',
} as const;

export const LoginScreen = ({ navigation }: any) => {
    const { user, signIn } = useAuth();
    const { showAlert } = useAlert();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
                            width: 342,
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
        <ImageBackground source={bgImage} style={styles.container} resizeMode="cover">
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
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>Gestión Residencial Inteligente</Text>
                            <Text style={styles.subtitle}>Administra tu copropiedad de forma fácil, segura y eficiente.</Text>
                        </View>

                        <View style={styles.form}>
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
                                label="Correo electrónico"
                                placeholder="ejemplo@email.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                leftIcon={Mail}
                                iconColor={DS.turquoise}
                                containerStyle={styles.inputContainer}
                                labelStyle={styles.inputLabel}
                            />
                            <Input
                                label="Contraseña"
                                placeholder="••••••••"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                leftIcon={LockKeyhole}
                                rightIcon={showPassword ? Eye : EyeOff}
                                onRightIconPress={() => setShowPassword(!showPassword)}
                                iconColor={DS.turquoise}
                                containerStyle={styles.inputContainer}
                                labelStyle={styles.inputLabel}
                            />

                            <Button
                                title="Iniciar sesión"
                                onPress={handleLogin}
                                loading={loading}
                                prefix={<LockKeyhole size={19} color="#fff" />}
                                style={styles.loginButton}
                            />

                            <TouchableOpacity
                                onPress={() => navigation.navigate('ForgotPassword')}
                                style={styles.forgotButton}
                            >
                                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                            </TouchableOpacity>

                            <View style={styles.registerCard}>
                                <Users size={20} color={DS.turquoise} />
                                <Text style={styles.registerText}>
                                    ¿No tienes cuenta?{' '}
                                    <Text style={styles.registerAction}>Regístrate</Text>
                                </Text>
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    onPress={() => navigation.navigate('Register')}
                                />
                            </View>

                            <View style={styles.securityRow}>
                                <ShieldCheck size={16} color={DS.turquoise} />
                                <Text style={styles.securityText}>Tus datos están protegidos</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingTop: Platform.OS === 'web' ? 8 : 8,
        paddingBottom: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 100,
    },
    logo: {
        width: 160,
        height: 50,
        marginBottom: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: DS.navy,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: DS.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    form: {
        width: '100%',
        maxWidth: 380,
        alignSelf: 'center',
    },
    googleContainer: {
        marginBottom: 6,
        alignItems: 'center',
        width: '100%',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: DS.border,
    },
    dividerText: {
        marginHorizontal: 12,
        color: DS.textSecondary,
        fontSize: 13,
    },
    inputContainer: {
        height: 50,
        borderRadius: 12,
        borderColor: DS.border,
        backgroundColor: DS.surface,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: DS.textPrimary,
        marginBottom: 6,
    },
    loginButton: {
        height: 52,
        borderRadius: 12,
        backgroundColor: DS.navy,
        shadowColor: DS.navy,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    forgotButton: {
        alignItems: 'center',
        marginTop: 12,
    },
    forgotText: {
        fontSize: 14,
        fontWeight: '600',
        color: DS.turquoise,
    },
    registerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        backgroundColor: DS.surface,
        borderWidth: 1,
        borderColor: '#C9D5E5',
        borderRadius: 12,
        marginTop: 10,
        paddingHorizontal: 14,
        gap: 8,
        position: 'relative',
    },
    registerText: {
        fontSize: 14,
        fontWeight: '500',
        color: DS.textPrimary,
    },
    registerAction: {
        fontWeight: '700',
        color: DS.turquoise,
    },
    securityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
        gap: 6,
    },
    securityText: {
        fontSize: 13,
        color: DS.textSecondary,
    },
});
