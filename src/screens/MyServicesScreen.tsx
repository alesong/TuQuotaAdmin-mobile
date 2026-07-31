import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Platform,
    Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    ArrowLeft,
    Video,
    Smartphone,
    Key,
    RefreshCw,
    Plus,
    AlertCircle,
    Info,
    Zap,
    Wifi,
    Settings,
    Trash2,
} from 'lucide-react-native';
import { ActionButton } from '../components/ActionButton';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { AlertModal } from '../components/AlertModal';
import { useDoorbell } from '../context/DoorbellContext';
import { DoorbellSettingsModal } from '../components/DoorbellSettingsModal';
import { CameraStreamViewer } from '../components/CameraStreamViewer';
import { toDataURL } from 'qrcode';

const AMENITY_CONFIG: Record<string, { label: string, searchTerm: string, subtitle: string }> = {
    pool: { label: 'Piscina', searchTerm: 'PISCINA', subtitle: 'Acceso a piscina y zonas comunes' },
    gym: { label: 'Gimnasio', searchTerm: 'GIMNASIO', subtitle: 'Acceso a gimnasio' },
    bbq: { label: 'BBQ', searchTerm: 'BBQ', subtitle: 'Reservas y agenda de área social' },
    salon: { label: 'Salón', searchTerm: 'SALÓN', subtitle: 'Reservas de salón de eventos' },
};

const getTodayISO = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

const formatFecha = (fecha: string) => {
    const [yy, mm, dd] = (fecha || '').split('-');
    return dd && mm && yy ? `${dd}/${mm}/${yy}` : fecha;
};

