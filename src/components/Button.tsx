import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    style?: any;
    prefix?: React.ReactNode;
}

export const Button = ({ title, onPress, variant = 'primary', loading = false, disabled = false, style, prefix }: ButtonProps) => {
    const getBackgroundColor = () => {
        if (disabled) return Colors.muted;
        switch (variant) {
            case 'primary': return Colors.primary;
            case 'secondary': return Colors.secondary;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            default: return Colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return '#fff';
        switch (variant) {
            case 'primary': return Colors.primaryForeground;
            case 'secondary': return Colors.secondaryForeground;
            case 'outline': return Colors.primary;
            case 'ghost': return Colors.primary;
            default: return Colors.primaryForeground;
        }
    };

    const getBorderColor = () => {
        if (variant === 'outline') return Colors.primary;
        return 'transparent';
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: getBackgroundColor(), borderColor: getBorderColor(), borderWidth: variant === 'outline' ? 1 : 0 },
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {prefix}
                    <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        flexDirection: 'row',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
