import { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Home,
    Building2
} from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { AlertModal } from '../components/AlertModal';

export const SettingsScreen = ({ navigation }: any) => {
    const { user, token, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isUnbindModalVisible, setIsUnbindModalVisible] = useState(false);
    const [viviendaToUnbind, setViviendaToUnbind] = useState<{ id: string, identificador: string, condoId: string } | null>(null);
    const [alertConfig, setAlertConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [isAlertVisible, setIsAlertVisible] = useState(false);

    const API_URL = Config.API_URL;

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const updatedUser = await response.json();
                await updateUser(updatedUser);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleUnbind = (viviendaId: string, identificador: string, condoId: string) => {
        setViviendaToUnbind({ id: viviendaId, identificador, condoId });
        setIsUnbindModalVisible(true);
    };

    const confirmUnbind = async () => {
        if (!viviendaToUnbind) return;
        
        setIsUnbindModalVisible(false);
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/condominios/${viviendaToUnbind.condoId}/viviendas/${viviendaToUnbind.id}/disassociate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                await fetchProfile();
                setAlertConfig({
                    title: '¡Éxito!',
                    message: 'Se ha desvinculado la unidad correctamente.',
                    type: 'success'
                });
                setIsAlertVisible(true);
            } else {
                setAlertConfig({
                    title: 'Error',
                    message: 'No se pudo desvincular la unidad. Por favor, intenta de nuevo.',
                    type: 'error'
                });
                setIsAlertVisible(true);
            }
        } catch (error) {
            console.error('Unbind error:', error);
            setAlertConfig({
                title: 'Error de conexión',
                message: 'Ocurrió un error al intentar desvincular. Revisa tu conexión a internet.',
                type: 'error'
            });
            setIsAlertVisible(true);
        } finally {
            setLoading(false);
            setViviendaToUnbind(null);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Configurar Viviendas</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tus Viviendas</Text>
                    {user?.viviendas && user.viviendas.length > 0 ? (
                        user.viviendas.map((item: any) => (
                            <View key={item.vivienda.id} style={styles.viviendaCard}>
                                <View style={styles.viviendaIcon}>
                                    <Home size={24} color={Colors.primary} />
                                </View>
                                <View style={styles.viviendaInfo}>
                                    <Text style={styles.viviendaNum}>{item.vivienda.identificador}</Text>
                                    <View style={styles.condoRow}>
                                        <Building2 size={14} color={Colors.muted} />
                                        <Text style={styles.condoName}>{item.vivienda.condominio?.name}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.unbindButton}
                                    onPress={() => handleUnbind(item.vivienda.id, item.vivienda.identificador, item.vivienda.condominio_id)}
                                    disabled={loading}
                                >
                                    <Trash2 size={20} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No tienes viviendas vinculadas.</Text>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('ManualAssociation')}
                >
                    <Plus size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Vincular otra vivienda</Text>
                </TouchableOpacity>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cuenta</Text>
                    <Text style={styles.infoText}>
                        Gestiona tus vinculaciones y preferencias de cuenta. Para cambiar tu correo, contacta a soporte.
                    </Text>
                </View>
            </ScrollView>

            <AlertModal
                isVisible={isUnbindModalVisible}
                type="warning"
                title="Desvincular Unidad"
                message={`¿Estás seguro que deseas desvincularte de la unidad ${viviendaToUnbind?.identificador}? Esta acción no se puede deshacer fácilmente.`}
                onClose={() => setIsUnbindModalVisible(false)}
                buttons={[
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Desvincular', style: 'destructive', onPress: confirmUnbind }
                ]}
            />

            {alertConfig && (
                <AlertModal
                    isVisible={isAlertVisible}
                    type={alertConfig.type}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    onClose={() => setIsAlertVisible(false)}
                />
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            )}
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
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.muted,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    viviendaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    viviendaIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    viviendaInfo: {
        flex: 1,
    },
    viviendaNum: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    condoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    condoName: {
        fontSize: 14,
        color: Colors.muted,
    },
    unbindButton: {
        padding: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginBottom: 32,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.muted,
        marginTop: 20,
    },
    infoText: {
        fontSize: 14,
        color: Colors.muted,
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