export const MyServicesScreen = ({ navigation, route }: any) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [activeSection, setActiveSection] = useState<'gate' | 'cameras' | 'pool' | 'gym' | 'bbq' | 'salon' | 'parking' | 'others'>('gate');

    useEffect(() => {
        if (route?.params?.initialSection) {
            setActiveSection(route.params.initialSection);
        }
    }, [route?.params?.initialSection]);

    // Action/API states
    const [actionLoading, setActionLoading] = useState(false);
    const [gateLoading, setGateLoading] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [isAlertVisible, setIsAlertVisible] = useState(false);

    // QR states
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [qrExpiry, setQrExpiry] = useState<string | null>(null);
    const [qrCountdown, setQrCountdown] = useState<number>(0);
    const [selectedServiceForQr, setSelectedServiceForQr] = useState<string>('');
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

    // Parking states
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [newVehicle, setNewVehicle] = useState({ plate: '', brand: '', model: '', color: '' });

    // Reservation states
    const [reservations, setReservations] = useState<Record<string, any[]>>({});
    const [reservationsLoading, setReservationsLoading] = useState<Record<string, boolean>>({});
    const [reservationSubmitting, setReservationSubmitting] = useState(false);
    const [reservationForm, setReservationForm] = useState({ fecha: '', horaInicio: '', horaFin: '', numPersonas: '1' });

    const API_URL = Config.API_URL;

    const [cameraStreams, setCameraStreams] = useState<Record<string, string | null>>({});
    const [loadingStreams, setLoadingStreams] = useState<Record<string, boolean>>({});

    const fetchMyServicesRef = useRef<(() => Promise<void>) | null>(null);
    const fetchVehiclesRef = useRef<(() => Promise<void>) | null>(null);

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setAlertConfig({ title, message, type });
        setIsAlertVisible(true);
    };

    const fetchMyServices = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/my-services`, {
                cache: 'no-cache',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Deduplicar por serviceId (una entrada por vivienda)
                const uniqueServices = Array.from(
                    new Map(data.map((s: any) => [s.serviceId, s])).values()
                );
                setServices(uniqueServices);
                
                // Configurar servicio por defecto para QR
                const qrService = data.find((s: any) =>
                    (s.category === 'AMENITIES' || s.provider === 'QR_ACCESS') &&
                    s.button_config?.mode !== 'reserve'
                );
                if (qrService) {
                    setSelectedServiceForQr(qrService.serviceId);
                }
            }
        } catch (error) {
            console.error('Error fetching resident services:', error);
        } finally {
            setLoading(false);
        }
    };
    fetchMyServicesRef.current = fetchMyServices;

    const { connected: doorbellConnected, showAlert: showDoorbellAlert, doorbellServiceId, preferences, updatePreferences } = useDoorbell();
    const [showDoorbellSettings, setShowDoorbellSettings] = useState(false);

    const fetchVehicles = async () => {
        try {
            const response = await fetch(`${API_URL}/resident-services/parqueadero/vehiculos`, {
                cache: 'no-cache',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setVehicles(data);
            }
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        }
    };
    fetchVehiclesRef.current = fetchVehicles;

    useFocusEffect(
        useCallback(() => {
            fetchMyServicesRef.current?.();
            fetchVehiclesRef.current?.();
        }, [])
    );

    // Preseleccionar servicio QR según pestaña activa
    useEffect(() => {
        if (['pool', 'gym', 'bbq', 'salon'].includes(activeSection)) {
            const cfg = AMENITY_CONFIG[activeSection];
            const match = services.find(s =>
                s.category === 'AMENITIES' &&
                s.button_config?.mode !== 'reserve' &&
                s.serviceName.toUpperCase().includes(cfg.searchTerm)
            );
            if (match) setSelectedServiceForQr(match.serviceId);
        }
    }, [activeSection, services]);

    // Cargar reservas de servicios en modo reserva según pestaña activa
    useEffect(() => {
        if (['pool', 'gym', 'bbq', 'salon'].includes(activeSection)) {
            const cfg = AMENITY_CONFIG[activeSection];
            services
                .filter(s =>
                    s.category === 'AMENITIES' &&
                    s.button_config?.mode === 'reserve' &&
                    s.serviceName.toUpperCase().includes(cfg.searchTerm)
                )
                .forEach(s => {
                    if (!reservations[s.serviceId]) fetchReservations(s.serviceId);
                });
        }
    }, [activeSection, services]);

    // Generar QR image cuando cambia qrCode
    useEffect(() => {
        if (qrCode) {
            toDataURL(qrCode, { width: 250, margin: 2, color: { dark: '#1e1e2e', light: '#ffffff' } })
                .then(url => setQrImageUrl(url))
                .catch(() => setQrImageUrl(null));
        } else {
            setQrImageUrl(null);
        }
    }, [qrCode]);

    // Countdown for QR Code
    useEffect(() => {
        if (qrCountdown <= 0) {
            setQrCode(null);
            return;
        }
        const timer = setInterval(() => {
            setQrCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [qrCountdown]);

    // ==========================================
    // PORTON ACTION
    // ==========================================

    const handleOpenGate = async (serviceId: string, serviceName: string) => {
        setGateLoading(serviceId);
        try {
            const response = await fetch(`${API_URL}/resident-services/open-gate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ serviceId }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                // Apertura enviada; sin alerta de confirmación
            } else {
                showAlert('Error', data.message || 'No se pudo abrir el portón.', 'error');
            }
        } catch (error) {
            showAlert('Fallo de Red', 'Verifique su conexión a internet.', 'error');
        } finally {
            setGateLoading(null);
        }
    };

    // ==========================================
    // QR CODE ACTION
    // ==========================================

    const handleGenerateQr = async () => {
        if (!selectedServiceForQr) {
            showAlert('Servicio Requerido', 'Selecciona un servicio común para generar el acceso.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/generate-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ serviceId: selectedServiceForQr }),
            });
            const data = await response.json();
            if (response.ok) {
                setQrCode(data.qrString);
                setQrExpiry(data.expiresAt);
                setQrCountdown(300); // 5 minutos (300 segundos)
            } else {
                showAlert('Acceso Suspendido', data.message || 'No se pudo generar el código QR.', 'error');
            }
        } catch (error) {
            showAlert('Error', 'Fallo al solicitar código de acceso QR.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // PARKING ACTION
    // ==========================================

    const handleAddVehicle = async () => {
        if (!newVehicle.plate.trim()) {
            showAlert('Placa Requerida', 'Ingresa la placa del vehículo.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/parqueadero/vehiculos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(newVehicle),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                setVehicles(data.vehicles);
                setNewVehicle({ plate: '', brand: '', model: '', color: '' });
            } else {
                showAlert('Error', data.message || 'No se pudo agregar el vehículo.', 'error');
            }
        } catch (error) {
            showAlert('Error de Red', 'Revisa tu conexión.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteVehicle = async (plate: string) => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/parqueadero/vehiculos/${encodeURIComponent(plate)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await response.json();
            if (response.ok && data.success) {
                setVehicles(data.vehicles);
            } else {
                showAlert('Error', data.message || 'No se pudo eliminar el vehículo.', 'error');
            }
        } catch (error) {
            showAlert('Error de Red', 'Revisa tu conexión.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // RESERVATIONS (BBQ / SALÓN)
    // ==========================================

    const fetchReservations = async (serviceId: string) => {
        setReservationsLoading(prev => ({ ...prev, [serviceId]: true }));
        try {
            const response = await fetch(`${API_URL}/resident-services/reservas?serviceId=${encodeURIComponent(serviceId)}`, {
                cache: 'no-cache',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setReservations(prev => ({ ...prev, [serviceId]: data }));
            }
        } catch (error) {
            console.error('Error fetching reservations:', error);
        } finally {
            setReservationsLoading(prev => ({ ...prev, [serviceId]: false }));
        }
    };

    const handleCreateReservation = async (serviceId: string) => {
        if (!reservationForm.fecha || !reservationForm.horaInicio || !reservationForm.horaFin) {
            showAlert('Campos Requeridos', 'Completa la fecha (AAAA-MM-DD), la hora de inicio y la hora final (HH:mm).', 'warning');
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reservationForm.fecha)) {
            showAlert('Fecha Inválida', 'La fecha debe tener el formato AAAA-MM-DD.', 'warning');
            return;
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reservationForm.horaInicio) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(reservationForm.horaFin)) {
            showAlert('Hora Inválida', 'Las horas deben tener el formato HH:mm.', 'warning');
            return;
        }
        setReservationSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/reservas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    serviceId,
                    fecha: reservationForm.fecha,
                    horaInicio: reservationForm.horaInicio,
                    horaFin: reservationForm.horaFin,
                    numPersonas: parseInt(reservationForm.numPersonas, 10) || 1,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                setReservations(prev => {
                    const list = [...(prev[serviceId] || []), data];
                    list.sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio));
                    return { ...prev, [serviceId]: list };
                });
                setReservationForm({ fecha: '', horaInicio: '', horaFin: '', numPersonas: '1' });
            } else {
                showAlert('Error', data.message || 'No se pudo crear la reserva.', 'error');
            }
        } catch (error) {
            showAlert('Error de Red', 'Revisa tu conexión.', 'error');
        } finally {
            setReservationSubmitting(false);
        }
    };

    const handleCancelReservation = async (serviceId: string, reservaId: string) => {
        setReservationSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/reservas/${reservaId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setReservations(prev => ({
                    ...prev,
                    [serviceId]: (prev[serviceId] || []).filter(r => r.id !== reservaId),
                }));
            } else {
                const data = await response.json().catch(() => ({}));
                showAlert('Error', data.message || 'No se pudo cancelar la reserva.', 'error');
            }
        } catch (error) {
            showAlert('Error de Red', 'Revisa tu conexión.', 'error');
        } finally {
            setReservationSubmitting(false);
        }
    };

    const fetchCameraStream = async (serviceId: string) => {
        if (cameraStreams[serviceId]) return;
        setLoadingStreams(prev => ({ ...prev, [serviceId]: true }));
        try {
            const response = await fetch(`${API_URL}/resident-services/camera-stream/${serviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setCameraStreams(prev => ({ ...prev, [serviceId]: data.streamUrl }));
            } else {
                setCameraStreams(prev => ({ ...prev, [serviceId]: null }));
            }
        } catch {
            setCameraStreams(prev => ({ ...prev, [serviceId]: null }));
        } finally {
            setLoadingStreams(prev => ({ ...prev, [serviceId]: false }));
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'Activo';
            case 'SUSPENDED': return 'Suspendido';
            default: return 'Pendiente';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return Colors.success;
            case 'SUSPENDED': return Colors.error;
            default: return '#f59e0b';
        }
    };

    const hasMora = services.some(s => s.financialStatus === 'EN_MORA');

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mis Servicios</Text>
                <TouchableOpacity onPress={fetchMyServices} style={styles.refreshBtn}>
                    <RefreshCw color={Colors.primary} size={18} />
                </TouchableOpacity>
            </View>

            {/* Financial status summary */}
            {services.length > 0 && (
                <View style={[styles.moraCard, { backgroundColor: hasMora ? '#fffbeb' : '#f0fdf4', borderColor: hasMora ? '#fef3c7' : '#dcfce7' }]}>
                    <AlertCircle size={20} color={hasMora ? '#d97706' : Colors.success} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.moraTitle, { color: hasMora ? '#b45309' : '#15803d' }]}>
                            {hasMora ? 'Unidad presenta saldos pendientes' : 'Finanzas al día'}
                        </Text>
                        <Text style={[styles.moraText, { color: hasMora ? '#d97706' : '#16a34a' }]}>
                            {hasMora 
                                ? 'Algunos servicios se encuentran suspendidos o restringidos temporalmente.'
                                : 'Todos tus accesos y servicios integrados se encuentran operativos.'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Navigation tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
                {(['gate', 'cameras', 'pool', 'gym', 'bbq', 'salon', 'parking', 'others'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveSection(tab)}
                        style={[styles.tabButton, activeTabStyle(activeSection === tab)]}
                    >
                        <Text style={[styles.tabButtonText, activeTabTextStyle(activeSection === tab)]}>
                            {tab === 'gate' && 'Portón'}
                            {tab === 'cameras' && 'Cámaras'}
                            {tab === 'pool' && 'Piscina'}
                            {tab === 'gym' && 'Gimnasio'}
                            {tab === 'bbq' && 'BBQ'}
                            {tab === 'salon' && 'Salón'}
                            {tab === 'parking' && 'Parqueadero'}
                            {tab === 'others' && 'Otros Servicios'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {doorbellServiceId && (
                <View style={styles.doorbellStatusBar}>
                    <View style={styles.doorbellStatusRow}>
                        <Wifi size={14} color="#10b981" />
                        <Text style={[styles.doorbellStatusText, { color: '#10b981' }]}>Timbre activo</Text>
                        <TouchableOpacity
                            style={styles.testDoorbellBtn}
                            onPress={() => setShowDoorbellSettings(true)}
                        >
                            <Settings size={16} color="#6366f1" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.loadingArea}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ marginTop: 10, color: Colors.muted }}>Cargando servicios...</Text>
                    </View>
                ) : services.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Info size={48} color={Colors.muted} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <Text style={styles.emptyText}>No hay servicios integrados configurados en tu condominio.</Text>
                    </View>
                ) : (
                    <>
                        {/* ==========================================
                            PORTON SECTION
                           ========================================== */}
                        {activeSection === 'gate' && (
                            services.filter(s => s.category === 'ACCESS').map(s => (
                                <View key={s.serviceId} style={styles.serviceCard}>
                                    <View style={styles.cardHeader}>
                                        <Key size={22} color={Colors.primary} />
                                        <View style={styles.cardHeaderTitleContainer}>
                                            <Text style={styles.cardTitle}>{s.serviceName}</Text>
                                            <Text style={styles.cardSubtitle}>{s.condominioName} — Módulo vehicular / Entrada principal</Text>
                                        </View>
                                        <Text style={[styles.statusBadge, { color: getStatusColor(s.status) }]}>
                                            {getStatusText(s.status)}
                                        </Text>
                                    </View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.cardText}>{s.description}</Text>
                                        
                                        <ActionButton
                                            config={s.button_config}
                                            onPress={() => handleOpenGate(s.serviceId, s.serviceName)}
                                            disabled={s.status !== 'ACTIVE'}
                                            loading={gateLoading === s.serviceId}
                                        />
                                    </View>
                                </View>
                            ))
                        )}

                        {/* ==========================================
                            CAMERAS SECTION
                           ========================================== */}
                        {activeSection === 'cameras' && (
                            services.filter(s => s.category === 'CAMERAS').map(s => (
                                <View key={s.serviceId} style={styles.serviceCard}>
                                    <View style={styles.cardHeader}>
                                        <Video size={22} color={Colors.primary} />
                                        <View style={styles.cardHeaderTitleContainer}>
                                            <Text style={styles.cardTitle}>{s.serviceName}</Text>
                                            <Text style={styles.cardSubtitle}>{s.condominioName} — Cámaras de vigilancia en tiempo real</Text>
                                        </View>
                                        <Text style={[styles.statusBadge, { color: getStatusColor(s.status) }]}>
                                            {getStatusText(s.status)}
                                        </Text>
                                    </View>
                                    <View style={styles.cardBody}>
                                        {s.status === 'ACTIVE' ? (
                                            <>
                                                {s.streamUrl ? (
                                                    <CameraStreamViewer streamUrl={s.streamUrl} serviceName={s.serviceName} />
                                                ) : loadingStreams[s.serviceId] ? (
                                                    <View style={styles.cameraLoadingContainer}>
                                                        <ActivityIndicator size="small" color={Colors.primary} />
                                                        <Text style={styles.cameraLoadingText}>Cargando stream...</Text>
                                                    </View>
                                                ) : cameraStreams[s.serviceId] ? (
                                                    <CameraStreamViewer streamUrl={cameraStreams[s.serviceId]!} serviceName={s.serviceName} />
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.cameraActivateBtn}
                                                        onPress={() => fetchCameraStream(s.serviceId)}
                                                    >
                                                        <Text style={styles.cameraActivateBtnText}>Ver transmisión en vivo</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        ) : (
                                            <View style={styles.cameraSuspendedContainer}>
                                                <AlertCircle size={28} color={Colors.error} style={{ marginBottom: 6 }} />
                                                <Text style={styles.suspendedText}>El acceso a este servicio se encuentra suspendido.</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}

                        {/* ==========================================
                            AMENITY SECTIONS (Piscina, Gimnasio, BBQ, Salón)
                           ========================================== */}
                        {(['pool', 'gym', 'bbq', 'salon'] as const).map(type => {
                            if (activeSection !== type) return null;
                            const cfg = AMENITY_CONFIG[type];
                            const matchingServices = services.filter(s =>
                                s.category === 'AMENITIES' && s.serviceName.toUpperCase().includes(cfg.searchTerm)
                            );
                            if (matchingServices.length === 0) {
                                return (
                                    <View key={type} style={styles.serviceCard}>
                                        <View style={styles.cardHeader}>
                                            <Smartphone size={22} color={Colors.primary} />
                                            <View style={styles.cardHeaderTitleContainer}>
                                                <Text style={styles.cardTitle}>{cfg.label}</Text>
                                                <Text style={styles.cardSubtitle}>{cfg.subtitle}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.cardBody}>
                                            <Text style={styles.cardText}>No hay servicios de {cfg.label.toLowerCase()} configurados.</Text>
                                        </View>
                                    </View>
                                );
                            }
                            return matchingServices.map(s => (
                                <View key={s.serviceId} style={styles.serviceCard}>
                                    <View style={styles.cardHeader}>
                                        <Smartphone size={22} color={Colors.primary} />
                                        <View style={styles.cardHeaderTitleContainer}>
                                            <Text style={styles.cardTitle}>{s.serviceName}</Text>
                                            <Text style={styles.cardSubtitle}>{s.condominioName} — {cfg.subtitle}</Text>
                                        </View>
                                        <Text style={[styles.statusBadge, { color: getStatusColor(s.status) }]}>
                                            {getStatusText(s.status)}
                                        </Text>
                                    </View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.cardText}>{s.description}</Text>

                                        {s.button_config?.mode === 'reserve' ? (
                                            /* Reservations module */
                                            <View style={styles.reservaSection}>
                                                <Text style={styles.cardTextHeader}>Reservas Próximas</Text>
                                                {reservationsLoading[s.serviceId] ? (
                                                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 8 }} />
                                                ) : (reservations[s.serviceId] || []).length === 0 ? (
                                                    <Text style={{ fontSize: 12, color: Colors.muted }}>No hay reservas próximas.</Text>
                                                ) : (
                                                    (reservations[s.serviceId] || []).map(r => (
                                                        <View key={r.id} style={[styles.reservaRow, r.isMine && styles.reservaRowMine]}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.reservaFecha}>
                                                                    {formatFecha(r.fecha)} · {r.horaInicio} - {r.horaFin}
                                                                </Text>
                                                                <Text style={styles.reservaDetalle}>
                                                                    Vivienda {r.viviendaIdentificador || '—'} · {r.propietarioNombre} · {r.numPersonas} persona(s)
                                                                </Text>
                                                            </View>
                                                            {r.isMine && (
                                                                <TouchableOpacity
                                                                    onPress={() => handleCancelReservation(s.serviceId, r.id)}
                                                                    disabled={reservationSubmitting}
                                                                    style={{ padding: 6 }}
                                                                >
                                                                    <Trash2 size={16} color={Colors.error} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    ))
                                                )}

                                                <Text style={[styles.cardTextHeader, { marginTop: 16 }]}>Realizar Reserva</Text>
                                                <View style={styles.parkingForm}>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Fecha (AAAA-MM-DD)"
                                                        value={reservationForm.fecha}
                                                        onChangeText={(t) => setReservationForm(prev => ({ ...prev, fecha: t }))}
                                                        placeholderTextColor={Colors.muted}
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                    />
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TextInput
                                                            style={[styles.input, { flex: 1 }]}
                                                            placeholder="Inicio (HH:mm)"
                                                            value={reservationForm.horaInicio}
                                                            onChangeText={(t) => setReservationForm(prev => ({ ...prev, horaInicio: t }))}
                                                            placeholderTextColor={Colors.muted}
                                                        />
                                                        <TextInput
                                                            style={[styles.input, { flex: 1 }]}
                                                            placeholder="Fin (HH:mm)"
                                                            value={reservationForm.horaFin}
                                                            onChangeText={(t) => setReservationForm(prev => ({ ...prev, horaFin: t }))}
                                                            placeholderTextColor={Colors.muted}
                                                        />
                                                    </View>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Número de personas"
                                                        keyboardType="numeric"
                                                        value={reservationForm.numPersonas}
                                                        onChangeText={(t) => setReservationForm(prev => ({ ...prev, numPersonas: t }))}
                                                        placeholderTextColor={Colors.muted}
                                                    />
                                                    <ActionButton
                                                        config={s.button_config}
                                                        label={`Reservar ${cfg.label}`}
                                                        onPress={() => handleCreateReservation(s.serviceId)}
                                                        disabled={s.status !== 'ACTIVE' || reservationSubmitting}
                                                        loading={reservationSubmitting}
                                                    />
                                                </View>
                                            </View>
                                        ) : (
                                            /* QR Generator */
                                            qrCode && selectedServiceForQr === s.serviceId ? (
                                                <View style={styles.qrContainer}>
                                                    {qrImageUrl ? (
                                                        <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
                                                    ) : (
                                                        <View style={styles.qrImagePlaceholder}>
                                                            <ActivityIndicator size="small" color={Colors.primary} />
                                                        </View>
                                                    )}
                                                    <Text style={styles.qrTimerText}>Expira en: {qrCountdown} segundos</Text>
                                                </View>
                                            ) : (
                                                <ActionButton
                                                    config={s.button_config}
                                                    label={`Generar QR ${cfg.label}`}
                                                    onPress={() => {
                                                        setSelectedServiceForQr(s.serviceId);
                                                        handleGenerateQr();
                                                    }}
                                                    disabled={s.status !== 'ACTIVE' || actionLoading}
                                                    loading={actionLoading}
                                                    style={{ marginBottom: 16 }}
                                                />
                                            )
                                        )}
                                    </View>
                                </View>
                            ));
                        })}

                        {/* ==========================================
                            PARKING RESIDENT VEHICLES
                           ========================================== */}
                        {activeSection === 'parking' && (
                            <View style={styles.serviceCard}>
                                <View style={styles.cardHeader}>
                                    <Zap size={22} color={Colors.primary} />
                                    <View style={styles.cardHeaderTitleContainer}>
                                        <Text style={styles.cardTitle}>Parqueadero y Control Vehicular</Text>
                                        <Text style={styles.cardSubtitle}>Mis vehículos registrados</Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    {/* Resident vehicles list */}
                                    <Text style={styles.cardTextHeader}>Vehículos Autorizados ({vehicles.length}/2):</Text>
                                    {vehicles.length === 0 ? (
                                        <Text style={{ fontSize: 12, color: Colors.muted }}>Aún no tienes vehículos registrados.</Text>
                                    ) : (
                                        vehicles.map((v, i) => (
                                            <View key={i} style={styles.vehicleRow}>
                                                <Text style={styles.vehiclePlate}>{v.plate}</Text>
                                                <Text style={styles.vehicleDesc}>{v.brand} {v.model} ({v.color})</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteVehicle(v.plate)}
                                                    style={{ marginLeft: 'auto', padding: 6 }}
                                                    disabled={actionLoading}
                                                >
                                                    <Trash2 size={16} color={Colors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}

                                    {/* Add my vehicle */}
                                    <Text style={[styles.cardTextHeader, { marginTop: 16 }]}>Agregar Mi Vehículo:</Text>
                                    <View style={styles.parkingForm}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Placa (Ej. ABC-123)"
                                            value={newVehicle.plate}
                                            onChangeText={(t) => setNewVehicle(prev => ({ ...prev, plate: t }))}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Marca (Ej. Mazda)"
                                            value={newVehicle.brand}
                                            onChangeText={(t) => setNewVehicle(prev => ({ ...prev, brand: t }))}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Modelo (Ej. CX-5)"
                                            value={newVehicle.model}
                                            onChangeText={(t) => setNewVehicle(prev => ({ ...prev, model: t }))}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Color (Ej. Gris)"
                                            value={newVehicle.color}
                                            onChangeText={(t) => setNewVehicle(prev => ({ ...prev, color: t }))}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <ActionButton
                                            config={{}}
                                            label={vehicles.length >= 2 ? "Máximo 2 vehículos" : "Agregar Vehículo"}
                                            onPress={handleAddVehicle}
                                            disabled={actionLoading || vehicles.length >= 2}
                                            loading={actionLoading}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* ==========================================
                            OTROS SERVICIOS (Categorías personalizadas)
                           ========================================== */}
                        {activeSection === 'others' && (
                            (() => {
                                const conocidas = ['ACCESS', 'CAMERAS', 'AMENITIES'];
                                const otros = services.filter(s => !conocidas.includes(s.category));
                                if (otros.length === 0) {
                                    return (
                                        <View style={styles.emptyContainer}>
                                            <Info size={48} color={Colors.muted} style={{ marginBottom: 12, opacity: 0.4 }} />
                                            <Text style={styles.emptyText}>No hay otros servicios configurados.</Text>
                                        </View>
                                    );
                                }
                                return (
                                    <View style={styles.otherSection}>
                                        <Text style={styles.otherSectionTitle}>Otros Servicios</Text>
                                        {otros.map(s => (
                                            <View key={s.serviceId} style={styles.serviceCard}>
                                                <View style={styles.cardHeader}>
                                                    <View style={styles.cardHeaderTitleContainer}>
                                                        <Text style={styles.cardTitle}>{s.serviceName}</Text>
                                                        <Text style={styles.cardSubtitle}>
                                                            {s.condominioName}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.categoryBadge, { backgroundColor: (s.category_color || '#3B82F6') + '20' }]}>
                                                        <View style={[styles.categoryDot, { backgroundColor: s.category_color || '#3B82F6' }]} />
                                                        <Text style={[styles.categoryText, { color: s.category_color || '#3B82F6' }]}>
                                                            {s.category_name || s.category}
                                                        </Text>
                                                    </View>
                                                    <Text style={[styles.statusBadge, { color: getStatusColor(s.status) }]}>
                                                        {getStatusText(s.status)}
                                                    </Text>
                                                </View>
                                                <View style={styles.cardBody}>
                                                    <Text style={styles.cardText}>
                                                        {s.description}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })()
                        )}
                    </>
                )}
            </ScrollView>

            {/* Modales de alerta */}
            {alertConfig && (
                <AlertModal
                    isVisible={isAlertVisible}
                    type={alertConfig.type}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    onClose={() => setIsAlertVisible(false)}
                    autoCloseDelay={alertConfig.type === 'success' ? 3 : undefined}
                />
            )}

            <DoorbellSettingsModal
                visible={showDoorbellSettings}
                onClose={() => setShowDoorbellSettings(false)}
                preferences={preferences}
                onUpdate={updatePreferences}
            />
        </View>
    );
};

// Auxiliary style helpers to avoid compile issues
const activeTabStyle = (active: boolean) => ({
    borderBottomWidth: active ? 2 : 0,
    borderBottomColor: active ? Colors.primary : 'transparent',
});

const activeTabTextStyle = (active: boolean) => ({
    color: active ? Colors.primary : Colors.muted,
    fontWeight: active ? 'bold' as const : 'normal' as const,
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.secondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'web' ? 24 : 50,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    refreshBtn: {
        padding: 5,
    },
    moraCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        margin: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    moraTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    moraText: {
        fontSize: 12,
        marginTop: 2,
        lineHeight: 16,
    },
    tabsContainer: {
        maxHeight: 50,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tabsContent: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    tabButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    tabButtonText: {
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    loadingArea: {
        paddingVertical: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.muted,
        textAlign: 'center',
        maxWidth: 240,
        lineHeight: 20,
    },
    serviceCard: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.secondary,
        paddingBottom: 12,
        marginBottom: 12,
    },
    cardHeaderTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    cardSubtitle: {
        fontSize: 11,
        color: Colors.muted,
        marginTop: 1,
    },
    statusBadge: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cardBody: {
        width: '100%',
    },
    cardText: {
        fontSize: 13,
        color: Colors.muted,
        lineHeight: 18,
        marginBottom: 14,
    },
    cardTextHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    disabledBtn: {
        backgroundColor: '#cbd5e1',
    },
    cameraLoadingContainer: {
        height: 150,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraLoadingText: {
        color: '#94a3b8',
        fontSize: 13,
        marginTop: 8,
    },
    cameraActivateBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cameraActivateBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cameraSuspendedContainer: {
        height: 150,
        backgroundColor: '#fff1f2',
        borderWidth: 1,
        borderColor: '#ffe4e6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    suspendedText: {
        fontSize: 13,
        color: '#b91c1c',
        textAlign: 'center',
        fontWeight: 'semibold',
        lineHeight: 18,
    },
    qrContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    qrImage: {
        width: 250,
        height: 250,
        marginBottom: 12,
        borderRadius: 8,
    },
    qrImagePlaceholder: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 12,
    },
    qrTimerText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.error,
    },
    bbqAvailabilityContainer: {
        backgroundColor: Colors.secondary,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    bbqAvailabilityHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 6,
    },
    bbqRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    bbqDate: {
        fontSize: 12,
        color: Colors.text,
        fontWeight: 'semibold',
    },
    bbqStatus: {
        fontSize: 12,
        color: Colors.muted,
    },
    bookingForm: {
        gap: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: Colors.text,
        backgroundColor: '#fff',
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.secondary,
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    vehiclePlate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.primary,
        width: 80,
    },
    vehicleDesc: {
        fontSize: 13,
        color: Colors.text,
    },
    parkingForm: {
        gap: 10,
        marginBottom: 12,
    },
    reservaSection: {
        width: '100%',
    },
    reservaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.secondary,
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    reservaRowMine: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    reservaFecha: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.text,
    },
    reservaDetalle: {
        fontSize: 12,
        color: Colors.muted,
        marginTop: 2,
    },
    codeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
    },
    codeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#166534',
    },
    codeExpiry: {
        fontSize: 11,
        color: '#15803d',
    },
    qrServiceSelectorContainer: {
        marginBottom: 14,
    },
    qrServiceOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    qrServiceOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '08',
    },
    qrServiceOptionDisabled: {
        opacity: 0.5,
    },
    qrServiceOptionInfo: {
        flex: 1,
    },
    qrServiceOptionName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    qrServiceOptionStatus: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 2,
    },

    // Doorbell styles
    doorbellStatusBar: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    doorbellStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    doorbellStatusText: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    testDoorbellBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#eef2ff',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Other Services section
    otherSection: {
        marginTop: 8,
    },
    otherSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 12,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    categoryDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
});
