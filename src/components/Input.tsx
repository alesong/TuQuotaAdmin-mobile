import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface InputProps {
    label?: string;
    error?: string;
    style?: any;
    [key: string]: any;
}

export const Input = ({ label, error, style, ...props }: InputProps) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    error ? styles.inputError : null,
                    style
                ]}
                placeholderTextColor={Colors.muted}
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        color: Colors.text,
        backgroundColor: Colors.background,
    },
    inputError: {
        borderColor: Colors.error,
    },
    errorText: {
        marginTop: 4,
        fontSize: 12,
        color: Colors.error,
    },
});
