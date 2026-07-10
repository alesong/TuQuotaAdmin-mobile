import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { ArrowLeft, HelpCircle, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AlertModal } from '../components/AlertModal';

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <TouchableOpacity
            style={styles.faqItem}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
        >
            <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{question}</Text>
                {isExpanded ? <ChevronUp size={20} color={Colors.muted} /> : <ChevronDown size={20} color={Colors.muted} />}
            </View>
            {isExpanded && (
                <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{answer}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

export const SupportScreen = ({ navigation }: any) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [recipientType, setRecipientType] = useState<'ADMIN' | 'SUPPORT'>('ADMIN');

    const [modalConfig, setModalConfig] = useState<{
        isVisible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isVisible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const faqs = [
        {
            question: "¿Cómo puedo pagar mi administración?",
            answer: "Puedes realizar pagos directamente desde la pantalla de inicio tocando el botón 'Pagar Administración' en la tarjeta de tu vivienda. Sigue las instrucciones para completar el pago mediante Wompi."
        },
        {
            question: "¿Qué hago si mi pago no se ve reflejado?",
            answer: "Los pagos electrónicos suelen reflejarse de inmediato. Si después de 24 horas no aparece en tu estado de cuenta, por favor contacta a soporte técnico adjuntando tu comprobante de pago."
        },
        {
            question: "¿Cómo vinculo una nueva vivienda?",
            answer: "En la sección de 'Configuración' dentro de tu perfil, encontrarás la opción 'Vincular otra vivienda'. Podrás buscar por nombre de condominio e identificador de unidad."
        },
        {
            question: "¿Cómo cambio mi contraseña?",
            answer: "Por ahora, para cambiar tu contraseña debes cerrar sesión y utilizar la opción 'Olvidé mi contraseña' en la pantalla de ingreso. Recibirás un correo con las instrucciones."
        }
    ];

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            setModalConfig({
                isVisible: true,
                title: 'Atención',
                message: 'Por favor, completa todos los campos para que podamos ayudarte mejor.',
                type: 'info'
            });
            return;
        }

        setLoading(true);
        try {
            const firstCondoId = user?.viviendas?.[0]?.vivienda?.condominio_id;

            const response = await api.post('/support/contact', {
                subject,
                message,
                recipientType,
                condoId: recipientType === 'ADMIN' ? firstCondoId : undefined
            });

            if (response.ok) {
                const data = await response.json();
                setModalConfig({
                    isVisible: true,
                    title: '¡Mensaje Enviado!',
                    message: `¡Listo! Tu mensaje ha sido recibido con éxito. Pronto nos pondremos en contacto contigo.\n\nNúmero de caso: ${data.caseNumber}`,
                    type: 'success'
                });
                setSubject('');
                setMessage('');
                // Note: navigation.goBack() will be handled in a dynamic onClose or similar if we want to wait for user to read it
            } else {
                setModalConfig({
                    isVisible: true,
                    title: 'Ups, algo falló',
                    message: 'No pudimos enviar tu mensaje en este momento. Por favor, intenta de nuevo más tarde.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Support request error:', error);
            setModalConfig({
                isVisible: true,
                title: 'Error de Conexión',
                message: 'Parece que hay un problema de conexión. Por favor, verifica tu internet e intenta de nuevo.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ayuda y Soporte</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <HelpCircle size={20} color={Colors.primary} />
                            <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>
                        </View>
                        {faqs.map((faq, index) => (
                            <FAQItem key={index} question={faq.question} answer={faq.answer} />
                        ))}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MessageSquare size={20} color={Colors.primary} />
                            <Text style={styles.sectionTitle}>Envíanos tu inquietud</Text>
                        </View>

                        <Text style={styles.label}>Asunto</Text>
                        <TextInput
                            style={styles.input}
                            value={subject}
                            onChangeText={setSubject}
                            placeholder="Ej: Reporte de pago, Error en la app..."
                        />

                        <Text style={styles.label}>¿A quién va dirigida?</Text>
                        <View style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, recipientType === 'SUPPORT' && styles.chipActive]}
                                onPress={() => setRecipientType('SUPPORT')}
                            >
                                <Text style={[styles.chipText, recipientType === 'SUPPORT' && styles.chipTextActive]}>Soporte Técnico</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chip, recipientType === 'ADMIN' && styles.chipActive]}
                                onPress={() => setRecipientType('ADMIN')}
                            >
                                <Text style={[styles.chipText, recipientType === 'ADMIN' && styles.chipTextActive]}>Administrador</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Mensaje</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Cuéntanos con detalle tu inquietud..."
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Send size={20} color="#fff" />
                                    <Text style={styles.submitButtonText}>Enviar Mensaje</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <AlertModal
                isVisible={modalConfig.isVisible}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                onClose={() => {
                    setModalConfig({ ...modalConfig, isVisible: false });
                    if (modalConfig.type === 'success') {
                        navigation.goBack();
                    }
                }}
            />
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
        padding: 24,
        paddingTop: 48,
        backgroundColor: Colors.background,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    content: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100, // More bottom padding for keyboard/bottom safety
    },
    section: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 24,
    },
    faqItem: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    faqQuestion: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        flex: 1,
        marginRight: 10,
    },
    faqAnswerContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.secondary,
    },
    faqAnswer: {
        fontSize: 14,
        color: Colors.muted,
        lineHeight: 20,
    },
    label: {
        fontSize: 14,
        color: Colors.muted,
        marginBottom: 8,
        marginTop: 16,
        fontWeight: '500',
    },
    input: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        fontSize: 16,
        color: Colors.text,
    },
    textArea: {
        height: 120,
    },
    chipContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: 14,
        color: Colors.muted,
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 32,
        gap: 10,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
