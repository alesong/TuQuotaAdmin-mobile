import React from 'react';
import { TextInput, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';

interface InputProps {
    label?: string;
    error?: string;
    style?: any;
    containerStyle?: any;
    labelStyle?: any;
    leftIcon?: React.ElementType;
    rightIcon?: React.ElementType;
    onRightIconPress?: () => void;
    iconColor?: string;
    [key: string]: any;
}

export const Input = ({ label, error, style, containerStyle, labelStyle, leftIcon: LeftIcon, rightIcon: RightIcon, onRightIconPress, iconColor, ...props }: InputProps) => {
    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
            <View style={[styles.inputWrapper, error ? styles.inputError : null, containerStyle]}>
                {LeftIcon && (
                    <LeftIcon size={20} color={iconColor || '#64748B'} style={styles.leftIcon} />
                )}
                <TextInput
                    style={[
                        styles.input,
                        LeftIcon ? styles.inputWithLeftIcon : null,
                        RightIcon ? styles.inputWithRightIcon : null,
                        style
                    ]}
                    placeholderTextColor="#94A3B8"
                    {...props}
                />
                {RightIcon && (
                    <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <RightIcon size={20} color={iconColor || '#64748B'} />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
    },
    label: {
        marginBottom: 6,
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        backgroundColor: Colors.background,
        height: 48,
    },
    input: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 16,
        fontSize: 16,
        color: Colors.text,
    },
    inputWithLeftIcon: {
        paddingLeft: 8,
    },
    inputWithRightIcon: {
        paddingRight: 8,
    },
    inputError: {
        borderColor: Colors.error,
    },
    leftIcon: {
        marginLeft: 16,
    },
    rightIcon: {
        marginRight: 16,
        padding: 4,
    },
    errorText: {
        marginTop: 4,
        fontSize: 12,
        color: Colors.error,
    },
});
