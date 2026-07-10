import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform
} from 'react-native';
import { Building2, X, Check, MapPin } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CondoSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    condos: any[];
    selectedCondoId: string | null;
    onSelect: (condoId: string) => void;
}

export const CondoSelectorModal = ({
    visible,
    onClose,
    condos,
    selectedCondoId,
    onSelect
}: CondoSelectorModalProps) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.contentContainer}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.modalView}
                    >
                        <View style={styles.header}>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>Mis Condominios</Text>
                                <Text style={styles.subtitle}>Selecciona el que deseas gestionar</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={Colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scrollArea}
                            showsVerticalScrollIndicator={false}
                        >
                            {condos.map((condo) => {
                                const isSelected = condo.id === selectedCondoId;
                                return (
                                    <TouchableOpacity
                                        key={condo.id}
                                        style={[
                                            styles.condoCard,
                                            isSelected && styles.selectedCard
                                        ]}
                                        onPress={() => {
                                            onSelect(condo.id);
                                            onClose();
                                        }}
                                    >
                                        <View style={[
                                            styles.iconContainer,
                                            { backgroundColor: isSelected ? Colors.primary + '20' : Colors.secondary }
                                        ]}>
                                            <Building2
                                                size={24}
                                                color={isSelected ? Colors.primary : Colors.muted}
                                            />
                                        </View>

                                        <View style={styles.condoInfo}>
                                            <Text style={[
                                                styles.condoName,
                                                isSelected && styles.selectedText
                                            ]}>
                                                {condo.name}
                                            </Text>
                                            <View style={styles.locationRow}>
                                                <MapPin size={12} color={Colors.muted} />
                                                <Text style={styles.locationText}>
                                                    {condo.ciudad || 'Sin ciudad'}, {condo.departamento || 'Colombia'}
                                                </Text>
                                            </View>
                                        </View>

                                        {isSelected && (
                                            <View style={styles.checkContainer}>
                                                <Check size={20} color={Colors.primary} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    contentContainer: {
        width: '100%',
    },
    modalView: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 8,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: SCREEN_HEIGHT * 0.7,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 8,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.muted,
        marginTop: 4,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollArea: {
        marginBottom: 8,
    },
    condoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.background,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '05',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    condoInfo: {
        flex: 1,
    },
    condoName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 2,
    },
    selectedText: {
        color: Colors.primary,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 13,
        color: Colors.muted,
    },
    checkContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
