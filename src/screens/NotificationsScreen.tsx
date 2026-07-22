import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { ArrowLeft, Bell, BellRing, ChevronRight, X, FileText, Trash2, CheckCircle2, Circle } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { registerForPushNotificationsAsync, updateAppBadge } from '../lib/notifications';
import api from '../lib/api';
import { Linking } from 'react-native';

interface UserNotification {
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: Date;
    type?: string;
    relatedId?: string;
}

export const NotificationsScreen = ({ navigation }: any) => {
    const { user, updateUser, token } = useAuth();
    const { showAlert } = useAlert();
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isPushModalVisible, setIsPushModalVisible] = useState(false);

    useEffect(() => {
        fetchNotifications();

        // Mostrar alerta de push notifications si el usuario no tiene token registrado
        // Se habilita también para Web para soportar Web Push
        if (!(user as any)?.push_token) {
            setIsPushModalVisible(true);
        }
    }, [user]);

    useEffect(() => {
        const unreadCount = notifications.filter(n => !n.isRead).length;
        updateAppBadge(unreadCount);
    }, [notifications]);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/notifications');
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.map((n: any) => ({
                    id: n.id,
                    title: n.title,
                    body: n.body,
                    isRead: n.is_read,
                    type: n.type,
                    relatedId: n.related_id,
                    createdAt: new Date(n.created_at)
                })));
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewReceipt = async (pagoId: string) => {
        try {
            const response = await fetch(`${api.getApiUrl()}/payments/${pagoId}/receipt`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.url_pdf) {
                    Linking.openURL(data.url_pdf);
                } else {
                    showAlert({ title: "Información", message: "El comprobante está siendo generado. Por favor intenta en unos minutos.", type: 'info' });
                }
            } else {
                showAlert({ title: "Error", message: "No se pudo obtener el comprobante.", type: 'error' });
            }
        } catch (error) {
            console.error(error);
            showAlert({ title: "Error", message: "Hubo un problema al conectar con el servidor.", type: 'error' });
        }
    };

    const handleEnablePush = async () => {
        setIsPushModalVisible(false);
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                // Actualizar localmente el usuario para que no volver a pedir
                updateUser({ ...user, push_token: token } as any);
                showAlert({ title: "¡Éxito!", message: "Notificaciones activadas correctamente.", type: 'success' });
            }
        } catch (error) {
            console.error(error);
            showAlert({ title: "Error", message: "No se pudieron activar las notificaciones.", type: 'error' });
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            const response = await api.patch(`/notifications/${id}/read`, {});
            if (response.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            }
        } catch (e) {
            console.error("Error marking notification as read", e);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id);
            } else {
                return [...prev, id];
            }
        });
        
        if (selectedIds.length === 1 && selectedIds.includes(id) && isSelectionMode) {
            // This is just a hint, size-based logic should probably stay in the component
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.length === 0) return;

        const performDelete = async () => {
            setIsLoading(true);
            try {
                const response = await api.post('/notifications/delete-batch', {
                    ids: selectedIds
                });
                
                if (response.ok) {
                    setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                    showAlert({ title: "Éxito", message: "Notificaciones eliminadas correctamente.", type: 'success' });
                } else {
                    showAlert({ title: "Error", message: "No se pudieron eliminar las notificaciones.", type: 'error' });
                }
            } catch (error) {
                console.error("Delete notifications error:", error);
                showAlert({ title: "Error", message: "Ocurrió un error al intentar eliminar las notificaciones.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        showAlert({
            title: "Eliminar notificaciones",
            message: `¿Estás seguro que deseas eliminar ${selectedIds.length} notificación${selectedIds.length > 1 ? 'es' : ''}? Esta acción no se puede deshacer.`,
            type: 'warning',
            buttons: [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive", 
                    onPress: performDelete
                } 
            ]
        });
    };

    const toggleAll = () => {
        if (selectedIds.length === notifications.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(notifications.map(n => n.id));
        }
    };

    const renderNotification = ({ item }: { item: UserNotification }) => {
        const isSelected = selectedIds.includes(item.id);
        
        return (
            <TouchableOpacity
                style={[
                    styles.notificationCard, 
                    !item.isRead && styles.unreadCard,
                    selectedIds.includes(item.id) && styles.selectedCard
                ]}
                onPress={() => {
                    if (isSelectionMode) {
                        toggleSelection(item.id);
                    } else {
                        handleMarkAsRead(item.id);
                    }
                }}
                onLongPress={() => {
                    if (!isSelectionMode) {
                        setIsSelectionMode(true);
                        toggleSelection(item.id);
                    }
                }}
                activeOpacity={0.7}
            >
                <View style={styles.contentAndCheckbox}>
                    {isSelectionMode && (
                        <View style={styles.checkboxContainer}>
                            {selectedIds.includes(item.id) ? (
                                <View style={styles.checkboxSelected}>
                                    <CheckCircle2 size={24} color={Colors.primary} fill={Colors.primary + '20'} />
                                </View>
                            ) : (
                                <Circle size={24} color={Colors.muted} opacity={0.4} />
                            )}
                        </View>
                    )}
                    
                    <View style={[styles.iconContainer, !item.isRead && styles.unreadIconContainer]}>
                        <Bell size={20} color={!item.isRead ? Colors.primary : Colors.muted} />
                    </View>
                    <View style={styles.notificationContent}>
                        <Text style={[styles.notificationTitle, !item.isRead && styles.unreadText]}>{item.title}</Text>
                        <Text style={styles.notificationBody}>{item.body}</Text>
                        
                        {item.type === 'PAYMENT' && item.relatedId && !isSelectionMode && (
                            <TouchableOpacity 
                                style={styles.actionButton} 
                                onPress={() => {
                                    handleMarkAsRead(item.id);
                                    handleViewReceipt(item.relatedId!);
                                }}
                            >
                                <FileText size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.actionButtonText}>Ver comprobante de pago</Text>
                            </TouchableOpacity>
                        )}

                        <Text style={styles.notificationTime}>
                            {item.createdAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    {!item.isRead && !isSelectionMode && <View style={styles.unreadDot} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {isSelectionMode ? (
                    <TouchableOpacity 
                        onPress={() => {
                            setIsSelectionMode(false);
                            setSelectedIds([]);
                        }} 
                        style={styles.headerButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={24} color={Colors.text} />
                    </TouchableOpacity>
                )}
                
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {isSelectionMode 
                        ? `${selectedIds.length} seleccionada${selectedIds.length !== 1 ? 's' : ''}`
                        : "Notificaciones"
                    }
                </Text>
                
                {notifications.length > 0 && (
                    isSelectionMode ? (
                        <View style={styles.headerActions}>
                            <TouchableOpacity 
                                onPress={toggleAll} 
                                style={styles.headerButton}
                                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                            >
                                <View style={[styles.selectAllIndicator, selectedIds.length === notifications.length && styles.selectAllActive]} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleDeleteSelected} 
                                disabled={selectedIds.length === 0} 
                                style={[styles.headerButton, selectedIds.length === 0 && { opacity: 0.3 }]}
                                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                            >
                                <Trash2 size={24} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => setIsSelectionMode(true)} 
                            style={styles.headerButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.selectText}>Seleccionar</Text>
                        </TouchableOpacity>
                    )
                )}
            </View>

            <View style={styles.content}>
                {isLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Bell size={48} color={Colors.muted} opacity={0.3} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyTitle}>Sin notificaciones</Text>
                        <Text style={styles.emptyText}>No tienes notificaciones por el momento.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        renderItem={renderNotification}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Modal to activate push notifications */}
            <Modal
                visible={isPushModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsPushModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <BellRing size={28} color={Colors.primary} />
                            </View>
                            <TouchableOpacity onPress={() => setIsPushModalVisible(false)} style={styles.closeButton}>
                                <X size={24} color={Colors.muted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalTitle}>Activa las notificaciones</Text>
                        <Text style={styles.modalBody}>
                            Mantente al día con los avisos importantes para tu unidad y recordatorios de pagos.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleEnablePush}>
                                <Text style={styles.primaryButtonText}>Activar Notificaciones</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsPushModalVisible(false)}>
                                <Text style={styles.secondaryButtonText}>Quizás más tarde</Text>
                            </TouchableOpacity>
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
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'web' ? 16 : 48,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    headerButton: {
        padding: 8,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.text,
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    selectText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    selectAllIndicator: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: Colors.muted,
    },
    selectAllActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    content: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.muted,
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    notificationCard: {
        flexDirection: 'column',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '03',
    },
    contentAndCheckbox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkboxContainer: {
        paddingRight: 12,
        paddingTop: 8,
    },
    checkboxSelected: {
        // any specific style
    },
    unreadCard: {
        backgroundColor: Colors.primary + '08',
        borderColor: Colors.primary + '20',
        borderWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    unreadIconContainer: {
        backgroundColor: Colors.primary + '15',
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    unreadText: {
        color: Colors.primary,
        fontWeight: '700',
    },
    notificationBody: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 8,
    },
    notificationTime: {
        fontSize: 12,
        color: Colors.muted,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        marginLeft: 8,
        marginTop: 6,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 4,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 16,
        position: 'relative',
    },
    modalIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: -10,
        top: -10,
        padding: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalBody: {
        fontSize: 15,
        color: Colors.muted,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalActions: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    secondaryButtonText: {
        color: Colors.muted,
        fontSize: 16,
        fontWeight: '600',
    },
});
