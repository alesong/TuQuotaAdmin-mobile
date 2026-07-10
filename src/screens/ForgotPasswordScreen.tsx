import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';

const API_URL = Config.API_URL;

export const ForgotPasswordScreen = ({ navigation }: any) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!email) {
            Alert.alert('Error', 'Por favor ingrese su correo electrónico');
            return;
        }

        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (response.ok) {
                setSubmitted(true);
            } else {
                Alert.alert('Error del Servidor', data.message || 'El servidor respondió con un error.');
            }
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                Alert.alert('Error de Conexión', 'La solicitud tardó demasiado. Verifica tu conexión a internet o la URL de la API.');
            } else {
                Alert.alert('Error de Red', 'No se pudo conectar con el servidor. Verifica que la API esté corriendo y sea accesible desde este dispositivo.');
            }
            console.error('Fetch error:', error);
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
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ChevronLeft size={28} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Recuperar Contraseña</Text>
                    </View>

                    <View style={styles.content}>
                        {submitted ? (
                            <View style={styles.successContainer}>
                                <Text style={styles.successTitle}>¡Correo Enviado!</Text>
                                <Text style={styles.successText}>
                                    Hemos enviado un enlace de recuperación a {email}. Por favor revisa tu bandeja de entrada.
                                </Text>
                                <Button
                                    title="Volver al Login"
                                    onPress={() => navigation.navigate('Login')}
                                />
                            </View>
                        ) : (
                            <View style={styles.form}>
                                <Text style={styles.description}>
                                    Ingresa tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña.
                                </Text>

                                <Input
                                    label="Correo Electrónico"
                                    placeholder="ejemplo@email.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />

                                <View style={styles.spacer} />

                                <Button
                                    title="Enviar Instrucciones"
                                    onPress={handleSubmit}
                                    loading={loading}
                                />
                            </View>
                        )}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        marginLeft: 8,
    },
    content: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    description: {
        fontSize: 16,
        color: Colors.muted,
        marginBottom: 32,
        lineHeight: 24,
    },
    form: {
        width: '100%',
    },
    spacer: {
        height: 32,
    },
    successContainer: {
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 16,
    },
    successText: {
        fontSize: 16,
        color: Colors.muted,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    button: {
        width: '100%',
    },
});
