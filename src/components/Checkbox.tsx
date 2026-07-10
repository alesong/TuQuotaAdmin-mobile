import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

interface CheckboxProps {
    label?: string;
    checked: boolean;
    onPress: (checked: boolean) => void;
    error?: string;
    children?: React.ReactNode;
}

export const Checkbox = ({ label, checked, onPress, error, children }: CheckboxProps) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <TouchableOpacity
                    style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                        error ? styles.checkboxError : null
                    ]}
                    onPress={() => onPress(!checked)}
                    activeOpacity={0.7}
                >
                    {checked && <Check size={16} color="white" strokeWidth={3} />}
                </TouchableOpacity>
                <View style={styles.labelContainer}>
                    {children ? children : <Text style={styles.label}>{label}</Text>}
                </View>
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginRight: 10,
    },
    checkboxChecked: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    checkboxError: {
        borderColor: '#EF4444',
    },
    label: {
        fontSize: 14,
        color: Colors.text || '#1F2937',
    },
    labelContainer: {
        flex: 1,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 34,
    },
});
