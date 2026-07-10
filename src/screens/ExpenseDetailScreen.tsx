import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, LayoutAnimation, Image, Modal, Linking } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Calendar, Filter, Download, ExternalLink, Receipt, DollarSign, Wallet } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import api from '../lib/api';

export const ExpenseDetailScreen = ({ navigation, route }: any) => {
    const { condoId } = route.params;
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [yearlyExpenses, setYearlyExpenses] = useState<any[]>([]);
    const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
    const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

    const fetchExpenses = async () => {
        try {
            const response = await api.get(`/movimientos/${condoId}/expenses-by-year`);
            if (response.ok) {
                const data = await response.json();
                setYearlyExpenses(data);
                
                // Expand the first year by default if it exists
                if (data.length > 0) {
                    setExpandedYears({ [data[0].year]: true });
                }
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [condoId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchExpenses();
    };

    const toggleYear = (year: number) => {
        if (Platform.OS !== 'web') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        setExpandedYears(prev => ({
            ...prev,
            [year]: !prev[year]
        }));
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Cargando detalles de gastos...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Detalle de Gastos</Text>
                    <Text style={styles.headerSubtitle}>Transparencia en la gestión</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
            >
                {yearlyExpenses.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <FileText size={64} color={Colors.muted} opacity={0.3} />
                        <Text style={styles.emptyText}>No se encontraron registros de gastos para este condominio.</Text>
                    </View>
                ) : (
                    yearlyExpenses.map((yearGroup) => (
                        <View key={yearGroup.year} style={styles.yearSection}>
                            <TouchableOpacity 
                                style={[styles.yearHeader, expandedYears[yearGroup.year] && styles.yearHeaderActive]}
                                onPress={() => toggleYear(yearGroup.year)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.yearTitleRow}>
                                    <View style={[styles.yearIconContainer, { backgroundColor: Colors.primary + '15' }]}>
                                        <Calendar size={20} color={Colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.yearTitle}>Año {yearGroup.year}</Text>
                                        <Text style={styles.yearSubtitle}>{yearGroup.expenses.length} movimientos</Text>
                                    </View>
                                </View>
                                <View style={styles.yearValueRow}>
                                    <Text style={styles.yearTotal}>${yearGroup.total.toLocaleString('es-CO')}</Text>
                                    {expandedYears[yearGroup.year] ? (
                                        <ChevronUp size={20} color={Colors.muted} />
                                    ) : (
                                        <ChevronDown size={20} color={Colors.muted} />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {expandedYears[yearGroup.year] && (
                                <View style={styles.expenseList}>
                                    {yearGroup.expenses.map((expense: any, idx: number) => (
                                        <View key={expense.id} style={[styles.expenseItem, idx === yearGroup.expenses.length - 1 && { borderBottomWidth: 0 }]}>
                                            <View style={styles.expenseLeft}>
                                                <View style={[styles.categoryBadge, { backgroundColor: '#f1f5f9' }]}>
                                                    <Text style={styles.categoryText}>{expense.get_category || expense.categoria || 'Gasto'}</Text>
                                                </View>
                                                <Text style={styles.expenseDesc}>{expense.descripcion || 'Sin descripción'}</Text>
                                                <Text style={styles.expenseDate}>
                                                    {new Date(expense.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                            <View style={styles.expenseRight}>
                                                <Text style={styles.expenseAmount}>${Number(expense.monto).toLocaleString('es-CO')}</Text>
                                                {expense.comprobante_url ? (
                                                    <TouchableOpacity 
                                                        style={styles.receiptButton}
                                                        onPress={() => setSelectedReceipt(expense.comprobante_url)}
                                                    >
                                                        <Receipt size={16} color={Colors.primary} />
                                                        <Text style={styles.receiptButtonText}>Ver</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <View style={styles.noReceipt}>
                                                        <Text style={styles.noReceiptText}>Sin soporte</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))
                )}

                <View style={styles.footerNote}>
                    <Text style={styles.footerNoteText}>
                        * Los gastos aquí presentados corresponden a los movimientos reportados por la administración del condominio.
                    </Text>
                </View>
            </ScrollView>

            {/* Receipt Modal */}
            <Modal
                visible={!!selectedReceipt}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedReceipt(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Comprobante de Gasto</Text>
                            <TouchableOpacity onPress={() => setSelectedReceipt(null)} style={styles.modalClose}>
                                <Text style={styles.modalCloseText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                        {selectedReceipt && (
                            selectedReceipt.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') ? (
                                <View style={{ flex: 1, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                                    {Platform.OS === 'web' ? (
                                        <iframe 
                                            src={selectedReceipt} 
                                            style={{ width: '100%', height: '100%', border: 'none' }} 
                                            title="Comprobante PDF"
                                        />
                                    ) : (
                                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                            <FileText size={64} color={Colors.primary} />
                                            <Text style={{ marginTop: 16, color: Colors.text, fontWeight: '600' }}>Documento PDF</Text>
                                            <Text style={{ marginTop: 8, color: Colors.muted, textAlign: 'center', paddingHorizontal: 20 }}>
                                                Usa el botón de abajo para abrir el documento.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <Image 
                                    source={{ uri: selectedReceipt }} 
                                    style={styles.receiptImage} 
                                    resizeMode="contain"
                                />
                            )
                        )}
                        <TouchableOpacity 
                            style={styles.downloadButton}
                            onPress={() => {
                                if (selectedReceipt) {
                                    Linking.openURL(selectedReceipt);
                                }
                            }}
                        >
                            <ExternalLink size={20} color="#fff" />
                            <Text style={styles.downloadButtonText}>
                                {selectedReceipt?.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') ? 'Ver PDF completo' : 'Abrir en navegador'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        ...(Platform.OS === 'web' ? { 
            height: '100vh' as any,
            maxHeight: '100vh' as any,
            overflow: 'hidden' 
        } : {})
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        color: Colors.muted,
        fontSize: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingTop: Platform.OS === 'web' ? 24 : 48,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.muted,
        marginTop: 2,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyText: {
        marginTop: 16,
        color: Colors.muted,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 20,
    },
    yearSection: {
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            }
        })
    },
    yearHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        backgroundColor: '#fff',
    },
    yearHeaderActive: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    yearTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    yearIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    yearTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    yearSubtitle: {
        fontSize: 12,
        color: Colors.muted,
    },
    yearValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    yearTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
    },
    expenseList: {
        backgroundColor: '#fafafa',
    },
    expenseItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    expenseLeft: {
        flex: 1,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#475569',
        textTransform: 'uppercase',
    },
    expenseDesc: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
        marginBottom: 4,
    },
    expenseDate: {
        fontSize: 12,
        color: Colors.muted,
    },
    expenseRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
    },
    expenseAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    receiptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    receiptButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    noReceipt: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    noReceiptText: {
        fontSize: 11,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    footerNote: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    footerNoteText: {
        fontSize: 11,
        color: Colors.muted,
        textAlign: 'center',
        lineHeight: 16,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        maxWidth: 500,
        height: '80%',
        backgroundColor: '#fff',
        borderRadius: 24,
        overflow: 'hidden',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalClose: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    modalCloseText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    receiptImage: {
        flex: 1,
        width: '100%',
        borderRadius: 12,
    },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 16,
        marginTop: 20,
        gap: 10,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
