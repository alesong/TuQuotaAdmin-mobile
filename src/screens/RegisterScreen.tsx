import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Checkbox } from '../components/Checkbox';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';

import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';


import api from '../lib/api';

export const RegisterScreen = ({ navigation }: any) => {
    const { signIn } = useAuth();
    const { showAlert } = useAlert();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name || !email || !password || !confirmPassword) {
            showAlert({ title: 'Error', message: 'Por favor complete todos los campos', type: 'error' });
            return;
        }

        if (!termsAccepted || !privacyAccepted) {
            showAlert({ title: 'Error', message: 'Debes aceptar los términos y la política de tratamiento de datos para continuar', type: 'warning' });
            return;
        }

        if (password !== confirmPassword) {
            showAlert({ title: 'Error', message: 'Las contraseñas no coinciden', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register', {
                name,
                email,
                password,
            });

            const data = await response.json();


            if (response.ok) {
                const { user, accessToken } = data;
                await signIn(user, accessToken);
            } else {
                showAlert({ title: 'Error', message: data.message || 'Error al registrar usuario', type: 'error' });
            }
        } catch (error) {
            console.error('Register error:', error);
            showAlert({ title: 'Error', message: 'No se pudo conectar con el servidor', type: 'error' });
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
                            <Text style={styles.title}>Crear Cuenta</Text>
                            <Text style={styles.subtitle}>Únete a {Config.APP_NAME}</Text>
                        </View>

                        <View style={styles.form}>
                            <Input
                                label="Nombre Completo"
                                placeholder="Tu nombre completo"
                                value={name}
                                onChangeText={setName}
                            />
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
                            <Input
                                label="Confirmar Contraseña"
                                placeholder="******"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />

                            <Checkbox
                                checked={termsAccepted}
                                onPress={setTermsAccepted}
                            >
                                <Text style={styles.checkboxText}>
                                    Acepto los <Text style={styles.link} onPress={() => Linking.openURL('https://tuquotaadmin.com/terms.html')}>términos del servicio</Text>.
                                </Text>
                            </Checkbox>

                            <Checkbox
                                checked={privacyAccepted}
                                onPress={setPrivacyAccepted}
                            >
                                <Text style={styles.checkboxText}>
                                    Acepto la <Text style={styles.link} onPress={() => Linking.openURL('https://tuquotaadmin.com/privacy.html')}>política de privacidad</Text> y <Text style={styles.link} onPress={() => Linking.openURL('https://tuquotaadmin.com/data-processing.html')}>tratamiento de datos</Text>.
                                </Text>
                            </Checkbox>

                            <View style={styles.spacer} />

                            <Button
                                title="Registrarse"
                                onPress={handleRegister}
                                loading={loading}
                            />

                            <View style={styles.footer}>
                                <Button
                                    title="¿Ya tienes cuenta? Inicia Sesión"
                                    onPress={() => navigation.navigate('Login')}
                                    variant="ghost"
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
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.muted,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    checkboxContainer: {
        marginVertical: 12,
    },
    checkboxText: {
        fontSize: 14,
        color: Colors.text,
        lineHeight: 20,
    },
    link: {
        color: Colors.primary,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    spacer: {
        height: 24,
    },
    footer: {
        marginTop: 16,
        marginBottom: 24,
    },
});
