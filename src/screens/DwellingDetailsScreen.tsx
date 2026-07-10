import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Modal, FlatList, ActivityIndicator, Platform } from 'react-native';
import { ChevronLeft, Plus, Trash2, Users, Home, Info, Building2, Store, Layout, LandPlot } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';


import api from '../lib/api';

export const DwellingDetailsScreen = ({ navigation, route }: any) => {
    const { showAlert } = useAlert();
    const { vivienda, condominioId } = route.params;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [area, setArea] = useState(vivienda.area?.toString() || '');
    const [tipo, setTipo] = useState(vivienda.tipo || 'Apartamento');
    const [estaVacia, setEstaVacia] = useState(vivienda.esta_vacia || false);
    const [residents, setResidents] = useState<any[]>([]);
    const [fetchingResidents, setFetchingResidents] = useState(false);

    // Modal state for adding resident
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newResident, setNewResident] = useState({
        nombre: '',
        email: '',
        telefono: '',
        relacion: ''
    });

    useEffect(() => {
        fetchResidents();
    }, []);

    const fetchResidents = async () => {
        setFetchingResidents(true);
        try {
            const response = await api.get(`/condominios/${condominioId}/viviendas/${vivienda.id}/residentes`);
            if (response.ok) {
                const data = await response.json();
                setResidents(data);
            }
        } catch (error) {
            console.error('Error fetching residents:', error);
        } finally {
            setFetchingResidents(false);
        }
    };

    const handleSaveDetails = async (newData?: any) => {
        setSaving(true);
        const dataToSave = newData || {
            area: parseFloat(area),
            tipo: tipo,
            esta_vacia: estaVacia
        };

        try {
            const response = await api.patch(`/condominios/${condominioId}/viviendas/${vivienda.id}`, dataToSave);

            if (!response.ok) {
                console.error('Error auto-saving dwelling details');
            }
        } catch (error) {
            console.error('Error auto-saving dwelling details:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddResident = async () => {
        if (!newResident.nombre) {
            showAlert({ title: 'Error', message: 'El nombre es obligatorio.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post(`/condominios/${condominioId}/viviendas/${vivienda.id}/residentes`, newResident);

            if (response.ok) {
                setIsModalVisible(false);
                setNewResident({ nombre: '', email: '', telefono: '', relacion: '' });
                fetchResidents();
                showAlert({ title: 'Éxito', message: 'Residente agregado correctamente.', type: 'success' });
            } else {
                showAlert({ title: 'Error', message: 'No se pudo agregar al residente.', type: 'error' });
            }
        } catch (error) {
            console.error('Error adding resident:', error);
            showAlert({ title: 'Error', message: 'Ocurrió un error al procesar la solicitud.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteResident = (residenteId: string, nombre: string) => {
        const performDelete = async () => {
            try {
                const response = await api.delete(`/condominios/${condominioId}/viviendas/${vivienda.id}/residentes/${residenteId}`);

                if (response.ok) {
                    fetchResidents();
                }
            } catch (error) {
                console.error('Error deleting resident:', error);
            }
        };

        showAlert({
            title: 'Confirmar',
            message: `¿Estás seguro de eliminar a ${nombre} de la lista de residentes?`,
            type: 'warning',
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: performDelete
                }
            ]
        });
    };


    const dwellingTypes = [
        { label: 'Apartamento', icon: Building2 },
        { label: 'Casa', icon: Home },
        { label: 'Local', icon: Store },
        { label: 'Oficina', icon: Layout },
        { label: 'Lote', icon: LandPlot },
    ];

    const handleSelectType = (newTipo: string) => {
        setTipo(newTipo);
        handleSaveDetails({ tipo: newTipo, area: parseFloat(area), esta_vacia: estaVacia });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detalles de {vivienda.tipo} {vivienda.identificador}</Text>
            </View>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información General</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Área (m²)</Text>
                        <Input
                            placeholder="Ej: 75.5"
                            value={area}
                            onChangeText={setArea}
                            onEndEditing={() => handleSaveDetails()}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Tipo de Vivienda</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.typesScroll}
                            contentContainerStyle={styles.typesScrollContent}
                        >
                            <View style={styles.typesRow}>
                                {dwellingTypes.map((t) => {
                                    const isSelected = tipo === t.label;
                                    const Icon = t.icon;
                                    return (
                                        <TouchableOpacity
                                            key={t.label}
                                            style={[
                                                styles.typeChip,
                                                isSelected && styles.typeChipSelected
                                            ]}
                                            onPress={() => handleSelectType(t.label)}
                                        >
                                            <Icon size={20} color={isSelected ? Colors.primaryForeground : Colors.primary} />
                                            <Text style={[
                                                styles.typeChipText,
                                                isSelected && styles.typeChipTextSelected
                                            ]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>

                    <View style={styles.switchGroup}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchLabel}>¿La vivienda está vacía?</Text>
                            <Text style={styles.switchSublabel}>Marque esta opción si no hay habitantes actualmente.</Text>
                        </View>
                        <Switch
                            value={estaVacia}
                            onValueChange={(val) => {
                                setEstaVacia(val);
                                handleSaveDetails({ esta_vacia: val, tipo, area: parseFloat(area) });
                            }}
                            trackColor={{ false: '#cbd5e1', true: Colors.primary + '80' }}
                            thumbColor={estaVacia ? Colors.primary : '#f1f5f9'}
                        />
                    </View>
                    {saving && <Text style={styles.savingTag}>Guardando...</Text>}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Residentes</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setIsModalVisible(true)}
                        >
                            <Plus size={20} color={Colors.primaryForeground} />
                            <Text style={styles.addButtonText}>Agregar</Text>
                        </TouchableOpacity>
                    </View>

                    {fetchingResidents ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
                    ) : residents.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Users size={40} color={Colors.muted} />
                            <Text style={styles.emptyText}>No hay residentes registrados.</Text>
                        </View>
                    ) : (
                        residents.map((item) => (
                            <View key={item.id} style={styles.residentCard}>
                                <View style={styles.residentInfo}>
                                    <Text style={styles.residentName}>{item.nombre}</Text>
                                    <View style={styles.residentDetailsRow}>
                                        <Text style={styles.residentSubtitle}>{item.relacion || 'Residente'}</Text>
                                        {item.telefono && (
                                            <Text style={styles.residentSubtitle}> • {item.telefono}</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleDeleteResident(item.id, item.nombre)}
                                    style={styles.deleteButton}
                                >
                                    <Trash2 size={20} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Modal
                transparent={true}
                visible={isModalVisible}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Residente</Text>

                        <Input
                            placeholder="Nombre completo"
                            value={newResident.nombre}
                            onChangeText={(text: string) => setNewResident({ ...newResident, nombre: text })}
                        />
                        <View style={{ height: 12 }} />
                        <Input
                            placeholder="Email (opcional)"
                            value={newResident.email}
                            onChangeText={(text: string) => setNewResident({ ...newResident, email: text })}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <View style={{ height: 12 }} />
                        <Input
                            placeholder="Teléfono"
                            value={newResident.telefono}
                            onChangeText={(text: string) => setNewResident({ ...newResident, telefono: text })}
                            keyboardType="phone-pad"
                        />
                        <View style={{ height: 12 }} />
                        <Input
                            placeholder="Relación (Ej: Familiar, Arrendatario)"
                            value={newResident.relacion}
                            onChangeText={(text: string) => setNewResident({ ...newResident, relacion: text })}
                        />

                        <View style={styles.modalButtons}>
                            <Button
                                title="Cancelar"
                                variant="ghost"
                                onPress={() => setIsModalVisible(false)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Agregar"
                                onPress={handleAddResident}
                                loading={loading}
                                style={{ flex: 1 }}
                            />
                        </View>
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
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    content: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.muted,
        marginBottom: 8,
    },
    formGroup: {
        marginBottom: 16,
    },
    switchGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        paddingTop: 10,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    switchSublabel: {
        fontSize: 12,
        color: Colors.muted,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    addButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    addButtonText: {
        color: Colors.primaryForeground,
        fontWeight: '600',
        fontSize: 14,
    },
    residentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    residentInfo: {
        flex: 1,
    },
    residentName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    residentDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    residentSubtitle: {
        fontSize: 14,
        color: Colors.muted,
    },
    deleteButton: {
        padding: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        marginTop: 10,
        color: Colors.muted,
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    savingTag: {
        fontSize: 12,
        color: Colors.primary,
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'right',
    },
    typesScroll: {
        marginHorizontal: -20,
    },
    typesScrollContent: {
        paddingHorizontal: 20,
    },
    typesRow: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 4,
    },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: Colors.secondary + '40',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 8,
    },
    typeChipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    typeChipText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    typeChipTextSelected: {
        color: Colors.primaryForeground,
        fontWeight: 'bold',
    },
});
