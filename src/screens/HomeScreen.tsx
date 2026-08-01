if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
}
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, Image, RefreshControl, AppState, Platform, Linking, PanResponder, Animated, Easing, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, Lock, Bell, Megaphone, ChevronRight, Home as HomeIcon, Info, ReceiptText, ChevronDown, ChevronUp, X, AlertCircle, CheckCircle2, User, Building2, Store, Layout, LandPlot, Square, CheckSquare, MapPin, BarChart3, ShieldCheck, Share2, Zap, Droplet, Flame, Wifi, Tv } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { CondoSelectorModal } from '../components/CondoSelectorModal';
import { registerForPushNotificationsAsync, updateAppBadge } from '../lib/notifications';
import { AlertModal } from '../components/AlertModal';
import AsyncStorage from '@react-native-async-storage/async-storage';



import { Assets } from '../constants/Assets';
import api from '../lib/api';

const months = ["Ene", "Feb", "Mar", "Abr", "Mayo", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const DwellingBadge = ({ type, identifier }: { type: string, identifier: string }) => {
    let Icon = Layout;
    let color = Colors.primary;
    const normalizedType = type?.toLowerCase() || '';

    if (normalizedType.includes('casa')) {
        Icon = HomeIcon;
        color = "#f59e0b"; // Amber-500
    } else if (normalizedType.includes('apartamento') || normalizedType.includes('apto')) {
        Icon = Building2;
        color = "#3b82f6"; // Blue-500
    } else if (normalizedType.includes('local')) {
        Icon = Store;
        color = "#a855f7"; // Purple-500
    } else if (normalizedType.includes('oficina')) {
        Icon = Layout;
        color = "#64748b"; // Slate-500
    } else if (normalizedType.includes('lote')) {
        Icon = LandPlot;
        color = "#10b981"; // Emerald-500
    }

    return (
        <View style={styles.badgeWrapper}>
            <View style={[styles.iconBadgeBackground, { backgroundColor: color + '25' }]}>
                <Icon size={44} color={color} opacity={0.3} strokeWidth={1.5} />
                <View style={styles.identifierOverlay}>
                    <Text 
                        style={[styles.dwellingBadgeText, { color: color }, identifier?.length > 7 && { fontSize: 12 }]} 
                        numberOfLines={1}
                        ellipsizeMode="clip"
                    >
                        {identifier}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const ActionCard = ({ icon: Icon, title, subtitle, onPress, color = Colors.primary }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Icon size={24} color={color} />
        </View>
        <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <ChevronRight size={20} color={Colors.muted} />
    </TouchableOpacity>
);

const StatCard = ({ title, value, type }: any) => (
    <View style={styles.statCard}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[
            styles.statValue,
            { color: type === 'warning' ? '#b45309' : type === 'success' ? '#15803d' : Colors.text }
        ]}>
            {value}
        </Text>
    </View>
);

const LoadingBar = ({ isLoading }: { isLoading: boolean }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isLoading) {
            // Increased speed for a more dynamic "loading" feel
            Animated.loop(
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.bezier(0.4, 0, 0.2, 1),
                    useNativeDriver: false,
                })
            ).start();
        } else {
            anim.setValue(0);
        }
    }, [isLoading]);

    if (!isLoading) return null;

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 1000],
    });

    return (
        <View style={styles.loadingBarContainer}>
            <View style={styles.loadingBarTrack}>
                <Animated.View 
                    style={[
                        styles.loadingBarGradient, 
                        { transform: [{ translateX }] },
                        Platform.OS === 'web' && ({
                            // Sharper gradient showing logo palette: Blue, Amber, Emerald
                            // Reduced white breadth as requested to emphasize the colors
                            backgroundImage: 'linear-gradient(90deg, rgba(30,58,138,0) 0%, #1e3a8a 25%, #f59e0b 50%, #10b981 75%, rgba(16,185,129,0) 100%)',
                        } as any)
                    ]} 
                />
            </View>
        </View>
    );
};

