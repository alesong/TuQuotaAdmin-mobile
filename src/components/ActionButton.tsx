import React, { useRef } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Animated, Image } from 'react-native';
import {
  Play, Key, RefreshCw, Plus, Camera, Video, Lock, Bell,
  Calendar, Zap, Smartphone, QrCode, Eye, Search, Check, X, Power,
} from 'lucide-react-native';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Play, Key, RefreshCw, Plus, Camera, Video, Lock, Bell,
  Calendar, Zap, Smartphone, QrCode, Eye, Search, Check, X, Power,
};

interface ActionButtonProps {
  config?: Record<string, any>;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  label?: string;
  style?: any;
}

export const ActionButton = ({
  config,
  onPress,
  disabled,
  loading,
  icon,
  label,
  style,
}: ActionButtonProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const bgColor = config?.bgColor || '#2563EB';
  const txtColor = config?.textColor || '#ffffff';
  const bdrColor = config?.borderColor || 'transparent';
  const bdrWidth = config?.borderWidth ?? 0;
  const bdrRadius = config?.borderRadius ?? 10;
  const padV = config?.paddingVertical ?? 12;
  const padH = config?.paddingHorizontal ?? 16;
  const fSize = config?.fontSize ?? 14;
  const fWeight = config?.fontWeight || 'bold';
  const alignSelf = config?.alignSelf || 'stretch';
  const widthType = config?.widthType || 'auto';
  const fixedWidth = config?.width || 200;
  const iconSize = config?.iconSize ?? fSize;
  const btnHeight = config?.height || undefined;
  const shadowOffsetY = config?.shadowOffsetY ?? 2;
  const shadowOpacity = config?.shadowOpacity ?? 0.1;
  const shadowRadius = config?.shadowRadius ?? 4;
  const shadowColor = config?.shadowColor || 'rgba(0,0,0,0.1)';
  const pressOpacity = config?.pressOpacity ?? 0.85;
  const pressScale = config?.pressScale ?? 0.97;
  const imageUrl = config?.imageUrl;
  const imageSize = config?.imageSize || 'cover';

  const iconName = config?.icon || icon || '';
  const labelText = config?.label || label || '';

  const IconComponent = ICON_MAP[iconName];

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: pressScale,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: pressOpacity,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const btnWidth = widthType === 'full' ? '100%' : widthType === 'fixed' ? fixedWidth : undefined;

  const touchableStyle: any[] = [
    {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: imageUrl ? 'transparent' : bgColor,
      borderColor: bdrColor,
      borderWidth: bdrWidth,
      borderRadius: bdrRadius,
      paddingVertical: padV,
      paddingHorizontal: padH,
      overflow: 'hidden',
    },
    btnWidth ? { width: btnWidth } : {},
    btnHeight ? { height: btnHeight } : {},
    shadowOffsetY > 0
      ? {
          shadowColor,
          shadowOffset: { width: 0, height: shadowOffsetY },
          shadowOpacity,
          shadowRadius,
          elevation: 3,
        }
      : {},
    style,
  ];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={txtColor} style={{ marginRight: 6 }} />
      ) : IconComponent ? (
        <IconComponent size={iconSize} color={txtColor} style={{ marginRight: labelText ? 6 : 0 }} />
      ) : null}
      {labelText ? (
        <Text style={{ color: txtColor, fontSize: fSize, fontWeight: fWeight as any, textAlign: 'center', marginBottom: -3, marginTop: -8 }}>
          {labelText}
        </Text>
      ) : null}
    </>
  );

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim, alignSelf: alignSelf as any },
        disabled && { opacity: 0.5 },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        style={touchableStyle}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: bdrRadius }}
            resizeMode={imageSize as any}
          />
        ) : null}
        {content}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default ActionButton;
