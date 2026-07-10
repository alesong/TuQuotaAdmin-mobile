import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { ArrowLeft, DollarSign, CheckCircle, AlertCircle, TrendingUp, Calendar, BarChart3, Wallet, FileText, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import api from '../lib/api';

export const CondoDashboardScreen = ({ navigation, route }: any) => {
    const { condoId } = route.params;
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [compliance, setCompliance] = useState<any[]>([]);
    const [globalFinances, setGlobalFinances] = useState<any>(null);

    const fetchData = async () => {
        try {
            const [summaryRes, complianceRes, financeRes] = await Promise.all([
                api.get(`/condominios/${condoId}/viviendas/payment-summary`),
                api.get(`/condominios/${condoId}/cuotas/stats/compliance`),
                api.get(`/movimientos/${condoId}/global-summary`)
            ]);

            if (summaryRes.ok) {
                setSummary(await summaryRes.json());
            }

            if (complianceRes.ok) {
                const data = await complianceRes.json();
                setCompliance(data.sort((a: any, b: any) => b.period.localeCompare(a.period)).slice(0, 6));
            }

            if (financeRes.ok) {
                setGlobalFinances(await financeRes.json());
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [condoId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Custom pull-to-refresh for Web
    const scrollRef = useRef<ScrollView>(null);
    const touchY = useRef(0);
    const isPulling = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleTouchStart = (e: any) => {
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            touchY.current = clientY;
        };

        const handleTouchMove = (e: any) => {
            if (refreshing) return;
            
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const diff = clientY - touchY.current;
            
            const scrollNode = (scrollRef.current as any)?.getScrollableNode();
            if (scrollNode && scrollNode.scrollTop <= 0 && diff > 150 && !isPulling.current) {
                isPulling.current = true;
                onRefresh();
                setTimeout(() => {
                    isPulling.current = false;
                }, 2000);
            }
        };

        const scrollNode = (scrollRef.current as any)?.getScrollableNode();
        if (scrollNode) {
            scrollNode.addEventListener('touchstart', handleTouchStart);
            scrollNode.addEventListener('mousedown', handleTouchStart);
            scrollNode.addEventListener('touchmove', handleTouchMove);
            scrollNode.addEventListener('mousemove', handleTouchMove);
        }

        return () => {
            if (scrollNode) {
                scrollNode.removeEventListener('touchstart', handleTouchStart);
                scrollNode.removeEventListener('mousedown', handleTouchStart);
                scrollNode.removeEventListener('touchmove', handleTouchMove);
                scrollNode.removeEventListener('mousemove', handleTouchMove);
            }
        };
    }, [refreshing]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const totalRecaudado = summary?.summary.reduce((acc: number, i: any) => acc + (i.totalPagosLast12Months || 0), 0) || 0;
    const totalPorCobrar = summary?.summary.reduce((acc: number, i: any) => acc + (i.balance > 0 ? i.balance : 0), 0) || 0;
    const totalViviendas = summary?.summary.length || 0;
    const alDia = summary?.summary.filter((i: any) => i.status === 'AL_DIA').length || 0;
    const enMora = totalViviendas - alDia;
    const complianceRate = totalViviendas > 0 ? (alDia / totalViviendas) * 100 : 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Dashboard General</Text>
                    <Text style={styles.headerSubtitle}>Estado Financiero y Cumplimiento</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
                ref={scrollRef}
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
            >
                {/* Financial Summary Highlight */}
                <View style={styles.financeHeader}>
                    <View style={styles.balanceCard}>
                        <View style={styles.balanceIconBg}>
                            <Wallet color="#fff" size={24} />
                        </View>
                        <View>
                            <Text style={styles.balanceLabel}>Saldo Actual de Caja</Text>
                            <Text style={styles.balanceValue}>
                                ${globalFinances?.saldoActual?.toLocaleString('es-CO', { maximumFractionDigits: 0 }) || '0'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={styles.expensesMainCard}
                        onPress={() => navigation.navigate('ExpenseDetail', { condoId })}
                        activeOpacity={0.9}
                    >
                        <View style={styles.expensesContent}>
                            <View style={styles.expensesIconBg}>
                                <FileText color="#fff" size={24} />
                            </View>
                            <View>
                                <Text style={styles.expensesLabel}>Total de Gastos (Período)</Text>
                                <Text style={styles.expensesValue}>
                                    ${globalFinances?.totalEgresos?.toLocaleString('es-CO', { maximumFractionDigits: 0 }) || '0'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.linkIndicator}>
                            <TrendingUp size={16} color="#475569" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Grid Stats */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderLeftColor: Colors.success }]}>
                        <DollarSign size={20} color={Colors.success} style={styles.statIcon} />
                        <Text style={styles.statLabel}>Recaudado Total</Text>
                        <Text style={styles.statValue}>${globalFinances?.totalIngresos?.toLocaleString('es-CO', { maximumFractionDigits: 0 }) || '0'}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                        <TrendingUp size={20} color="#f59e0b" style={styles.statIcon} />
                        <Text style={styles.statLabel}>Por Recaudar</Text>
                        <Text style={styles.statValue}>${totalPorCobrar.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                    </View>
                </View>

                {/* Units Status */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderLeftColor: Colors.primary }]}>
                        <CheckCircle size={20} color={Colors.primary} style={styles.statIcon} />
                        <Text style={styles.statLabel}>Unidades al Día</Text>
                        <Text style={styles.statValue}>{alDia} / {totalViviendas}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: Colors.error }]}>
                        <AlertCircle size={20} color={Colors.error} style={styles.statIcon} />
                        <Text style={styles.statLabel}>Unidades en Mora</Text>
                        <Text style={styles.statValue}>{enMora}</Text>
                    </View>
                </View>

                {/* Compliance Progress Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <BarChart3 size={20} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Nivel de Cumplimiento Global</Text>
                    </View>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBarBackground}>
                            <View style={[styles.progressBarFill, { width: `${complianceRate}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{complianceRate.toFixed(1)}% de las unidades al día</Text>
                    </View>
                </View>

                {/* Historical Compliance List */}
                {compliance.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Histórico de Cumplimiento</Text>
                        {compliance.map((item, index) => (
                            <View key={index} style={styles.complianceRow}>
                                <Calendar size={16} color={Colors.muted} />
                                <Text style={styles.periodText}>{item.period}</Text>
                                <View style={styles.periodProgress}>
                                    <View style={[styles.periodBarFill, { width: `${item.compliance}%` }]} />
                                </View>
                                <Text style={styles.periodValue}>{Math.round(item.compliance)}%</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                        * Esta información fomenta la transparencia y el bienestar de nuestra comunidad mediante el conocimiento del estado financiero compartido.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.secondary,
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
        backgroundColor: Colors.secondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingTop: Platform.OS === 'web' ? 24 : 48,
        backgroundColor: Colors.background,
        position: 'relative',
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
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
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.muted,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    financeHeader: {
        marginBottom: 24,
        gap: 16,
    },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        padding: 20,
        borderRadius: 24,
        gap: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    balanceIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    balanceValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    expensesMainCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    expensesContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    expensesIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    expensesLabel: {
        fontSize: 12,
        color: Colors.muted,
        fontWeight: '600',
    },
    expensesValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    linkIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    linkText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 20,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statIcon: {
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 11,
        color: Colors.muted,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    card: {
        backgroundColor: Colors.background,
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    progressContainer: {
        gap: 8,
    },
    progressBarBackground: {
        height: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 6,
    },
    progressText: {
        fontSize: 12,
        color: Colors.muted,
        textAlign: 'center',
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 16,
        paddingLeft: 4,
    },
    complianceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        gap: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    periodText: {
        width: 70,
        fontSize: 14,
        color: Colors.text,
        fontWeight: '600',
    },
    periodProgress: {
        flex: 1,
        height: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    periodBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    periodValue: {
        width: 40,
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary,
        textAlign: 'right',
    },
    infoCard: {
        padding: 20,
        backgroundColor: Colors.primary + '08',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary + '15',
    },
    infoText: {
        fontSize: 12,
        color: Colors.muted,
        textAlign: 'center',
        lineHeight: 18,
    },
});

