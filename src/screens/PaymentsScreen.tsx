import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Linking, ScrollView, Modal, Clipboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, CheckCircle, XCircle, Building2, Copy, Upload, FileUp, Minus, Plus, Pencil } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Config } from '../constants/Config';
import imageCompression from 'browser-image-compression';
// Removed expo-image-picker import as we're using standard web inputs for compatibility


export const PaymentsScreen = ({ navigation, route }: any) => {
    const { viviendaId, monto, cuotaIds, viviendasCount, condominioId, monthlyCuota: monthlyCuotaParam } = route.params || {};
    const { user, token } = useAuth();
    const { showAlert } = useAlert();
    const [loading, setLoading] = React.useState(false);
    const [brebModalVisible, setBrebModalVisible] = React.useState(false);
    const [brebReceiptUri, setBrebReceiptUri] = React.useState<string | null>(null);
    const [brebReceiptFile, setBrebReceiptFile] = React.useState<any>(null);
    const [brebSubmitting, setBrebSubmitting] = React.useState(false);
    const [payAmount, setPayAmount] = React.useState<number>(Number(monto) || 0);
    const [advanceModalVisible, setAdvanceModalVisible] = React.useState<boolean>(Number(monto) === 0);
    const [advanceMonths, setAdvanceMonths] = React.useState<number>(Number(monto) === 0 ? 1 : 0);

    const condo = React.useMemo(() => {
        const associations: any[] = user?.viviendas || [];
        
        console.log('[PaymentsScreen] Searching condo context for:', { 
            viviendaId, 
            condominioId, 
            associationsCount: associations.length 
        });

        if (associations.length === 0) {
            console.log('[PaymentsScreen] No associations found in user object');
            return null;
        }

        let foundCondo = null;

        // 1. Try search by condominioId (strongest match for this screen)
        if (condominioId) {
            const assoc = associations.find((a: any) => 
                (a?.vivienda?.condominio?.id === condominioId) || 
                (a?.condominio_id === condominioId) ||
                (a?.condominio?.id === condominioId)
            );
            foundCondo = assoc?.vivienda?.condominio || assoc?.condominio;
        }

        // 2. Try search by viviendaId as fallback
        if (!foundCondo && viviendaId) {
            const assoc = associations.find((a: any) => 
                (a?.vivienda?.id === viviendaId) || 
                (a?.vivienda_id === viviendaId) ||
                (a?.id === viviendaId)
            );
            foundCondo = assoc?.vivienda?.condominio || assoc?.condominio;
        }

        // 3. Last resort: if only one condo association exists, use it
        if (!foundCondo && associations.length === 1) {
            foundCondo = associations[0]?.vivienda?.condominio || associations[0]?.condominio;
        }

        console.log('[PaymentsScreen] Resolved Condo Data:', {
            id: foundCondo?.id,
            name: foundCondo?.name,
            hasBrebKey: !!(foundCondo?.breb_key || foundCondo?.bre_b_key || foundCondo?.brebKey)
        });

        return foundCondo || null;
    }, [user?.viviendas, condominioId, viviendaId]);

    const resolvedViviendaId = React.useMemo(() => {
        if (viviendaId) return viviendaId;
        if (!condo?.id) return undefined;
        const associations: any[] = user?.viviendas || [];
        return (
            associations.find((a: any) => (a?.vivienda?.condominio?.id === condo.id) || (a?.condominio_id === condo.id))?.vivienda?.id
        );
    }, [viviendaId, user?.viviendas, condo?.id]);

    const monthlyCuota = (() => {
        if (monthlyCuotaParam && Number(monthlyCuotaParam) > 0) return Number(monthlyCuotaParam);
        const associations: any[] = user?.viviendas || [];
        const assoc = associations.find((a: any) =>
            (a?.vivienda?.id === resolvedViviendaId) ||
            (a?.vivienda_id === resolvedViviendaId) ||
            (a?.id === resolvedViviendaId)
        );
        const summary = assoc?.vivienda?.summary;
        const items = [...(summary?.pagadas || []), ...(summary?.pendientes || [])];
        items.sort((a: any, b: any) => (b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes));
        return Number(items[0]?.monto) || 0;
    })();

    const baseBalance = Number(monto) || 0;
    const minAdvanceMonths = baseBalance > 0 ? 0 : 1;
    const maxAdvanceMonths = 12;
    const advanceAmount = advanceMonths * monthlyCuota;
    const computedPayAmount = baseBalance + advanceAmount;
    const isAdvanceAllowed = monthlyCuota > 0 && !!resolvedViviendaId;

    const openAdvanceModal = () => {
        setAdvanceMonths(baseBalance > 0 ? 0 : 1);
        setAdvanceModalVisible(true);
    };

    const confirmAdvance = () => {
        setPayAmount(computedPayAmount);
        setAdvanceModalVisible(false);
    };

    const wompiEnabled = !!condo?.wompi_public_key;
    
    // Improved key extraction with support for various naming conventions and null-string safety
    const brebKey = (() => {
        if (!condo) return "";
        const c = condo as any;
        const key = c.breb_key || c.bre_b_key || c.brebKey || c.brebB_key || "";
        if (key === "null" || key === "undefined" || key === "null_key") return "";
        return String(key).trim();
    })();

    const brebTitular = (condo as any)?.breb_titular || (condo as any)?.brebTitular || "";
    const brebEnabled = !!brebKey && brebKey.length > 5; // Minimal length check to avoid garbage

    const handlePayment = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/payments/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    propietario_id: user?.id,
                    vivienda_id: resolvedViviendaId || undefined,
                    cuota_ids: cuotaIds,
                    monto_total: payAmount
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    Linking.openURL(data.url);
                    navigation.goBack();
                } else {
                    showAlert({ title: 'Error', message: 'No se pudo abrir la pasarela de pagos. Por favor intenta de nuevo.', type: 'error' });
                }
            }
            else {
                const error = await response.json();
                showAlert({ title: 'Error', message: error.message || 'No se pudo iniciar el pago', type: 'error' });
            }
        } catch (error) {
            console.error(error);
            showAlert({ title: 'Error', message: 'Hubo un problema de conexión', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const pickBrebReceipt = async () => {
        if (Platform.OS !== 'web') {
            showAlert({ title: 'Error', message: 'La selección de archivos solo está disponible en la versión web.', type: 'error' });
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                setBrebReceiptFile(file);
                const reader = new FileReader();
                reader.onload = (re) => {
                    setBrebReceiptUri(re.target?.result as string);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleSubmitBreb = async () => {
        if (!condo?.id) {
            showAlert({ title: 'Aviso', message: 'No encontramos el condominio para enviar tu comprobante.', type: 'warning' });
            return;
        }
        if (!brebReceiptFile) {
            showAlert({ title: 'Aviso', message: 'Por favor selecciona el comprobante de la transferencia.', type: 'warning' });
            return;
        }

        setBrebSubmitting(true);
        try {
            let fileToUpload = brebReceiptFile;
            
            // 1. Compression (only for images) - 1MB limit as per repo standard
            if (brebReceiptFile.type.startsWith('image/')) {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1200,
                    useWebWorker: true,
                    initialQuality: 0.8
                };
                try {
                    fileToUpload = await imageCompression(brebReceiptFile, options);
                } catch (compressionError) {
                    console.error("Compression failed, using original file", compressionError);
                }
            }

            const formData = new FormData();
            formData.append('condominioId', condo.id);
            formData.append('viviendaId', resolvedViviendaId || '');
            formData.append('monto', payAmount.toString());
            formData.append('cuotaIds', (cuotaIds || []).join(','));
            formData.append('receipt', fileToUpload);

            const submitResp = await fetch(`${Config.API_URL}/payments/submit-breb`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const submitData = await submitResp.json().catch(() => null);
            if (!submitResp.ok) {
                throw new Error(submitData?.message || 'No se pudo enviar el comprobante.');
            }

            showAlert({ 
                title: '¡Recibido!', 
                message: 'Tu comprobante fue enviado correctamente. El pago se verá reflejado en tu historial cuando el administrador lo confirme.', 
                type: 'success' 
            });
            setBrebModalVisible(false);
            setBrebReceiptUri(null);
            setBrebReceiptFile(null);
            
            setTimeout(() => {
                navigation.goBack();
            }, 500);
            
        } catch (e: any) {
            showAlert({ title: 'Error', message: e?.message || 'No se pudo completar el proceso.', type: 'error' });
        } finally {
            setBrebSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ArrowLeft color={Colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pagar Administración</Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>

                <View style={styles.balanceContainer}>
                    <Text style={styles.balanceLabel}>Total a Pagar</Text>
                    <Text style={styles.balanceValue}>${payAmount?.toLocaleString('es-CO')}</Text>
                    {isAdvanceAllowed && (
                        <TouchableOpacity style={styles.otherValueButton} onPress={openAdvanceModal}>
                            <Pencil size={12} color="rgba(255, 255, 255, 0.9)" />
                            <Text style={styles.otherValueButtonText}>Otro valor</Text>
                        </TouchableOpacity>
                    )}
                    {payAmount > baseBalance && (() => {
                        const monthsApplied = monthlyCuota > 0 ? Math.round((payAmount - baseBalance) / monthlyCuota) : 0;
                        return (
                            <Text style={styles.advanceCaption}>Incluye {monthsApplied} {monthsApplied === 1 ? 'mes' : 'meses'} por adelantado</Text>
                        );
                    })()}
                    <Text style={styles.balanceDueDate}>Vivienda ID: {viviendaId}</Text>
                    <View style={styles.methodsContainer}>
                        {(wompiEnabled || !brebEnabled) && (
                            <View style={styles.payButtonContainer}>
                                <Button
                                    title={loading ? "Procesando..." : "Pagar con PSE"}
                                    onPress={handlePayment}
                                    disabled={loading}
                                    style={styles.payButton}
                                    prefix={
                                        <View style={styles.pseBadge}>
                                            <Text style={styles.pseText}>PSE</Text>
                                        </View>
                                    }
                                />
                            </View>
                        )}
                        
                        {brebEnabled && (
                            <View style={[styles.payButtonContainer, (wompiEnabled || !brebEnabled) && { marginTop: 12 }]}>
                                <Button
                                    title={brebSubmitting ? "Enviando..." : "Pagar con Bre-B"}
                                    onPress={() => setBrebModalVisible(true)}
                                    disabled={brebSubmitting}
                                    style={styles.payButton}
                                    prefix={
                                        <View style={styles.brebBadge}>
                                            <Text style={styles.brebBadgeText}>Bre-B</Text>
                                        </View>
                                    }
                                />
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={styles.sectionTitle}>Resumen de Selección</Text>
                    {cuotaIds && cuotaIds.length > 0 ? (
                        <View style={styles.selectionSummary}>
                            <View style={styles.summaryBadgeRow}>
                                <View style={styles.infoBadge}>
                                    <Building2 size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                                    <Text style={styles.infoBadgeText}>{viviendasCount || 1} {viviendasCount === 1 ? 'Vivienda' : 'Viviendas'}</Text>
                                </View>
                                <View style={styles.infoBadge}>
                                    <Clock size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                                    <Text style={styles.infoBadgeText}>{cuotaIds.length} {cuotaIds.length === 1 ? 'Mes' : 'Meses'}</Text>
                                </View>
                            </View>
                            <Text style={styles.selectionDescription}>
                                El pago se aplicará específicamente a los periodos seleccionados de las unidades indicadas.
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.infoText}>El pago se aplicará automáticamente a la deuda más antigua.</Text>
                    )}
                </View>

                <Modal
                    visible={advanceModalVisible && isAdvanceAllowed}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setAdvanceModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Pagar por adelantado</Text>
                                <TouchableOpacity
                                    onPress={() => setAdvanceModalVisible(false)}
                                    style={styles.modalCloseButton}
                                >
                                    <XCircle size={24} color={Colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalMessage}>
                                Elige cuántos meses quieres abonar por adelantado. El saldo a favor se aplicará automáticamente a tus próximas cuotas.
                            </Text>

                            <View style={styles.stepperContainer}>
                                <TouchableOpacity
                                    style={[styles.stepperButton, advanceMonths <= minAdvanceMonths && styles.stepperButtonDisabled]}
                                    onPress={() => setAdvanceMonths(Math.max(minAdvanceMonths, advanceMonths - 1))}
                                    disabled={advanceMonths <= minAdvanceMonths}
                                >
                                    <Minus size={20} color={advanceMonths <= minAdvanceMonths ? Colors.muted : Colors.primary} />
                                </TouchableOpacity>
                                <View style={styles.stepperValueBox}>
                                    <Text style={styles.stepperValue}>{advanceMonths}</Text>
                                    <Text style={styles.stepperLabel}>{advanceMonths === 1 ? 'Mes' : 'Meses'} por adelantado</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.stepperButton, advanceMonths >= maxAdvanceMonths && styles.stepperButtonDisabled]}
                                    onPress={() => setAdvanceMonths(Math.min(maxAdvanceMonths, advanceMonths + 1))}
                                    disabled={advanceMonths >= maxAdvanceMonths}
                                >
                                    <Plus size={20} color={advanceMonths >= maxAdvanceMonths ? Colors.muted : Colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.breakdownBox}>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>Saldo pendiente</Text>
                                    <Text style={styles.breakdownValue}>${baseBalance.toLocaleString('es-CO')}</Text>
                                </View>
                                {advanceMonths > 0 && (
                                    <View style={styles.breakdownRow}>
                                        <Text style={styles.breakdownLabel}>{advanceMonths} × ${monthlyCuota.toLocaleString('es-CO')}</Text>
                                        <Text style={styles.breakdownValue}>${advanceAmount.toLocaleString('es-CO')}</Text>
                                    </View>
                                )}
                                <View style={styles.breakdownDivider} />
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownTotalLabel}>Total a pagar</Text>
                                    <Text style={styles.breakdownTotalValue}>${computedPayAmount.toLocaleString('es-CO')}</Text>
                                </View>
                            </View>

                            <Text style={styles.advanceNote}>
                                Podrás ver tu saldo a favor en el Estado de Cuenta; cubrirá automáticamente tus cuotas futuras.
                            </Text>

                            <Button
                                title="Aplicar"
                                onPress={confirmAdvance}
                                style={{ marginTop: 16 }}
                            />

                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setAdvanceModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={brebModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setBrebModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Pagar con Bre-B</Text>
                                <TouchableOpacity 
                                    onPress={() => setBrebModalVisible(false)}
                                    style={styles.modalCloseButton}
                                >
                                    <XCircle size={24} color={Colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalMessage}>
                                Transfiere de forma fácil y segura usando la llave Bre-B registrada por tu condominio. Una vez completado el pago, adjunta el comprobante para que el administrador pueda confirmarlo.
                            </Text>

                            <View style={styles.montoInfoBox}>
                                <Text style={styles.montoInfoLabel}>Valor exacto a transferir</Text>
                                <Text style={styles.montoInfoValue}>${payAmount?.toLocaleString('es-CO')}</Text>
                            </View>

                            {!!brebKey && (
                                <View style={styles.brebKeyBox}>
                                    <View style={styles.brebKeyHeader}>
                                        <Text style={styles.brebKeyLabel}>Llave Bre-B del Condominio</Text>
                                        <TouchableOpacity 
                                            style={styles.copyButton} 
                                            onPress={() => {
                                                Clipboard.setString(brebKey);
                                                showAlert({ title: '¡Copiado!', message: 'Llave Bre-B copiada al portapapeles.', type: 'success' });
                                            }}
                                        >
                                            <Copy size={14} color={Colors.primary} />
                                            <Text style={styles.copyButtonText}>Copiar llave</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.brebKeyValue}>{brebKey}</Text>
                                    
                                    {!!brebTitular && (
                                        <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.primary + '10' }}>
                                            <Text style={styles.brebKeyLabel}>Titular de la cuenta</Text>
                                            <Text style={styles.brebKeyValue}>{brebTitular}</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <Text style={styles.inputLabel}>Adjuntar comprobante</Text>
                            <TouchableOpacity
                                style={[styles.receiptInput, !!brebReceiptUri && styles.receiptInputActive]}
                                onPress={pickBrebReceipt}
                                disabled={brebSubmitting}
                            >
                                <View style={styles.receiptInputContent}>
                                    <FileUp size={20} color={brebReceiptUri ? Colors.primary : Colors.muted} />
                                    <Text style={[styles.receiptInputText, !!brebReceiptUri && styles.receiptInputTextActive]}>
                                        {brebReceiptUri ? 'Comprobante seleccionado' : 'Subir archivo del pago'}
                                    </Text>
                                </View>
                                {!!brebReceiptUri && <CheckCircle size={16} color={Colors.success} />}
                            </TouchableOpacity>

                            {!!brebReceiptUri && (
                                <Text style={styles.selectedFileName} numberOfLines={1}>
                                    {brebReceiptUri.split('/').pop()}
                                </Text>
                            )}

                            <Text style={styles.modalSubtext}>
                                Su pago estará "Pendiente por confirmar" hasta que el administrador verifique la transacción.
                            </Text>

                            <Button
                                title={brebSubmitting ? "Enviando..." : "Confirmar Envío de Pago"}
                                onPress={handleSubmitBreb}
                                disabled={brebSubmitting || !brebReceiptUri}
                                style={{ marginTop: 16 }}
                            />

                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    if (brebSubmitting) return;
                                    setBrebModalVisible(false);
                                }}
                                disabled={brebSubmitting}
                            >
                                <Text style={styles.modalCancelText}>Regresar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
            </SafeAreaView>
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
        padding: 16,
        backgroundColor: Colors.background,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    balanceContainer: {
        backgroundColor: Colors.primary,
        padding: 24,
        alignItems: 'center',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    balanceLabel: {
        color: Colors.primaryForeground,
        opacity: 0.8,
        fontSize: 14,
        marginBottom: 8,
    },
    balanceValue: {
        color: Colors.primaryForeground,
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    balanceDueDate: {
        color: Colors.primaryForeground,
        opacity: 0.8,
        fontSize: 12,
        marginBottom: 24,
    },
    otherValueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    otherValueButtonText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    advanceCaption: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 12,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    payButtonContainer: {
        width: '100%',
        maxWidth: 240,
        backgroundColor: 'rgba(255, 255, 255, 0.15)', // Fondo suave solicitado
        padding: 10,
        borderRadius: 40,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    transactionIcon: {
        marginRight: 16,
    },
    transactionContent: {
        flex: 1,
    },
    transactionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
        marginBottom: 4,
    },
    transactionDate: {
        fontSize: 12,
        color: Colors.muted,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    selectionSummary: {
        backgroundColor: Colors.background,
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.secondary,
    },
    summaryBadgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    infoBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    selectionDescription: {
        fontSize: 14,
        color: Colors.muted,
        lineHeight: 20,
    },
    infoText: {
        fontSize: 14,
        color: Colors.muted,
        fontStyle: 'italic',
    },
    payButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    pseBadge: {
        backgroundColor: '#FFF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 10,
    },
    pseText: {
        color: '#004A99', // Color característico de PSE
        fontSize: 10,
        fontWeight: 'bold',
    },
    methodsContainer: {
        width: '100%',
        alignItems: 'center',
    },
    methodButtonsWrap: {
        width: '100%',
        justifyContent: 'center',
    },
    brebBadge: {
        backgroundColor: '#FFF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 10,
    },
    brebBadgeText: {
        color: Colors.primary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.secondary,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    modalMessage: {
        fontSize: 14,
        color: Colors.muted,
        lineHeight: 20,
        marginBottom: 20,
    },
    montoInfoBox: {
        backgroundColor: Colors.secondary,
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    montoInfoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.muted,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    montoInfoValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    brebKeyBox: {
        backgroundColor: Colors.primary + '08',
        borderColor: Colors.primary + '20',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    brebKeyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    brebKeyLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    copyButtonText: {
        fontSize: 12,
        color: Colors.primary,
        marginLeft: 6,
        fontWeight: '700',
    },
    brebKeyValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 10,
    },
    receiptInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.background,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: Colors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 4,
    },
    receiptInputActive: {
        borderColor: Colors.success,
        borderStyle: 'solid',
        backgroundColor: Colors.success + '05',
    },
    receiptInputContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    receiptInputText: {
        fontSize: 15,
        color: Colors.muted,
        marginLeft: 12,
    },
    receiptInputTextActive: {
        color: Colors.success,
        fontWeight: '600',
    },
    selectedFileName: {
        fontSize: 12,
        color: Colors.muted,
        fontStyle: 'italic',
        marginBottom: 16,
        marginLeft: 4,
    },
    modalSubtext: {
        fontSize: 13,
        color: Colors.muted,
        lineHeight: 18,
        marginBottom: 20,
        marginTop: 8,
    },
    modalCancelButton: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    modalCancelText: {
        color: Colors.muted,
        fontWeight: '600',
        fontSize: 15,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    stepperButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperButtonDisabled: {
        opacity: 0.5,
    },
    stepperValueBox: {
        alignItems: 'center',
        paddingHorizontal: 24,
        minWidth: 120,
    },
    stepperValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.text,
    },
    stepperLabel: {
        fontSize: 12,
        color: Colors.muted,
    },
    breakdownBox: {
        backgroundColor: Colors.secondary,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    breakdownLabel: {
        fontSize: 14,
        color: Colors.muted,
    },
    breakdownValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 8,
    },
    breakdownTotalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
    },
    breakdownTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    advanceNote: {
        fontSize: 13,
        color: Colors.muted,
        lineHeight: 18,
    },
});
