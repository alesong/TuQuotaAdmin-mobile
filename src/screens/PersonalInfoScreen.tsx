import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList
} from 'react-native';
import { ArrowLeft, User, Mail, Phone, FileText, Check, X, Search, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const COUNTRIES = [
    { code: '57', name: 'Colombia', flag: '🇨🇴' },
    { code: '58', name: 'Venezuela', flag: '🇻🇪' },
    { code: '52', name: 'México', flag: '🇲🇽' },
    { code: '54', name: 'Argentina', flag: '🇦🇷' },
    { code: '56', name: 'Chile', flag: '🇨🇱' },
    { code: '51', name: 'Perú', flag: '🇵🇪' },
    { code: '507', name: 'Panamá', flag: '🇵🇦' },
    { code: '1', name: 'USA', flag: '🇺🇸' },
];

const InfoRow = ({ icon: Icon, label, value, state, setState, editable, isEditing, keyboardType, children }: any) => (
    <View style={styles.infoRow}>
        <View style={styles.iconContainer}>
            <Icon size={20} color={Colors.primary} />
        </View>
        <View style={styles.textContainer}>
            <Text style={styles.label}>{label}</Text>
            {isEditing && editable ? (
                children || (
                    <TextInput
                        style={styles.input}
                        value={state}
                        onChangeText={setState}
                        placeholder={`Ingresa tu ${label.toLowerCase()}`}
                        keyboardType={keyboardType || 'default'}
                    />
                )
            ) : (
                <Text style={styles.value}>{value || 'No especificado'}</Text>
            )}
        </View>
    </View>
);

export const PersonalInfoScreen = ({ navigation }: any) => {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone?.replace(/^\+\d+\s/, '') || '');
    const [countryCode, setCountryCode] = useState(user?.phone?.match(/^\+(\d+)\s/)?.[1] || '57');
    const [document, setDocument] = useState(user?.document || '');
    const [isEditing, setIsEditing] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            const phoneMatch = user.phone?.match(/^\+(\d+)\s(.*)$/);
            if (phoneMatch) {
                setCountryCode(phoneMatch[1]);
                setPhone(phoneMatch[2]);
            } else {
                setPhone(user.phone || '');
            }
            setDocument(user.document || '');
        }
    }, [user]);

    const handleSave = async () => {
        setLoading(true);
        const fullPhone = `+${countryCode} ${phone}`;
        try {
            const response = await api.patch('/users/profile', {
                name,
                phone: fullPhone,
                document
            });

            if (response.ok) {
                const updatedUser = await response.json();
                await updateUser(updatedUser);
                setIsEditing(false);
                Alert.alert('Éxito', 'Información actualizada correctamente');
            } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.message || 'Error al actualizar información');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            Alert.alert('Error', 'No se pudo conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const currentCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Información Personal</Text>
                {isEditing ? (
                    <TouchableOpacity onPress={handleSave} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Check color={Colors.success} size={24} />
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Text style={styles.editButton}>Editar</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <InfoRow
                        icon={User}
                        label="Nombre Completo"
                        value={name}
                        state={name}
                        setState={setName}
                        editable={true}
                        isEditing={isEditing}
                    />

                    <InfoRow
                        icon={Mail}
                        label="Correo Electrónico"
                        value={email}
                        state={email}
                        setState={setEmail}
                        editable={false}
                        isEditing={isEditing}
                    />

                    <InfoRow
                        icon={Phone}
                        label="Teléfono / WhatsApp"
                        value={`+${countryCode} ${phone}`}
                        editable={true}
                        isEditing={isEditing}
                    >
                        <View style={styles.phoneInputContainer}>
                            <TouchableOpacity
                                style={styles.countrySelector}
                                onPress={() => setShowCountryModal(true)}
                            >
                                <Text style={styles.countryFlag}>{currentCountry.flag}</Text>
                                <Text style={styles.countryCode}>+{countryCode}</Text>
                                <ChevronRight size={14} color={Colors.muted} />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.input, { flex: 1, borderBottomWidth: 0 }]}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Teléfono"
                                keyboardType="numeric"
                            />
                        </View>
                    </InfoRow>

                    <InfoRow
                        icon={FileText}
                        label="Documento de Identidad"
                        value={document}
                        state={document}
                        setState={setDocument}
                        editable={true}
                        isEditing={isEditing}
                        keyboardType="numeric"
                    />
                </View>

                {isEditing && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                            setName(user?.name || '');
                            setPhone(user?.phone?.replace(/^\+\d+\s/, '') || '');
                            setCountryCode(user?.phone?.match(/^\+(\d+)\s/)?.[1] || '57');
                            setDocument(user?.document || '');
                            setIsEditing(false);
                        }}
                    >
                        <X size={20} color={Colors.error} />
                        <Text style={styles.cancelButtonText}>Cancelar Edición</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.noteContainer}>
                    <Text style={styles.noteText}>
                        * Tu correo electrónico no puede ser modificado por seguridad. Si necesitas cambiarlo, por favor contacta a soporte.
                    </Text>
                </View>
            </ScrollView>

            <Modal
                visible={showCountryModal}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selecciona tu país</Text>
                            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={COUNTRIES}
                            keyExtractor={(item) => item.code}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.countryItem}
                                    onPress={() => {
                                        setCountryCode(item.code);
                                        setShowCountryModal(false);
                                    }}
                                >
                                    <Text style={styles.countryItemFlag}>{item.flag}</Text>
                                    <Text style={styles.countryItemName}>{item.name}</Text>
                                    <Text style={styles.countryItemCode}>+{item.code}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
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
    editButton: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: 16,
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
    card: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        color: Colors.muted,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '500',
    },
    input: {
        fontSize: 16,
        color: Colors.text,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary + '30',
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary + '30',
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 12,
        marginRight: 12,
        borderRightWidth: 1,
        borderRightColor: Colors.border,
        paddingVertical: 4,
    },
    countryFlag: {
        fontSize: 20,
        marginRight: 4,
    },
    countryCode: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '500',
        marginRight: 4,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.error + '10',
        padding: 12,
        borderRadius: 12,
        marginTop: 24,
        gap: 8,
    },
    cancelButtonText: {
        color: Colors.error,
        fontWeight: '600',
    },
    noteContainer: {
        marginTop: 32,
        padding: 16,
    },
    noteText: {
        fontSize: 12,
        color: Colors.muted,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    countryItemFlag: {
        fontSize: 24,
        marginRight: 16,
    },
    countryItemName: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    countryItemCode: {
        fontSize: 16,
        color: Colors.muted,
        fontWeight: '500',
    }
});
