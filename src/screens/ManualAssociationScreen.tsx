import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { Building2, Home, Search, ChevronRight, Store, Layout, LandPlot, Share2, ArrowLeft } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

import api from '../lib/api';

export const ManualAssociationScreen = ({ navigation }: any) => {
    const { updateUser } = useAuth();
    const { showAlert } = useAlert();

    const [step, setStep] = useState(1); // 1: Search Condo, 2: Select Vivienda
    const [condos, setCondos] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedCondo, setSelectedCondo] = useState<any>(null);

    const handleShare = async () => {
        try {
            await Share.share({
                message: '¡Hola! Te invito a conocer TuQuotaAdmin, la mejor plataforma para administrar nuestro condominio de forma eficiente. Visítanos en: https://tuquotaadmin.com/',
                url: 'https://tuquotaadmin.com/',
                title: 'Invitar a mi administrador',
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    useEffect(() => {
        if (step === 1) {
            fetchCondos();
        }
    }, [step]);

    const fetchCondos = async () => {
        setLoading(true);
        try {
            const response = await api.get('/condominios');
            if (response.ok) {
                const data = await response.json();
                setCondos(data);
            }
        } catch (error) {
            console.error('Error fetching condos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchViviendas = async (condoId: string) => {
        setLoading(true);
        try {
            const response = await api.get(`/condominios/${condoId}/viviendas`);
            if (response.ok) {
                const data = await response.json();
                const sortedData = [...data].sort((a, b) => a.identificador.localeCompare(b.identificador, undefined, { numeric: true }));
                setViviendas(sortedData);
            }
        } catch (error) {
            console.error('Error fetching viviendas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCondo = (condo: any) => {
        setSelectedCondo(condo);
        setStep(2);
        setSearchTerm('');
        fetchViviendas(condo.id);
    };

    const handleAssociate = async (vivienda: any) => {
        showAlert({
            title: 'Confirmar',
            message: `¿Deseas vincularte a la unidad ${vivienda.identificador} en ${selectedCondo.name}?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Vincular',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await api.post(`/condominios/${selectedCondo.id}/viviendas/${vivienda.id}/associate`, {});
                            if (response.ok) {
                                // Refresh profile to update available condos/viviendas
                                try {
                                    const profileRes = await api.get('/auth/profile');
                                    if (profileRes.ok) {
                                        const updatedUser = await profileRes.json();
                                        await updateUser(updatedUser);
                                    }
                                } catch (profileError) {
                                    console.error('Error refreshing profile after association:', profileError);
                                }

                                showAlert({
                                    title: 'Éxito',
                                    message: 'Vinculación completada correctamente.',
                                    type: 'success',
                                    onClose: () => navigation.goBack()
                                });
                            } else {
                                const errorData = await response.json().catch(() => ({}));
                                showAlert({
                                    title: 'Error',
                                    message: errorData.message || 'No se pudo completar la vinculación.',
                                    type: 'error'
                                });
                            }
                        } catch (error) {
                            console.error('Association error:', error);
                            showAlert({
                                title: 'Error',
                                message: 'Hubo un fallo en la conexión con el servidor.',
                                type: 'error'
                            });
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const getViviendaIcon = (tipo: string) => {
        switch (tipo) {
            case 'Apartamento': return <Building2 size={24} color={Colors.primary} />;
            case 'Casa': return <Home size={24} color={Colors.primary} />;
            case 'Local': return <Store size={24} color={Colors.primary} />;
            case 'Oficina': return <Layout size={24} color={Colors.primary} />;
            case 'Lote': return <LandPlot size={24} color={Colors.primary} />;
            default: return <Home size={24} color={Colors.primary} />;
        }
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredCondos = condos.filter(c => c.name.toLowerCase().includes(normalizedSearch));
    const filteredViviendas = (viviendas || [])
        .filter(v => {
            const fullString = `${v.tipo || ''} ${v.identificador || ''}`.toLowerCase();
            return fullString.includes(normalizedSearch) ||
                v.identificador.toLowerCase().includes(normalizedSearch);
        })
        .sort((a, b) => a.identificador.localeCompare(b.identificador, undefined, { numeric: true }));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => step === 2 ? setStep(1) : navigation.goBack()}
                >
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.title}>
                        {step === 1 ? 'Buscar Condominio' : 'Seleccionar Unidad'}
                    </Text>
                    {step === 2 && (
                        <Text style={styles.subtitle}>{selectedCondo.name}</Text>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <Input
                    placeholder={step === 1 ? "Nombre del condominio..." : "Tipo o identificador (A-101)..."}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Buscando...</Text>
                </View>
            ) : (
                <FlatList
                    data={step === 1 ? filteredCondos : filteredViviendas}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => step === 1 ? handleSelectCondo(item) : handleAssociate(item)}
                        >
                            <View style={styles.iconContainer}>
                                {step === 1 ? (
                                    <Building2 size={24} color={Colors.primary} />
                                ) : (
                                    getViviendaIcon(item.tipo)
                                )}
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.itemText}>
                                    {step === 1 ? item.name : `${item.tipo || 'Vivienda'} ${item.identificador}`}
                                </Text>
                                <Text style={styles.itemSubtext}>
                                    {step === 1
                                        ? `${item.ciudad || 'Sin ciudad'}, ${item.departamento || 'Colombia'}`
                                        : `${item.area ? item.area + ' m²' : 'Área no registrada'}`}
                                </Text>
                            </View>
                            <ChevronRight size={20} color={Colors.muted} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            {step === 1 ? (
                                <TouchableOpacity style={styles.shareCard} onPress={handleShare}>
                                    <Share2 size={64} color={Colors.primary} style={{ marginBottom: 16 }} />
                                    <Text style={styles.emptyTitle}>¿No encuentras tu condominio?</Text>
                                    <Text style={styles.emptyText}>
                                        ¡Anima a tu administrador a usar TuQuotaAdmin para gestionar los pagos de forma fácil y segura!
                                    </Text>
                                    <Text style={styles.emptyLink}>¡Invítalo a unirse hoy mismo!</Text>
                                </TouchableOpacity>
                            ) : viviendas.length === 0 ? (
                                <>
                                    <Building2 size={64} color={Colors.border} style={{ marginBottom: 16 }} />
                                    <Text style={styles.emptyTitle}>¡Casi listo!</Text>
                                    <Text style={styles.emptyText}>
                                        Parece que tu administrador aún está preparando la lista de viviendas para este condominio. {"\n\n"}
                                        Por favor, intenta de nuevo un poco más tarde. ¡Gracias por tu paciencia!
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Search size={48} color={Colors.border} style={{ marginBottom: 16 }} />
                                    <Text style={styles.emptyText}>No encontramos ninguna unidad que coincida con "{searchTerm}"</Text>
                                    <Text style={styles.emptySubtext}>Prueba buscando por el número o identificador (ej: 101, A-302)</Text>
                                </>
                            )}
                        </View>
                    }
                />
            )}

            {step === 2 && (
                <View style={styles.footer}>
                    <Button
                        title="Volver a buscar condominio"
                        onPress={() => { setStep(1); setSearchTerm(''); }}
                        variant="ghost"
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.muted,
        marginTop: 4,
        textAlign: 'center',
    },
    searchContainer: {
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    list: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    listContent: {
        padding: 24,
        paddingBottom: 40,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.secondary,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    itemText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
    },
    itemSubtext: {
        fontSize: 14,
        color: Colors.muted,
        marginTop: 2,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        marginTop: 40,
    },
    shareCard: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: Colors.muted,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
        color: Colors.muted,
        lineHeight: 22,
    },
    emptyLink: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: Colors.muted,
        textAlign: 'center',
        marginTop: 8,
    },
    footer: {
        padding: 16,
    },
});
