import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';
import { Button } from './Button';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertModalProps {
    isVisible: boolean;
    title?: string;
    message: string;
    type?: AlertType;
    onClose: () => void;
    buttons?: AlertButton[];
}

export const AlertModal: React.FC<AlertModalProps> = ({
    isVisible,
    title,
    message,
    type = 'info',
    onClose,
    buttons,
}) => {
    const getIconColor = () => {
        switch (type) {
            case 'success': return Colors.success;
            case 'error': return Colors.error;
            case 'warning': return '#f59e0b';
            default: return Colors.primary;
        }
    };

    const getTitle = () => {
        if (title) return title;
        switch (type) {
            case 'success': return '¡Éxito!';
            case 'error': return 'Ha ocurrido un error';
            case 'warning': return 'Atención';
            default: return 'Información';
        }
    };

    const renderButtons = () => {
        if (!buttons || buttons.length === 0) {
            return (
                <Button
                    title="Entendido"
                    onPress={onClose}
                    style={styles.button}
                />
            );
        }

        return (
            <View style={styles.buttonContainer}>
                {buttons.map((button, index) => (
                    <Button
                        key={index}
                        title={button.text}
                        onPress={() => {
                            if (button.onPress) button.onPress();
                            onClose();
                        }}
                        variant={button.style === 'cancel' ? 'outline' : (button.style === 'destructive' ? 'primary' : 'primary')}
                        style={[
                            styles.flexButton,
                            button.style === 'destructive' && { backgroundColor: Colors.error },
                            index > 0 && { marginLeft: 10 }
                        ]}
                    />
                ))}
            </View>
        );
    };

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={[styles.header, { borderTopColor: getIconColor() }]}>
                        <Text style={[styles.title, { color: getIconColor() }]}>{getTitle()}</Text>
                    </View>
                    <View style={styles.content}>
                        <Text style={styles.message}>{message}</Text>
                    </View>
                    <View style={styles.footer}>
                        {renderButtons()}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    header: {
        paddingTop: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderTopWidth: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    message: {
        fontSize: 16,
        color: Colors.text,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.secondary,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    button: {
        width: '100%',
    },
    flexButton: {
        flex: 1,
    },
});
