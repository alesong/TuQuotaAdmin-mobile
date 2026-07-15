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
    Lock,
    Video,
    Smartphone,
    Key,
    RefreshCw,
    Play,
    Calendar,
    Plus,
    Search,
    AlertCircle,
    CheckCircle2,
    Info,
    Zap,
    Wifi,
    Bell,
} from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { AlertModal } from '../components/AlertModal';
import { useDoorbell } from '../context/DoorbellContext';
import { toDataURL } from 'qrcode';

export const MyServicesScreen = ({ navigation }: any) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [activeSection, setActiveSection] = useState<'all' | 'gate' | 'cameras' | 'qr' | 'bbq' | 'parking'>('all');

    // Action/API states
    const [actionLoading, setActionLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [isAlertVisible, setIsAlertVisible] = useState(false);

    // QR states
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [qrExpiry, setQrExpiry] = useState<string | null>(null);
    const [qrCountdown, setQrCountdown] = useState<number>(0);
    const [selectedServiceForQr, setSelectedServiceForQr] = useState<string>('');
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

    // BBQ states
    const [bbqBookings, setBbqBookings] = useState<any[]>([]);
    const [selectedBbqDate, setSelectedBbqDate] = useState('');
    const [selectedBbqSlot, setSelectedBbqSlot] = useState('12:00 - 18:00');

    // Parking states
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [visitorPlate, setVisitorPlate] = useState('');
    const [visitorName, setVisitorName] = useState('');
    const [tempCodes, setTempCodes] = useState<any[]>([]);

    const API_URL = Config.API_URL;

    const fetchMyServicesRef = useRef<(() => Promise<void>) | null>(null);
    const fetchBbqAvailabilityRef = useRef<(() => Promise<void>) | null>(null);
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
                const qrService = data.find((s: any) => s.category === 'AMENITIES' || s.provider === 'QR_ACCESS');
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

    const { connected: doorbellConnected, showAlert: showDoorbellAlert, triggerRing: handleDoorbellRing, doorbellServiceId } = useDoorbell();

    const fetchBbqAvailability = async () => {
        try {
            const response = await fetch(`${API_URL}/resident-services/bbq/availability`, {
                cache: 'no-cache',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setBbqBookings(data);
            }
        } catch (error) {
            console.error('Error fetching BBQ:', error);
        }
    };
    fetchBbqAvailabilityRef.current = fetchBbqAvailability;

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
            fetchBbqAvailabilityRef.current?.();
            fetchVehiclesRef.current?.();
        }, [])
    );

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

    const handleOpenGate = async (serviceId: string) => {
        setActionLoading(true);
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
                showAlert('Portón Abierto', 'Apertura vehicular enviada con éxito.', 'success');
            } else {
                showAlert('Error', data.message || 'No se pudo abrir el portón.', 'error');
            }
        } catch (error) {
            showAlert('Fallo de Red', 'Verifique su conexión a internet.', 'error');
        } finally {
            setActionLoading(false);
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
                showAlert('QR Generado', 'Muestre este código en la lectora de la portería o zona común.', 'success');
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
    // BBQ ACTION
    // ==========================================

    const handleReserveBbq = async (serviceId: string) => {
        if (!selectedBbqDate) {
            showAlert('Campo requerido', 'Por favor introduce una fecha (AAAA-MM-DD) para la reserva.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/bbq/reserve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    date: selectedBbqDate,
                    timeSlot: selectedBbqSlot,
                    serviceId,
                }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showAlert('Reserva Creada', `Reserva confirmada para el BBQ el día ${data.date} en el horario ${data.timeSlot}.`, 'success');
                setSelectedBbqDate('');
                fetchBbqAvailability();
            } else {
                showAlert('Error', data.message || 'No se pudo reservar en este momento.', 'error');
            }
        } catch (error) {
            showAlert('Fallo de Red', 'Intente de nuevo más tarde.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // PARKING ACTION
    // ==========================================

    const handleGenerateVisitorAccess = async () => {
        if (!visitorPlate) {
            showAlert('Placa Requerida', 'Ingresa la placa del vehículo visitante.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/resident-services/parqueadero/visita-temporal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    plate: visitorPlate,
                    name: visitorName,
                }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showAlert('Acceso Creado', `Se generó el código temporal ${data.accessCode} para el vehículo ${visitorPlate}.`, 'success');
                setTempCodes(prev => [data, ...prev]);
                setVisitorPlate('');
                setVisitorName('');
            } else {
                showAlert('Error', data.message || 'No se pudo generar el acceso.', 'error');
            }
        } catch (error) {
            showAlert('Error de Red', 'Revisa tu conexión.', 'error');
        } finally {
            setActionLoading(false);
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
                {(['all', 'gate', 'cameras', 'qr', 'bbq', 'parking'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveSection(tab)}
                        style={[styles.tabButton, activeTabStyle(activeSection === tab)]}
                    >
                        <Text style={[styles.tabButtonText, activeTabTextStyle(activeSection === tab)]}>
                            {tab === 'all' && 'Todos'}
                            {tab === 'gate' && 'Portón'}
                            {tab === 'cameras' && 'Cámaras'}
                            {tab === 'qr' && 'Código QR'}
                            {tab === 'bbq' && 'BBQ'}
                            {tab === 'parking' && 'Parqueadero'}
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
                            onPress={handleDoorbellRing}
                        >
                            <Bell size={14} color="#6366f1" />
                            <Text style={styles.testDoorbellBtnText}>Probar</Text>
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
                        {(activeSection === 'all' || activeSection === 'gate') && (
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
                                        <Text style={styles.cardText}>Acciona la apertura automática del portón desde tu celular.</Text>
                                        
                                        <TouchableOpacity
                                            style={[styles.actionBtn, s.status !== 'ACTIVE' && styles.disabledBtn]}
                                            disabled={s.status !== 'ACTIVE' || actionLoading}
                                            onPress={() => handleOpenGate(s.serviceId)}
                                        >
                                            <Play size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.actionBtnText}>Abrir Portón</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}

                        {/* ==========================================
                            CAMERAS SECTION
                           ========================================== */}
                        {(activeSection === 'all' || activeSection === 'cameras') && (
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
                                            <View style={styles.cameraPreviewContainer}>
                                                <View style={styles.cameraDot} />
                                                <Text style={styles.cameraPreviewText}>Transmisión en vivo simulada</Text>
                                                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                                                    {s.serviceName.toUpperCase()} - FEED ACTIVO
                                                </Text>
                                            </View>
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
                            QR ACCESOS SECTION
                           ========================================== */}
                        {(activeSection === 'all' || activeSection === 'qr') && (
                            <View style={styles.serviceCard}>
                                <View style={styles.cardHeader}>
                                    <Smartphone size={22} color={Colors.primary} />
                                    <View style={styles.cardHeaderTitleContainer}>
                                        <Text style={styles.cardTitle}>Código QR de Acceso</Text>
                                        <Text style={styles.cardSubtitle}>Piscina, Gimnasio y zonas comunes</Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    <Text style={styles.cardText}>Genera un código QR dinámico de un solo uso para registrar tu ingreso.</Text>

                                    {/* Selector de servicio */}
                                    {services.filter(s => s.category === 'AMENITIES' || s.provider === 'QR_ACCESS').length > 0 && (
                                        <View style={styles.qrServiceSelectorContainer}>
                                            <Text style={styles.cardTextHeader}>Seleccionar servicio:</Text>
                                            {(services.filter(s => s.category === 'AMENITIES' || s.provider === 'QR_ACCESS')).map(s => {
                                                const isSelected = selectedServiceForQr === s.serviceId;
                                                return (
                                                    <TouchableOpacity
                                                        key={s.serviceId}
                                                        style={[
                                                            styles.qrServiceOption,
                                                            isSelected && styles.qrServiceOptionSelected,
                                                            s.status !== 'ACTIVE' && styles.qrServiceOptionDisabled,
                                                        ]}
                                                        onPress={() => setSelectedServiceForQr(s.serviceId)}
                                                    >
                                                        <View style={styles.qrServiceOptionInfo}>
                                                            <Text style={[
                                                                styles.qrServiceOptionName,
                                                                isSelected && { color: Colors.primary },
                                                            ]}>
                                                                {s.serviceName}
                                                            </Text>
                                                            <Text style={[
                                                                styles.qrServiceOptionStatus,
                                                                { color: getStatusColor(s.status) },
                                                            ]}>
                                                                {getStatusText(s.status)}
                                                            </Text>
                                                        </View>
                                                        {isSelected && (
                                                            <CheckCircle2 size={18} color={Colors.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {qrCode ? (
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
                                        <TouchableOpacity
                                            style={[styles.actionBtn, {
                                                opacity: selectedServiceForQr && services.find(s => s.serviceId === selectedServiceForQr)?.status === 'ACTIVE' ? 1 : 0.5
                                            }]}
                                            disabled={actionLoading || !selectedServiceForQr || services.find(s => s.serviceId === selectedServiceForQr)?.status !== 'ACTIVE'}
                                            onPress={handleGenerateQr}
                                        >
                                            <RefreshCw size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.actionBtnText}>Generar Acceso QR</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ==========================================
                            BBQ SECTION
                           ========================================== */}
                        {(activeSection === 'all' || activeSection === 'bbq') && (
                            services.filter(s => s.category === 'AMENITIES' && s.serviceName.toUpperCase().includes('BBQ')).map(s => (
                                <View key={s.serviceId} style={styles.serviceCard}>
                                    <View style={styles.cardHeader}>
                                        <Calendar size={22} color={Colors.primary} />
                                        <View style={styles.cardHeaderTitleContainer}>
                                            <Text style={styles.cardTitle}>{s.serviceName}</Text>
                                            <Text style={styles.cardSubtitle}>Reservas y agenda de área social</Text>
                                        </View>
                                        <Text style={[styles.statusBadge, { color: getStatusColor(s.status) }]}>
                                            {getStatusText(s.status)}
                                        </Text>
                                    </View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.cardText}>Reserva tu espacio social directamente.</Text>
                                        
                                        {/* Agenda Preview */}
                                        <View style={styles.bbqAvailabilityContainer}>
                                            <Text style={styles.bbqAvailabilityHeader}>Fechas reservadas recientemente:</Text>
                                            {bbqBookings.map((bk, i) => (
                                                <View key={i} style={styles.bbqRow}>
                                                    <Text style={styles.bbqDate}>{bk.date}</Text>
                                                    <Text style={styles.bbqStatus}>{bk.timeSlot} ({bk.status})</Text>
                                                </View>
                                            ))}
                                        </View>

                                        <View style={styles.bookingForm}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Fecha AAAA-MM-DD (Ej. 2026-06-20)"
                                                value={selectedBbqDate}
                                                onChangeText={setSelectedBbqDate}
                                                placeholderTextColor={Colors.muted}
                                            />
                                            <TouchableOpacity
                                                style={[styles.actionBtn, s.status !== 'ACTIVE' && styles.disabledBtn]}
                                                disabled={s.status !== 'ACTIVE' || actionLoading}
                                                onPress={() => handleReserveBbq(s.serviceId)}
                                            >
                                                <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                                                <Text style={styles.actionBtnText}>Reservar BBQ</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}

                        {/* ==========================================
                            PARKING VEHICLES AND VISITOR CODES
                           ========================================== */}
                        {(activeSection === 'all' || activeSection === 'parking') && (
                            <View style={styles.serviceCard}>
                                <View style={styles.cardHeader}>
                                    <Zap size={22} color={Colors.primary} />
                                    <View style={styles.cardHeaderTitleContainer}>
                                        <Text style={styles.cardTitle}>Parqueadero y Control Vehicular</Text>
                                        <Text style={styles.cardSubtitle}>Mis vehículos y accesos de visitantes</Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    {/* Resident vehicles list */}
                                    <Text style={styles.cardTextHeader}>Vehículos Autorizados:</Text>
                                    {vehicles.map((v, i) => (
                                        <View key={i} style={styles.vehicleRow}>
                                            <Text style={styles.vehiclePlate}>{v.plate}</Text>
                                            <Text style={styles.vehicleDesc}>{v.brand} {v.model} ({v.color})</Text>
                                        </View>
                                    ))}

                                    {/* Generate visitor code */}
                                    <Text style={[styles.cardTextHeader, { marginTop: 16 }]}>Generar Acceso para Visitante:</Text>
                                    <View style={styles.parkingForm}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Placa del visitante (Ej. DEF-456)"
                                            value={visitorPlate}
                                            onChangeText={setVisitorPlate}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Nombre del visitante (Ej. Juan Pérez)"
                                            value={visitorName}
                                            onChangeText={setVisitorName}
                                            placeholderTextColor={Colors.muted}
                                        />
                                        <TouchableOpacity
                                            style={styles.actionBtn}
                                            disabled={actionLoading}
                                            onPress={handleGenerateVisitorAccess}
                                        >
                                            <Key size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.actionBtnText}>Generar Código Visita</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Generated visitor codes history */}
                                    {tempCodes.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={styles.cardTextHeader}>Códigos Temporales Activos:</Text>
                                            {tempCodes.map((code, idx) => (
                                                <View key={idx} style={styles.codeRow}>
                                                    <Text style={styles.codeText}>{code.accessCode} - Placa: {code.plate}</Text>
                                                    <Text style={styles.codeExpiry}>Vence: {new Date(code.validUntil).toLocaleTimeString()}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
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
                />
            )}
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
    cameraPreviewContainer: {
        height: 150,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    cameraDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    cameraPreviewText: {
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#eef2ff',
    },
    testDoorbellBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6366f1',
    },
});