export const HomeScreen = ({ navigation }: any) => {
    const { user: authUser, updateUser, token } = useAuth();
    const { showAlert } = useAlert();
    const [refreshing, setRefreshing] = useState(false);

    // State for selected condo
    const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null);
    const [isStatementModalVisible, setIsStatementModalVisible] = useState(false);
    const [isServiciosModalVisible, setIsServiciosModalVisible] = useState(false);
    const [isCondoSelectorVisible, setIsCondoSelectorVisible] = useState(false);
    const [selectedViviendaForStatement, setSelectedViviendaForStatement] = useState<any>(null);
    const [lastSelectedCondoLoading, setLastSelectedCondoLoading] = useState(true);
    const [lastSelectedCondoId, setLastSelectedCondoId] = useState<string | null>(null);
    const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
    const [selectedCuotaIds, setSelectedCuotaIds] = useState<Record<string, boolean>>({});
    const [condoNotifications, setCondoNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [isSmartHomeModalVisible, setIsSmartHomeModalVisible] = useState(false);
    const [selectedViviendaForSmartHome, setSelectedViviendaForSmartHome] = useState<any>(null);
    const [pullProgress, setPullProgress] = useState(0);
    const [isUpToDateModalVisible, setIsUpToDateModalVisible] = useState(false);
    const [upToDateVivienda, setUpToDateVivienda] = useState<any>(null);
    const [hasPortalServices, setHasPortalServices] = useState(false);

    const hasUnits = (authUser?.viviendas?.length ?? 0) > 0;

    // Group dwellings by condominium
    const condosMap = React.useMemo(() => {
        const map = new Map<string, any>();
        if (!authUser?.viviendas) return map;

        authUser.viviendas.forEach((assoc: any) => {
            const v = assoc?.vivienda;
            const condo = v?.condominio;
            if (v && condo && condo.id) {
                if (!map.has(condo.id)) {
                    map.set(condo.id, {
                        ...condo,
                        viviendas: []
                    });
                }
                map.get(condo.id).viviendas.push(v);
            }
        });
        return map;
    }, [authUser]); // Depend on authUser as a whole to be safer


    const availableCondos = Array.from(condosMap.values());

    // Initialize induction/selection
    useEffect(() => {
        const loadLastCondo = async () => {
            try {
                const savedCondoId = await AsyncStorage.getItem('@TuQuotaAdmin:lastCondoId');
                if (savedCondoId) {
                    setLastSelectedCondoId(savedCondoId);
                }
            } catch (e) {
                console.error('[HomeScreen] Error loading last condo ID:', e);
            } finally {
                setLastSelectedCondoLoading(false);
            }
        };
        loadLastCondo();
    }, []);

    useEffect(() => {
        if (!lastSelectedCondoLoading && hasUnits && availableCondos.length > 0) {
            if (!selectedCondoId || !condosMap.has(selectedCondoId)) {
                // If we have a saved condo ID and it's valid for this user, use it
                if (lastSelectedCondoId && condosMap.has(lastSelectedCondoId)) {
                    setSelectedCondoId(lastSelectedCondoId);
                } else {
                    setSelectedCondoId(availableCondos[0].id);
                }
            } else if (selectedCondoId && selectedCondoId !== lastSelectedCondoId) {
                // Save the selected condo ID whenever it changes and is valid, and is different from what we thought was last
                AsyncStorage.setItem('@TuQuotaAdmin:lastCondoId', selectedCondoId);
                setLastSelectedCondoId(selectedCondoId);
            }
        } else if (!hasUnits) {
            setSelectedCondoId(null);
        }
    }, [hasUnits, availableCondos, selectedCondoId, lastSelectedCondoId, lastSelectedCondoLoading]);


    const selectedCondo = selectedCondoId ? condosMap.get(selectedCondoId) : null;

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
            fetchUnreadCount();
            fetchPortalServicesStatus();
            if (selectedCondoId) {
                fetchNotifications(selectedCondoId);
            }
        }, [selectedCondoId])
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                console.log('[HomeScreen] App came to foreground, refreshing profile...');
                fetchProfile();
                fetchUnreadCount();
                if (selectedCondoId) {
                    fetchNotifications(selectedCondoId);
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [selectedCondoId]);

    // La alerta modal para activar push ahora se maneja dentro de NotificationsScreen

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/notifications/unread/count');
            if (response.ok) {
                const count = await response.json();
                const numericCount = Number(count);
                setUnreadCount(numericCount);
                
                // Update App Icon Badge
                updateAppBadge(numericCount);
            }
        } catch (e) {
            console.error('[HomeScreen] Error fetching unread count:', e);
        }
    };

    const fetchPortalServicesStatus = async () => {
        try {
            const response = await api.get('/resident-services/has-any');
            if (response.ok) {
                const data = await response.json();
                setHasPortalServices(data.hasServices);
            }
        } catch (e) {
            console.error('[HomeScreen] Error fetching portal services status:', e);
            setHasPortalServices(false);
        }
    };

    useEffect(() => {
        updateAppBadge(unreadCount);
    }, [unreadCount]);

    const fetchNotifications = async (condoId: string) => {
        if (!condoId) return;

        console.log(`[HomeScreen] Triggering notification fetch for: ${condoId}`);
        setIsLoadingNotifications(true);
        try {
            const response = await api.get(`/condominios/${condoId}/notifications`);
            if (response.ok) {
                const data = await response.json();
                console.log(`[HomeScreen] Notifications successfully fetched: ${data.length}`);
                setCondoNotifications(data);
            } else {
                console.error(`[HomeScreen] HTTP Error fetching notifications: ${response.status}`);
                try {
                    const errorData = await response.json();
                    console.error(`[HomeScreen] Server Response: ${JSON.stringify(errorData)}`);
                } catch (jsonErr) {
                    console.error(`[HomeScreen] Could not parse error response as JSON`);
                }
            }
        } catch (error) {
            console.error('[HomeScreen] Exception in fetchNotifications:', error);
        } finally {
            console.log('[HomeScreen] fetchNotifications finished');
            setIsLoadingNotifications(false);
        }
    };

    const isAdminOfSelectedCondo = React.useMemo(() => {
        if (!authUser || !selectedCondoId) return false;
        const isMainAdmin = (authUser as any).condominios_administrados?.some((c: any) => c.id === selectedCondoId);
        const isGuestAdmin = (authUser as any).guest_condos?.some((gc: any) => gc.condominio_id === selectedCondoId);
        return isMainAdmin || isGuestAdmin || authUser?.role === 'SUPERADMIN';
    }, [authUser, selectedCondoId]);

    const handleOpenAdmin = () => {
        const url = `https://app.tuquotaadmin.com`;
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    const handleShare = async () => {
        try {
            const message = 'Hola, te invito a usar la aplicación TuQuotaAdmin para consultar el estado de cuenta de la administración de tu propiedad horizontal. ¡Es muy fácil! Haz clic en “Instalar” y regístrate: https://pro.tuquotaadmin.com';
            
            if (Platform.OS === 'web' && (navigator as any).share) {
                await (navigator as any).share({
                    title: 'TuQuotaAdmin',
                    text: message,
                    url: 'https://pro.tuquotaadmin.com',
                });
            } else {
                await Share.share({
                    message: message,
                    url: 'https://pro.tuquotaadmin.com',
                    title: 'Compartir TuQuotaAdmin'
                });
            }
        } catch (error: any) {
            console.error('Error sharing:', error);
        }
    };

    const fetchProfile = async () => {
        console.log('[HomeScreen] Fetching profile...');
        try {
            const response = await api.get('/auth/profile');
            if (response.ok) {
                const updatedUser = await response.json();
                console.log('[HomeScreen] Profile updated successfully');
                await updateUser(updatedUser);
            } else {
                console.warn(`[HomeScreen] Profile fetch failed with status: ${response.status}`);
                if (response.status === 401) {
                    // Possible token expiration
                    console.warn('[HomeScreen] Token might be expired (401)');
                }
            }
        } catch (error) {
            console.error('[HomeScreen] Error fetching profile:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchProfile();
        await fetchUnreadCount();
        if (selectedCondoId) {
            await fetchNotifications(selectedCondoId);
        }
        setRefreshing(false);
    };


    const handleSwitchCondo = () => {
        if (availableCondos.length <= 1) {
            if (selectedCondo) {
                showAlert({
                    title: selectedCondo.name || 'Condominio',
                    message: `Dirección: ${selectedCondo.direccion || `${selectedCondo.ciudad || ''}${selectedCondo.departamento ? `, ${selectedCondo.departamento}` : ''}` || 'Sin dirección registrada'}\nTus unidades: ${selectedCondo.viviendas?.length || 0}${selectedCondo.estado ? `\nEstado: ${selectedCondo.estado}` : ''}`,
                    type: 'info',
                });
            }
            return;
        }
        setIsCondoSelectorVisible(true);
    };

    const toggleYear = (year: number) => {
        setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
    };

    const toggleCuotaSelection = (id: string) => {
        setSelectedCuotaIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Custom pull-to-refresh for Web
    const scrollRef = useRef<ScrollView>(null);
    const touchY = useRef(0);
    const isPulling = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleTouchStart = (e: any) => {
            if (refreshing) return;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            touchY.current = clientY;
            setPullProgress(0);
        };

        const handleTouchMove = (e: any) => {
            if (refreshing) return;
            
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const diff = clientY - touchY.current;
            
            // Check if at top of scroll
            const scrollNode = (scrollRef.current as any)?.getScrollableNode();
            if (scrollNode && scrollNode.scrollTop <= 0 && diff > 0) {
                // Visualize progress
                const progress = Math.min(diff / 300, 1);
                setPullProgress(progress);

                if (diff > 300 && !isPulling.current) {
                    isPulling.current = true;
                    setPullProgress(1);
                    handleRefresh();
                    // Reset pulling state after a delay or when refreshing finishes
                    setTimeout(() => {
                        isPulling.current = false;
                        setPullProgress(0);
                    }, 2000);
                }
            } else {
                setPullProgress(0);
            }
        };

        const handleTouchEnd = () => {
            if (!isPulling.current) {
                setPullProgress(0);
            }
        };

        const scrollNode = (scrollRef.current as any)?.getScrollableNode();
        if (scrollNode) {
            scrollNode.addEventListener('touchstart', handleTouchStart);
            scrollNode.addEventListener('mousedown', handleTouchStart);
            scrollNode.addEventListener('touchmove', handleTouchMove);
            scrollNode.addEventListener('mousemove', handleTouchMove);
            scrollNode.addEventListener('touchend', handleTouchEnd);
            scrollNode.addEventListener('mouseup', handleTouchEnd);
        }

        return () => {
            if (scrollNode) {
                scrollNode.removeEventListener('touchstart', handleTouchStart);
                scrollNode.removeEventListener('mousedown', handleTouchStart);
                scrollNode.removeEventListener('touchmove', handleTouchMove);
                scrollNode.removeEventListener('mousemove', handleTouchMove);
                scrollNode.removeEventListener('touchend', handleTouchEnd);
                scrollNode.removeEventListener('mouseup', handleTouchEnd);
            }
        };
    }, [refreshing, handleRefresh]);

    const getSelectedCount = () => Object.values(selectedCuotaIds).filter(Boolean).length;

    const getSelectedTotal = (pendientes: any[]) => {
        return pendientes
            .filter(c => selectedCuotaIds[c.id])
            .reduce((acc, c) => acc + (c.saldoPendiente || 0), 0);
    };

    const getMonthlyCuota = (summary: any) => {
        const items = [...(summary.pagadas || []), ...(summary.pendientes || [])];
        items.sort((a: any, b: any) => (b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes));
        return Number(items[0]?.monto) || 0;
    };

    const groupHistoryByYear = (summary: any) => {
        const allItems = [...(summary.pendientes || []), ...(summary.pagadas || [])];
        const groups: Record<number, any[]> = {};

        allItems.forEach(item => {
            const dateStr = item.fechaVencimiento || item.fechaPago;
            // Priorizar el año de la cuota (item.anio) para agrupar correctamente en el estado de cuenta
            const y = item.anio || (dateStr ? new Date(dateStr).getFullYear() : 2024);
            if (!groups[y]) {
                groups[y] = [];
            }
            groups[y].push(item);
        });

        // Sort years descending (newest year first)
        return Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a)).map(y => ({
            year: parseInt(y),
            // Sort items descending (newest month first)
            items: groups[parseInt(y)].sort((a, b) => (b.mes || 0) - (a.mes || 0))
        }));
    };

    const isRestricted = selectedCondo?.estado === 'PENDIENTE' || selectedCondo?.estado === 'BLOQUEADO';

    const handlePaymentPress = (onPress: () => void) => {
        if (selectedCondo?.estado === 'PENDIENTE') {
            showAlert({
                title: 'Pagos en Línea Temporalmente Suspendidos',
                message: '¡Hola! Estamos terminando de configurar todo para que puedas pagar en línea. Por ahora, puedes realizar tus pagos directamente por caja menor con el administrador. ¡Muchas gracias por tu paciencia!',
                type: 'warning'
            });
            return;
        }
        if (selectedCondo?.estado === 'BLOQUEADO') {
            showAlert({
                title: 'Condominio Bloqueado',
                message: 'Los pagos para este condominio han sido restringidos temporalmente por administración. Por favor, contacte a su administrador.',
                type: 'error'
            });
            return;
        }
        onPress();
    };


    const userPhoto = authUser?.photo_url
        ? { uri: `${authUser.photo_url.startsWith('http') ? authUser.photo_url : `${Config.API_URL.replace('/api', '')}${authUser.photo_url}`}${authUser.photo_url.includes('?') ? '&' : '?' }v=${new Date(authUser.updated_at || Date.now()).getTime()}` }
        : null;




    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Image
                            source={Assets.logoBig}
                            style={{ height: 40, width: 160, marginLeft: -15 }}
                            resizeMode="contain"
                        />
                    </View>
                    <TouchableOpacity 
                        style={styles.headerNotificationBtn} 
                        onPress={() => navigation.navigate('Notifications')}
                    >
                        <Bell size={24} color={Colors.primary} />
                        {unreadCount > 0 && (
                            <View style={styles.headerNotificationBadge}>
                                <Text style={styles.headerNotificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
                        <View style={styles.avatarMini}>
                            {userPhoto ? (
                                <Image source={userPhoto as any} style={styles.avatarImageMini} />
                            ) : (
                                <User size={24} color={Colors.primary} />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {selectedCondo && (
                    <View style={styles.selectorsRow}>
                        <TouchableOpacity
                            onPress={handleSwitchCondo}
                            style={[styles.selectorItem, availableCondos.length > 1 && styles.activeSelector]}
                        >
                            <Building2 size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                            <Text style={styles.condoName} numberOfLines={1} ellipsizeMode="tail">
                                {selectedCondo.name}
                            </Text>
                            {availableCondos.length > 1 && (
                                <View style={styles.chevronBadge}>
                                    <ChevronDown size={12} color={Colors.primary} />
                                </View>
                            )}
                        </TouchableOpacity>

                        {(selectedCondo?.pref_show_finanzas_pro !== false || isAdminOfSelectedCondo) && (
                            <TouchableOpacity
                                style={styles.dashboardButton}
                                onPress={() => navigation.navigate('CondoDashboard', { condoId: selectedCondoId })}
                            >
                                <BarChart3 size={16} color={Colors.primary} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.dashboardButton}
                            onPress={handleShare}
                        >
                            <Share2 size={16} color={Colors.primary} />
                        </TouchableOpacity>

                        {isAdminOfSelectedCondo && (
                            <TouchableOpacity
                                style={styles.adminButton}
                                onPress={handleOpenAdmin}
                            >
                                <ShieldCheck size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                                <Text style={styles.adminButtonText}>Administrar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.bodyContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
                }
            >
                <View style={styles.loadingArea}>
                    {(pullProgress > 0 && !refreshing) && (
                        <View style={[styles.pullIndicator, { height: pullProgress * 40, opacity: pullProgress }]}>
                            <View style={{ transform: [{ rotate: pullProgress === 1 ? '180deg' : '0deg' }] } as any}>
                                <ChevronDown size={20} color={Colors.primary} />
                            </View>
                            <View style={styles.pullTrack}>
                                <View style={[styles.pullBar, { width: `${pullProgress * 100}%` }]} />
                            </View>
                        </View>
                    )}
                    <LoadingBar isLoading={isLoadingNotifications || (refreshing && Platform.OS === 'web')} />
                </View>

                {!hasUnits ? (
                    <TouchableOpacity
                        style={styles.onboardingCard}
                        onPress={() => navigation.navigate('ManualAssociation')}
                    >
                        <View style={styles.onboardingIcon}>
                            <HomeIcon size={24} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.onboardingTitle}>¡Bienvenido! Vincula tu unidad</Text>
                            <Text style={styles.onboardingText}>Para comenzar a gestionar tus pagos y recibir comunicados, por favor vincula tu primera unidad residencial aquí.</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.primary} />
                    </TouchableOpacity>
                ) : (
                    <>
                        {isRestricted && (
                            <View style={[styles.warningCard, { backgroundColor: selectedCondo?.estado === 'BLOQUEADO' ? '#fef2f2' : '#fffbeb', borderColor: selectedCondo?.estado === 'BLOQUEADO' ? '#fecaca' : '#fef3c7' }]}>
                                <View style={[styles.warningIcon, { backgroundColor: selectedCondo?.estado === 'BLOQUEADO' ? '#fee2e2' : '#fef9c3' }]}>
                                    <AlertCircle size={24} color={selectedCondo?.estado === 'BLOQUEADO' ? '#dc2626' : '#d97706'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.warningTitle, { color: selectedCondo?.estado === 'BLOQUEADO' ? '#991b1b' : '#92400e' }]}>
                                        {selectedCondo?.estado === 'BLOQUEADO' ? 'Pagos Restringidos' : '¡Pronto estaremos listos!'}
                                    </Text>
                                    <Text style={[styles.warningText, { color: selectedCondo?.estado === 'BLOQUEADO' ? '#b91c1c' : '#a16207' }]}>
                                        {selectedCondo?.estado === 'BLOQUEADO'
                                            ? 'Los pagos han sido suspendidos temporalmente por la administración.'
                                            : 'Los pagos en línea no están habilitados aún, pero puedes pagar por caja menor con el administrador.'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {condoNotifications.length > 0 && (
                            <View style={styles.section}>
                                {condoNotifications.map((notif) => (
                                    <View key={notif.id} style={styles.notificationCard}>
                                        <View style={styles.notificationIcon}>
                                            <Megaphone size={18} color={Colors.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.notificationTitle}>{notif.subject}</Text>
                                            <Text style={styles.notificationBody}>{notif.body}</Text>
                                            <Text style={styles.notificationTime}>
                                                {new Date(notif.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}


                        {selectedCondo?.viviendas?.map((vivienda: any) => {
                            const summary = vivienda.summary || { balance: 0, lastPayment: null, pendientes: [], pagadas: [] };
                            const balanceValue = Math.abs(summary.balance || 0);
                            const balanceString = `$${balanceValue.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
                            const lastPayment = summary.lastPayment;
                            const lastPaymentString = lastPayment
                                ? new Date(lastPayment).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
                                : 'N/A';

                            return (
                                <View key={vivienda.id} style={styles.dwellingContainer}>
                                    <View style={styles.dwellingHeader}>
                                        <DwellingBadge type={vivienda.tipo} identifier={vivienda.identificador} />
                                        <Text style={styles.dwellingType}>{vivienda.tipo || 'Residencial'}</Text>
                                    </View>

                                    <View style={styles.statsRow}>
                                        <StatCard
                                            title="Saldo Pendiente"
                                            value={summary.balance > 0 ? balanceString : '$0'}
                                            type={summary.balance > 0 ? 'warning' : 'success'}
                                        />
                                        <StatCard title="Último Pago" value={lastPaymentString} type="success" />
                                    </View>

                                    {/* Estado de Cuenta section (Button) */}
                                    <View style={styles.statementSection}>
                                        <TouchableOpacity
                                            style={[styles.statementButton, { backgroundColor: summary.balance > 0 ? '#f59e0b' : '#10b981' }]}
                                            onPress={() => {
                                                setSelectedViviendaForStatement(vivienda);
                                                setIsStatementModalVisible(true);
                                            }}
                                        >
                                            <View style={styles.statementIconContainer}>
                                                <ReceiptText size={24} color={Colors.primaryForeground} />
                                            </View>
                                            <View style={styles.statementTextContainer}>
                                                <Text style={styles.statementButtonText}>Ver Estado de Cuenta</Text>
                                                <Text style={styles.statementButtonSubtext}>por meses</Text>
                                            </View>
                                            <View style={styles.statementAmountBadge}>
                                                <Text style={styles.statementAmountBadgeText}>
                                                    {summary.balance > 0 ? `-${balanceString}` : '$0'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.actionsContainer}>
                                        <ActionCard
                                            icon={CreditCard}
                                            title="Pagar Administración"
                                            subtitle={selectedCondo?.estado === 'PENDIENTE' ? 'Pagos en línea suspendidos. Pago por caja menor disponible.' : (isRestricted ? 'Pagos inhabilitados temporalmente' : (summary.balance > 0 ? `Saldo pendiente: ${balanceString}` : 'Al día con tus pagos'))}
                                            onPress={() => {
                                                handlePaymentPress(() => {
                                                    if (summary.balance > 0) {
                                                        navigation.navigate('Payments', {
                                                            viviendaId: vivienda.id,
                                                            condominioId: selectedCondoId,
                                                            monto: summary.balance,
                                                            cuotaIds: summary.pendientes?.map((p: any) => p.id) || [],
                                                            viviendasCount: 1
                                                        });
                                                    } else {
                                                        setUpToDateVivienda(vivienda);
                                                        setIsUpToDateModalVisible(true);
                                                    }
                                                });
                                            }}
                                            color={isRestricted ? Colors.muted : (summary.balance > 0 ? '#f59e0b' : '#10b981')}
                                        />

                                                                                 {Array.isArray(selectedCondo?.enlaces_servicios) && selectedCondo.enlaces_servicios.length > 0 && (
                                            <ActionCard
                                                icon={Zap}
                                                title="Pagar Servicios Públicos"
                                                subtitle="Electricidad, Agua, Gas e Internet"
                                                onPress={() => setIsServiciosModalVisible(true)}
                                                color="#6366f1"
                                            />
                                        )}
                                        {hasPortalServices && (
                                            <ActionCard
                                                icon={Lock}
                                                title="Mis Servicios"
                                                subtitle="Control de portón, cámaras y zonas comunes"
                                                onPress={() => navigation.navigate('MyServices')}
                                                color="#22c55e"
                                            />
                                        )}
                                        <TouchableOpacity
                                            style={styles.detailsButton}
                                            onPress={() => navigation.navigate('DwellingDetails', {
                                                vivienda,
                                                condominioId: selectedCondoId
                                            })}
                                        >
                                            <Info size={18} color={Colors.primary} />
                                            <Text style={styles.detailsButtonText}>Ver Detalles y Residentes</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}

                        {selectedCondo?.viviendas && selectedCondo.viviendas.length > 1 && (() => {
                            const totalCondoBalance = selectedCondo.viviendas.reduce((acc: number, v: any) => acc + (v.summary?.balance || 0), 0);
                            const totalPaid = selectedCondo.viviendas.reduce((acc: number, v: any) => acc + (v.summary?.totalPagados || 0), 0);
                            const totalBilled = selectedCondo.viviendas.reduce((acc: number, v: any) => acc + (v.summary?.totalCuotas || 0), 0);

                            return (
                                <View style={styles.totalSummaryCard}>
                                    <View style={styles.totalSummaryHeader}>
                                        <ReceiptText size={20} color={Colors.primary} />
                                        <Text style={styles.totalSummaryTitle}>Resumen Total ({selectedCondo.viviendas.length} unidades)</Text>
                                    </View>

                                    <View style={styles.totalSummaryGrid}>
                                        <View style={styles.totalSummaryItem}>
                                            <Text style={styles.totalSummaryLabel}>Total Facturado</Text>
                                            <Text style={styles.totalSummaryValue}>${totalBilled.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                        </View>
                                        <View style={styles.totalSummaryItem}>
                                            <Text style={styles.totalSummaryLabel}>Total Pagado</Text>
                                            <Text style={[styles.totalSummaryValue, { color: Colors.success }]}>${totalPaid.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.totalBalanceRow}>
                                        <Text style={styles.totalBalanceLabel}>Saldo Total Pendiente</Text>
                                        <Text style={[styles.totalBalanceValue, { color: totalCondoBalance > 0 ? Colors.error : Colors.success }]}>
                                            ${totalCondoBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                        </Text>
                                    </View>

                                    {totalCondoBalance > 0 && (
                                        <TouchableOpacity
                                            style={[styles.payAllButton, isRestricted && { backgroundColor: Colors.secondary }]}
                                            onPress={() => {
                                                handlePaymentPress(() => {
                                                    const allPendingIds: string[] = [];
                                                    selectedCondo.viviendas.forEach((v: any) => {
                                                        if (v.summary?.pendientes) {
                                                            v.summary.pendientes.forEach((p: any) => allPendingIds.push(p.id));
                                                        }
                                                    });
                                                    navigation.navigate('Payments', {
                                                        viviendaId: undefined,
                                                        monto: totalCondoBalance,
                                                        condominioId: selectedCondo.id,
                                                        cuotaIds: allPendingIds,
                                                        viviendasCount: selectedCondo.viviendas.length
                                                    });
                                                });
                                            }}
                                        >
                                            <CreditCard size={18} color={isRestricted ? Colors.muted : Colors.primaryForeground} />
                                            <Text style={[styles.payAllButtonText, isRestricted && { color: Colors.muted }]}>
                                                {selectedCondo?.estado === 'PENDIENTE' ? 'Pagos en línea suspendidos' : 'Pagar Saldo Total'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })()}

                    </>
                )}
            </ScrollView>

            <AlertModal
                isVisible={isUpToDateModalVisible}
                type="success"
                title="¡Todo al día! ✨"
                message="¡Excelente noticia! Tu vivienda se encuentra al día con sus pagos. Gracias por tu puntualidad y compromiso, tu apoyo es fundamental para el bienestar de la comunidad. ¡Que tengas un maravilloso día!"
                onClose={() => setIsUpToDateModalVisible(false)}
                buttons={[
                    {
                        text: 'Pagar por adelantado',
                        style: 'link',
                        onPress: () => {
                            setIsUpToDateModalVisible(false);
                            const summary = upToDateVivienda?.summary || {};
                            const monthlyCuota = getMonthlyCuota(summary);
                            if (monthlyCuota > 0) {
                                navigation.navigate('Payments', {
                                    viviendaId: upToDateVivienda.id,
                                    condominioId: selectedCondoId,
                                    monto: 0,
                                    cuotaIds: [],
                                    viviendasCount: 1,
                                    monthlyCuota
                                });
                            } else {
                                showAlert({ title: 'Aviso', message: 'Aún no tenemos el valor de tu cuota de administración. Cuando el administrador genere tu primera cuota podrás pagar meses por adelantado.', type: 'warning' });
                            }
                        }
                    },
                    { text: 'Entendido' }
                ]}
            />

            {/* Statement Modal */}
            <Modal
                visible={isStatementModalVisible}
                animationType="slide"
                onRequestClose={() => setIsStatementModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Estado de Cuenta</Text>
                            <Text style={styles.modalSubtitle}>
                                {selectedViviendaForStatement?.tipo && `${selectedViviendaForStatement.tipo} `}
                                {selectedViviendaForStatement?.identificador}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsStatementModalVisible(false)}
                            style={styles.closeButton}
                        >
                            <X size={24} color={Colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {selectedViviendaForStatement && selectedViviendaForStatement.summary && (
                            <View>
                                <View style={styles.summaryGrid}>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryLabel}>Facturado</Text>
                                        <Text style={styles.summaryValue}>${Number(selectedViviendaForStatement.summary.totalCuotas || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                    </View>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryLabel}>Pagado</Text>
                                        <Text style={[styles.summaryValue, { color: Colors.success }]}>${Number(selectedViviendaForStatement.summary.totalPagados || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                    </View>
                                </View>
                                <View style={[styles.summaryGrid, { marginTop: 12 }]}>
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryLabel}>Pendiente</Text>
                                        <Text style={[styles.summaryValue, { color: (selectedViviendaForStatement.summary.balance || 0) > 0 ? Colors.error : Colors.success }]}>
                                            ${Number(selectedViviendaForStatement.summary.balance || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                        </Text>
                                    </View>
                                    {(selectedViviendaForStatement.summary.saldoFavor || 0) > 0 && (
                                        <View style={styles.summaryCard}>
                                            <Text style={styles.summaryLabel}>Favor</Text>
                                            <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                                                ${Number(selectedViviendaForStatement.summary.saldoFavor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.breakdownTitle}>Detalle por Periodos</Text>

                                {(() => {
                                    const summary = selectedViviendaForStatement.summary;
                                    const historyByYear = groupHistoryByYear(summary);
                                    const totalMonths = (summary.pendientes?.length || 0) + (summary.pagadas?.length || 0);

                                    return historyByYear.map(({ year, items }) => {
                                        const isExpanded = totalMonths <= 12 || expandedYears[year];

                                        return (
                                            <View key={year} style={styles.yearSection}>
                                                <TouchableOpacity
                                                    style={styles.yearHeader}
                                                    onPress={() => toggleYear(year)}
                                                    disabled={totalMonths <= 12}
                                                >
                                                    <Text style={styles.yearTitle}>{year}</Text>
                                                    {totalMonths > 12 && (
                                                        isExpanded ? <ChevronUp size={20} color={Colors.muted} /> : <ChevronDown size={20} color={Colors.muted} />
                                                    )}
                                                </TouchableOpacity>

                                                {isExpanded && (
                                                    <View style={styles.yearContent}>
                                                        {items.map((item: any) => {
                                                            const isSelected = !!selectedCuotaIds[item.id];
                                                            const isManualPending = item.estado === 'PENDIENTE_CONFIRMACION';
                                                            const isPending = (item.estado === 'PENDIENTE' || item.estado === 'PARCIAL') && (summary.balance > 0) && !isManualPending;

                                                            return (
                                                                <TouchableOpacity
                                                                    key={`${item.id}-${item.estado}`}
                                                                    style={[styles.detailRow, isSelected && styles.detailRowSelected]}
                                                                    onPress={() => isPending && toggleCuotaSelection(item.id)}
                                                                    disabled={!isPending}
                                                                >
                                                                    {isPending && (
                                                                        <View style={styles.checkboxContainer}>
                                                                            {isSelected ?
                                                                                <CheckSquare size={20} color={Colors.primary} /> :
                                                                                <Square size={20} color={Colors.muted} />
                                                                            }
                                                                        </View>
                                                                    )}
                                                                    <View style={styles.detailMain}>
                                                                        <Text style={styles.detailMonth}>{months[item.mes - 1]}</Text>
                                                                        <Text style={styles.detailType}>
                                                                            {item.estado === 'PAGADA' 
                                                                                ? `Pagado ${item.fechaPago ? `(${new Date(item.fechaPago).toLocaleDateString('es-CO')})` : ''}` 
                                                                                : item.estado === 'PARCIAL' ? 'Abono Parcial' 
                                                                                : item.estado === 'PENDIENTE_CONFIRMACION' ? 'Pendiente por Confirmar'
                                                                                : 'Sin Pago'}
                                                                        </Text>
                                                                    </View>
                                                                    <View style={styles.detailSide}>
                                                                        <Text style={[styles.detailAmount, { color: (Number(item.saldoPendiente) || 0) > 0 ? Colors.error : Colors.success }]}>
                                                                            {(Number(item.saldoPendiente) || 0) > 0 ? `-$${(Number(item.saldoPendiente) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : `+$${(Number(item.montoPagado) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`}
                                                                        </Text>
                                                                        <Text style={styles.detailTotal}>Cuota: ${(Number(item.monto) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    });
                                })()}
                            </View>
                        )}
                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {getSelectedCount() > 0 && (
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.paySelectedButton, isRestricted && { backgroundColor: Colors.secondary }]}
                                onPress={() => {
                                    handlePaymentPress(() => {
                                        const selectedTotal = getSelectedTotal(selectedViviendaForStatement.summary.pendientes);
                                        const selectedIds = Object.keys(selectedCuotaIds).filter(id => selectedCuotaIds[id]);
                                        setIsStatementModalVisible(false);
                                        navigation.navigate('Payments', {
                                            viviendaId: selectedViviendaForStatement.id,
                                            monto: selectedTotal,
                                            cuotaIds: selectedIds,
                                            viviendasCount: 1
                                        });
                                    });
                                }}
                            >
                                <CreditCard size={20} color={isRestricted ? Colors.muted : Colors.primaryForeground} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.paySelectedText, isRestricted && { color: Colors.muted }]}>
                                        {selectedCondo?.estado === 'PENDIENTE' ? 'Pagos en línea suspendidos' : `Pagar ${getSelectedCount()} meses`}
                                    </Text>
                                    <Text style={[styles.paySelectedSubtext, isRestricted && { color: Colors.muted }]}>Total: ${getSelectedTotal(selectedViviendaForStatement.summary.pendientes).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Text>
                                </View>
                                <ChevronRight size={20} color={isRestricted ? Colors.muted : Colors.primaryForeground} />
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>

            <CondoSelectorModal
                visible={isCondoSelectorVisible}
                onClose={() => setIsCondoSelectorVisible(false)}
                condos={availableCondos}
                selectedCondoId={selectedCondoId}
                onSelect={(id) => setSelectedCondoId(id)}
            />

            {/* Smart Home Modal */}
            <Modal
                visible={isSmartHomeModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsSmartHomeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <View style={styles.bottomSheetHandle} />
                            <TouchableOpacity
                                onPress={() => setIsSmartHomeModalVisible(false)}
                                style={styles.bottomSheetClose}
                            >
                                <X size={20} color={Colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.bottomSheetContent}>
                            <Text style={styles.bottomSheetTitle}>Accesos y Domótica</Text>
                            <Text style={styles.bottomSheetSubtitle}>
                                {selectedViviendaForSmartHome?.identificador}
                            </Text>

                            <View style={styles.optionsGrid}>
                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={() => {
                                        setIsSmartHomeModalVisible(false);
                                        Alert.alert('TuQuotaAdmin', `Abriendo puerta para ${selectedViviendaForSmartHome?.identificador}...`);
                                    }}
                                >
                                    <View style={[styles.optionIcon, { backgroundColor: '#22c55e20' }]}>
                                        <Lock size={24} color="#22c55e" />
                                    </View>
                                    <Text style={styles.optionLabel}>Abrir Puerta</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={() => {
                                        Alert.alert('Próximamente', 'Estamos trabajando en el vínculo con Google Home para que puedas controlar tus accesos por voz.');
                                    }}
                                >
                                    <View style={[styles.optionIcon, { backgroundColor: '#4285F420' }]}>
                                        <Image
                                            source={Assets.logoQ} // Placeholder icon, would be Google Home logo
                                            style={{ width: 24, height: 24, tintColor: '#4285F4' }}
                                        />
                                    </View>
                                    <Text style={styles.optionLabel}>Vincular Google Home</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={() => {
                                        Alert.alert('Próximamente', 'Estamos trabajando en el vínculo con Alexa para que sea parte de tu hogar inteligente.');
                                    }}
                                >
                                    <View style={[styles.optionIcon, { backgroundColor: '#00CAFF20' }]}>
                                        <Image
                                            source={Assets.logoQ} // Placeholder icon, would be Alexa logo
                                            style={{ width: 24, height: 24, tintColor: '#00CAFF' }}
                                        />
                                    </View>
                                    <Text style={styles.optionLabel}>Vincular Alexa</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Public Services Modal */}
            <Modal
                visible={isServiciosModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsServiciosModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetHeader}>
                            <View style={styles.bottomSheetHandle} />
                            <TouchableOpacity
                                onPress={() => setIsServiciosModalVisible(false)}
                                style={styles.bottomSheetClose}
                            >
                                <X size={20} color={Colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.bottomSheetContent}>
                            <Text style={styles.bottomSheetTitle}>Pagar Servicios Públicos</Text>
                            <Text style={styles.bottomSheetSubtitle}>
                                Seleccione el servicio que desea pagar
                            </Text>

                            <ScrollView 
                                style={{ maxHeight: 400, marginTop: 16 }}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.serviciosGrid}>
                                                                        {Array.isArray(selectedCondo?.enlaces_servicios) && selectedCondo.enlaces_servicios.map((s: any) => {
                                        let Icon = Zap;
                                        let iconColor = "#f59e0b";
                                        
                                        if (s.categoria === 'Acueducto') { Icon = Droplet; iconColor = "#3b82f6"; }
                                        else if (s.categoria === 'Gas Domiciliario') { Icon = Flame; iconColor = "#ef4444"; }
                                        else if (s.categoria === 'Internet') { Icon = Wifi; iconColor = "#6366f1"; }
                                        else if (s.categoria === 'Televisión') { Icon = Tv; iconColor = "#a855f7"; }

                                        return (
                                            <TouchableOpacity 
                                                key={s.id}
                                                style={styles.servicioItem}
                                                onPress={() => Linking.openURL(s.url)}
                                            >
                                                <View style={[styles.servicioIcon, { backgroundColor: iconColor + '15' }]}>
                                                    <Icon size={28} color={iconColor} />
                                                </View>
                                                <Text style={styles.servicioEmpresa} numberOfLines={1}>{s.empresa}</Text>
                                                <Text style={styles.servicioCat}>{s.categoria}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>

                            <TouchableOpacity 
                                style={[styles.closeModalButton, { marginTop: 20 }]}
                                onPress={() => setIsServiciosModalVisible(false)}
                            >
                                <Text style={styles.closeModalButtonText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View >
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
    header: {
        flexDirection: 'column',
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
    username: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        lineHeight: 22,
    },
    profileButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarMini: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImageMini: {
        width: '100%',
        height: '100%',
    },
    bodyContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.secondary + '20',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    statTitle: {
        fontSize: 12,
        color: Colors.muted,
        marginBottom: 4,
        fontWeight: '500',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionCard: {
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
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    actionSubtitle: {
        fontSize: 14,
        color: Colors.muted,
    },
    notificationCard: {
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        flexDirection: 'row',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    notificationIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    notificationBody: {
        fontSize: 14,
        color: Colors.muted,
        marginBottom: 8,
        lineHeight: 20,
    },
    notificationTime: {
        fontSize: 11,
        color: Colors.muted,
        fontWeight: '500',
    },
    emptyNotifications: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        backgroundColor: Colors.secondary + '20',
        borderRadius: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Colors.muted + '40',
        gap: 8,
    },
    emptyNotificationsText: {
        fontSize: 13,
        color: Colors.muted,
        fontWeight: '500',
    },
    unitInfo: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
    },
    selectorsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        marginBottom: 0,
        gap: 8,
        flexWrap: 'wrap',
    },
    selectorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.secondary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
        maxWidth: '70%',
    },
    dwellingSelector: {
        backgroundColor: Colors.primary + '10',
        borderWidth: 1,
        borderColor: Colors.primary + '10',
    },
    condoName: {
        fontSize: 14,
        color: Colors.muted,
        fontWeight: '500',
        flexShrink: 1,
    },
    onboardingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        borderWidth: 1,
        borderColor: Colors.primary + '30',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
    },
    onboardingIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    onboardingTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 4,
    },
    onboardingText: {
        fontSize: 14,
        color: Colors.text,
        opacity: 0.8,
        lineHeight: 20,
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fefce8',
        borderWidth: 1,
        borderColor: '#fef08a',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    warningIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fef9c3',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#854d0e',
    },
    warningText: {
        fontSize: 14,
        color: '#a16207',
    },
    dwellingContainer: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 16,
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    dwellingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
        paddingBottom: 12,
    },
    dwellingBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dwellingBadgeText: {
        fontWeight: 'bold',
        fontSize: 18,
    },
    iconBadgeBackground: {
        minWidth: 56,
        paddingHorizontal: 12,
        height: 56,
        borderRadius: 28, // Oval shape (height/2)
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    identifierOverlay: {
        position: 'absolute',
        top: 0,
        left: -100, // Allow overflow horizontally
        right: -100, // Allow overflow horizontally
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dwellingType: {
        fontSize: 14,
        color: Colors.muted,
        fontWeight: '500',
    },
    actionsContainer: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.secondary,
        paddingTop: 12,
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 8,
        backgroundColor: Colors.secondary + '40',
        borderRadius: 12,
        gap: 8,
    },
    detailsButtonText: {
        fontSize: 14,
        color: Colors.primary,
    },
    statementSection: {
        marginTop: 20,
    },
    statementButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    statementButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primaryForeground,
    },
    statementButtonSubtext: {
        fontSize: 12,
        color: Colors.primaryForeground,
        opacity: 0.9,
    },
    statementIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statementTextContainer: {
        flex: 1,
    },
    statementAmountBadge: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statementAmountBadgeText: {
        color: Colors.primaryForeground,
        fontSize: 14,
        fontWeight: 'bold',
    },
    totalSummaryCard: {
        backgroundColor: Colors.primary + '10',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: Colors.primary + '20',
    },
    totalSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    totalSummaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    totalSummaryGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    totalSummaryItem: {
        flex: 1,
    },
    totalSummaryLabel: {
        fontSize: 11,
        color: Colors.muted,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    totalSummaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
    },
    totalBalanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.primary + '20',
        marginBottom: 20,
    },
    totalBalanceLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    totalBalanceValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    payAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    payAllButtonText: {
        color: Colors.primaryForeground,
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxContainer: {
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailRowSelected: {
        backgroundColor: Colors.primary + '10',
    },
    modalFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.background,
        padding: 20,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: Colors.secondary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    paySelectedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    paySelectedText: {
        color: Colors.primaryForeground,
        fontSize: 16,
        fontWeight: 'bold',
    },
    paySelectedSubtext: {
        color: Colors.primaryForeground,
        fontSize: 12,
        opacity: 0.9,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.muted,
        textAlign: 'center',
        marginTop: 8,
    },
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.text,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.muted,
    },
    modalContent: {
        flex: 1,
        padding: 24,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: Colors.secondary + '30',
        padding: 16,
        borderRadius: 12,
    },
    summaryLabel: {
        fontSize: 11,
        color: Colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    breakdownTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginTop: 32,
        marginBottom: 16,
    },
    yearSection: {
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        overflow: 'hidden',
    },
    yearHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.secondary + '20',
    },
    yearTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    yearContent: {
        paddingHorizontal: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
    },
    detailMain: {
        flex: 1,
    },
    detailMonth: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.text,
    },
    detailType: {
        fontSize: 12,
        color: Colors.muted,
    },
    detailSide: {
        alignItems: 'flex-end',
    },
    detailAmount: {
        fontSize: 15,
        fontWeight: '700',
    },
    detailTotal: {
        fontSize: 11,
        color: Colors.muted,
    },
    closeButton: {
        padding: 8,
    },
    activeSelector: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary + '30',
        borderWidth: 1,
    },
    chevronBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    dashboardButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        height: 32,
    },
    adminButtonText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    // Smart Home Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheetContainer: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '60%',
    },
    bottomSheetHeader: {
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    bottomSheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border,
    },
    bottomSheetClose: {
        position: 'absolute',
        right: 20,
        top: 12,
        padding: 4,
    },
    bottomSheetContent: {
        padding: 24,
        paddingTop: 8,
    },
    bottomSheetTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    bottomSheetSubtitle: {
        fontSize: 16,
        color: Colors.muted,
        textAlign: 'center',
        marginBottom: 32,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 20,
    },
    optionItem: {
        width: '46%',
        backgroundColor: Colors.secondary + '20',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: Colors.border + '50',
    },
    optionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        textAlign: 'center',
    },
    headerNotificationBtn: {
        position: 'relative',
        padding: 4,
        marginRight: 8,
    },
    headerNotificationBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fff',
    },
    headerNotificationBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
    loadingArea: {
        marginTop: 5,
        marginBottom: 5,
        minHeight: 5,
        justifyContent: 'center',
    },
    loadingBarContainer: {
        width: '100%',
        height: 5,
        overflow: 'hidden',
    },
    loadingBarTrack: {
        width: '100%',
        height: 5,
        backgroundColor: '#e2e8f0',
        position: 'relative',
    },
    loadingBarGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 200,
        height: 5,
    },
    pullIndicator: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        width: '100%',
        gap: 6,
    },
    pullTrack: {
        width: 60,
        height: 3,
        backgroundColor: Colors.secondary,
        borderRadius: 2,
        overflow: 'hidden',
    },
    pullBar: {
        height: '100%',
        backgroundColor: Colors.primary,
    },
    // Nuevos estilos para servicios
    serviciosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingBottom: 20,
    },
    servicioItem: {
        width: '48%',
        backgroundColor: Colors.secondary + '10',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border + '30',
    },
    servicioIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    servicioEmpresa: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    servicioCat: {
        fontSize: 10,
        color: Colors.muted,
        marginTop: 4,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    closeModalButton: {
        backgroundColor: Colors.secondary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    closeModalButtonText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    }
});

