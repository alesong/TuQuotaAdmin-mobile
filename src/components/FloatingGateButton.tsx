import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  Text,
  Modal,
} from 'react-native';
import { Settings, X } from 'lucide-react-native';
import { useFloatingGate } from '../context/FloatingGateContext';
import { Colors } from '../constants/Colors';

const BUTTON_SIZE = 62;
const EDGE_PADDING = 12;

interface Props {
  onOpenGate: (serviceId: string, serviceName: string) => void;
  gateLoading: string | null;
}

export function FloatingGateButton({ onOpenGate, gateLoading }: Props) {
  const { enabled, serviceId, serviceName, buttonConfig, position, setPosition, dismiss } = useFloatingGate();

  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

  // Extract styles from backend config (same logic as ActionButton)
  const cfg = buttonConfig || {};
  const bgColor = cfg.bgColor || '#2563EB';
  const txtColor = cfg.textColor || '#ffffff';
  const bdrColor = cfg.borderColor || 'transparent';
  const bdrWidth = cfg.borderWidth ?? 0;
  const bdrRadius = cfg.borderRadius ?? 10;
  const padV = cfg.paddingVertical ?? 12;
  const padH = cfg.paddingHorizontal ?? 16;
  const fSize = cfg.fontSize ?? 22;
  const fWeight = cfg.fontWeight || 'bold';
  const iconSize = cfg.iconSize ?? fSize;
  const btnHeight = cfg.height || undefined;
  const shadowOffsetY = cfg.shadowOffsetY ?? 2;
  const shadowOpacityVal = cfg.shadowOpacity ?? 0.1;
  const shadowRadius = cfg.shadowRadius ?? 4;
  const shadowColor = cfg.shadowColor || 'rgba(0,0,0,0.1)';
  const imageUrl = cfg.imageUrl;

  // The emoji/text could be in `label`, `text`, or `icon` depending on backend config
  // Also handle the case where `icon` is an emoji (not a lucide icon name)
  const rawLabel = cfg.label || cfg.text || '';
  const rawIcon = cfg.icon || '';
  // If icon looks like an emoji (not a lucide key), use it as display text
  const iconIsEmoji = rawIcon && !/^[A-Z][a-zA-Z0-9]+$/.test(rawIcon);
  const labelText = rawLabel || (iconIsEmoji ? rawIcon : '');

  // Compute initial position
  const getInitialPos = () => {
    if (position.x >= 0 && position.y >= 0) {
      return { x: position.x, y: position.y };
    }
    // Default: bottom-right
    return {
      x: SCREEN_W - BUTTON_SIZE - EDGE_PADDING,
      y: SCREEN_H - BUTTON_SIZE - EDGE_PADDING - 80,
    };
  };

  const pan = useRef(new Animated.ValueXY(getInitialPos())).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Fade in/out when enabled changes
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: enabled ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [enabled]);

  // Snap to nearest edge after drag
  const snapToEdge = (x: number, y: number) => {
    const maxY = SCREEN_H - BUTTON_SIZE - EDGE_PADDING - 80;
    const minY = EDGE_PADDING + 40;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    const snapX = x < SCREEN_W / 2 ? EDGE_PADDING : SCREEN_W - BUTTON_SIZE - EDGE_PADDING;

    Animated.spring(pan, {
      toValue: { x: snapX, y: clampedY },
      useNativeDriver: false,
      tension: 200,
      friction: 20,
    }).start();

    setPosition(snapX, clampedY);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        hasMovedRef.current = false;
        dragStartRef.current = { x: pan.x._value, y: pan.y._value };
        pan.extractOffset();
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          useNativeDriver: true,
          tension: 300,
          friction: 15,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        hasMovedRef.current = true;
        setIsDragging(true);
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 20,
        }).start();

        const wasDrag = hasMovedRef.current;
        setIsDragging(false);

        // Reset so the next tap can fire handlePress
        hasMovedRef.current = false;

        if (!wasDrag) return;

        // Snap to edge
        const finalX = dragStartRef.current.x + gestureState.dx;
        const finalY = dragStartRef.current.y + gestureState.dy;
        snapToEdge(finalX, finalY);
      },
    })
  ).current;

  const handlePress = () => {
    const moved = hasMovedRef.current;
    // Reset immediately so the NEXT tap works even if this one was blocked
    hasMovedRef.current = false;
    if (isDragging || moved || !serviceId) return;
    onOpenGate(serviceId, serviceName || 'Puerta');
  };

  const handleLongPress = () => {
    setMenuVisible(true);
  };

  const handleDismiss = () => {
    setMenuVisible(false);
    dismiss();
  };

  if (!enabled || !serviceId) return null;

  const isGateLoading = gateLoading === serviceId;

  // Build button style: take visual styles from backend but keep circular floating shape
  // Ignore backend width/height — the floating button is always a 62px circle
  const buttonStyle: any[] = [
    styles.button,
    {
      backgroundColor: imageUrl ? 'transparent' : bgColor,
      borderColor: bdrColor,
      borderWidth: bdrWidth,
      borderRadius: BUTTON_SIZE / 2, // Always circular
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    shadowOffsetY > 0
      ? {
          shadowColor,
          shadowOffset: { width: 0, height: shadowOffsetY },
          shadowOpacity: shadowOpacityVal,
          shadowRadius,
          elevation: 12,
        }
      : {},
    isGateLoading && styles.buttonLoading,
  ];

  return (
    <>
      {/* Outer view: position animation (useNativeDriver: false) */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        pointerEvents="box-none"
        {...panResponder.panHandlers}
      >
        {/* Inner view: scale + opacity animation (useNativeDriver: true) */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            alignItems: 'center',
          }}
        >
        <TouchableOpacity
          style={buttonStyle}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={600}
          activeOpacity={0.85}
          disabled={isGateLoading}
          accessibilityLabel={`Abrir ${serviceName || 'puerta'}`}
          accessibilityRole="button"
        >
          {imageUrl ? (
            <View style={[styles.bgImage, { borderRadius: bdrRadius }]}>
              <Animated.Image
                source={{ uri: imageUrl }}
                style={[styles.bgImage, { borderRadius: bdrRadius }]}
                resizeMode="cover"
              />
            </View>
          ) : null}
          {isGateLoading ? (
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.dot, styles.dot1, { backgroundColor: txtColor }]} />
              <Animated.View style={[styles.dot, styles.dot2, { backgroundColor: txtColor }]} />
              <Animated.View style={[styles.dot, styles.dot3, { backgroundColor: txtColor }]} />
            </View>
          ) : (
            <Text
              style={{
                color: txtColor,
                fontSize: fSize || 20,
                fontWeight: fWeight as any,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {labelText || '⚙'}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.labelContainer}>
          <Text style={styles.nameLabel} numberOfLines={2}>
            {serviceName || 'Puerta'}
          </Text>
        </View>
        </Animated.View>
      </Animated.View>

      {/* Context menu modal */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Botón Flotante</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Settings size={18} color={Colors.primary} />
              <Text style={styles.menuItemText}>Mover a otra posición</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDismiss}>
              <X size={18} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Ocultar botón flotante</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: BUTTON_SIZE + 20,
    zIndex: 9999,
    elevation: 20,
    alignItems: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonLoading: {
    opacity: 0.7,
  },
  bgImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  nameLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    textAlign: 'center',
    maxWidth: BUTTON_SIZE + 10,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  menuItemText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  menuItemDanger: {
    marginTop: 2,
  },
});

export default FloatingGateButton;
