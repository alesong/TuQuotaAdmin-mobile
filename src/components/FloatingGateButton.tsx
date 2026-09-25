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
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Check, RefreshCw, X } from 'lucide-react-native';
import { useFloatingGate, FloatingAccessService } from '../context/FloatingGateContext';
import { Colors } from '../constants/Colors';

const BUTTON_SIZE = 62;
const EDGE_PADDING = 12;

// Extrae el aspecto de un botón de portón a partir del button_config del
// backend. Lo comparten el botón flotante y las opciones del menú de cambio
// para que luzcan exactamente iguales.
function getGateCircleVisual(cfg: Record<string, any>) {
  const bgColor = cfg.bgColor || '#2563EB';
  const txtColor = cfg.textColor || '#ffffff';
  const bdrColor = cfg.borderColor || 'transparent';
  const bdrWidth = cfg.borderWidth ?? 0;
  const bdrRadius = cfg.borderRadius ?? 10;
  const fSize = cfg.fontSize ?? 22;
  const fWeight = cfg.fontWeight || 'bold';
  const shadowOffsetY = cfg.shadowOffsetY ?? 2;
  const shadowOpacityVal = cfg.shadowOpacity ?? 0.1;
  const shadowRadius = cfg.shadowRadius ?? 4;
  const shadowColor = cfg.shadowColor || 'rgba(0,0,0,0.1)';
  const imageUrl = cfg.imageUrl;

  // El label/texto puede venir en `label`, `text` o como `icon` emoji
  const rawLabel = cfg.label || cfg.text || '';
  const rawIcon = cfg.icon || '';
  const iconIsEmoji = rawIcon && !/^[A-Z][a-zA-Z0-9]+$/.test(rawIcon);
  const labelText = rawLabel || (iconIsEmoji ? rawIcon : '');

  return {
    txtColor,
    fSize,
    fWeight,
    labelText,
    imageUrl,
    bdrRadius,
    // El flotante (y por lo tanto esta opción) siempre es un círculo
    circleStyle: {
      backgroundColor: imageUrl ? 'transparent' : bgColor,
      borderColor: bdrColor,
      borderWidth: bdrWidth,
      borderRadius: BUTTON_SIZE / 2,
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    shadowStyle: shadowOffsetY > 0
      ? {
          shadowColor,
          shadowOffset: { width: 0, height: shadowOffsetY },
          shadowOpacity: shadowOpacityVal,
          shadowRadius,
          elevation: 12,
        }
      : null,
  };
}

// Opción circular del menú: mismo tamaño, colores, sombra y label que el botón
// flotante. La opción que ya está configurada se atenúa con un check y no se
// puede elegir.
function GateCircleOption({
  config,
  serviceName,
  current,
  disabled,
  onPress,
}: {
  config?: Record<string, any>;
  serviceName: string;
  current?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const v = getGateCircleVisual(config || {});
  const inactive = !!current || !!disabled;

  return (
    <View style={styles.optionWrap}>
      <TouchableOpacity
        style={[
          styles.optionCircle,
          v.circleStyle,
          v.shadowStyle || {},
          disabled && !current && styles.optionCircleUnavailable,
        ]}
        onPress={onPress}
        disabled={inactive}
        activeOpacity={0.85}
        accessibilityLabel={
          current ? `${serviceName}: botón flotante actual` : `Usar ${serviceName} como botón flotante`
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, selected: !!current }}
      >
        {v.imageUrl ? (
          <View style={[styles.bgImage, { borderRadius: v.bdrRadius }]}>
            <Image
              source={{ uri: v.imageUrl }}
              style={[styles.bgImage, { borderRadius: v.bdrRadius }]}
              resizeMode="cover"
            />
          </View>
        ) : null}
        <Text
          style={{
            color: v.txtColor,
            fontSize: v.fSize || 20,
            fontWeight: v.fWeight as any,
            textAlign: 'center',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {v.labelText || '⚙'}
        </Text>

        {/* Tono sombrío para indicar que ya es el botón en uso */}
        {current && <View style={styles.optionOverlay} pointerEvents="none" />}
      </TouchableOpacity>

      {current && (
        <View style={styles.optionCheck} pointerEvents="none">
          <Check size={13} color="#fff" strokeWidth={3} />
        </View>
      )}
    </View>
  );
}

interface Props {
  onOpenGate: (serviceId: string, serviceName: string) => void;
  gateLoading: string | null;
}

export function FloatingGateButton({ onOpenGate, gateLoading }: Props) {
  const {
    enabled, serviceId, serviceName, buttonConfig, position, setPosition, setService, dismiss,
    accessServices, accessServicesLoading, accessServicesError, refreshAccessServices,
  } = useFloatingGate();

  // Tamaño de ventana vivo: se actualiza con el evento 'change' de Dimensions
  // (rotación / split-screen) para que el arrastre y la restauración usen
  // siempre los límites reales de la pantalla y no los del primer render.
  const dimsRef = useRef(Dimensions.get('window'));

  // Estilos del botón desde el button_config del backend.
  // Mismo constructor que las opciones del menú (getGateCircleVisual) para que
  // ambas vistas luzcan idénticas.
  const {
    txtColor, fSize, fWeight, labelText, imageUrl, bdrRadius,
    circleStyle, shadowStyle,
  } = getGateCircleVisual(buttonConfig || {});

  // Última posición fijada POR ESTE BOTÓN (snap tras un arrastre, o
  // restauración desde storage). Permite distinguir en el efecto de abajo
  // "position cambió porque lo pedimos nosotros" de "position cambió porque
  // acababa de llegar del AsyncStorage".
  const selfPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Recorta una posición a los límites válidos de la pantalla actual y la deja
  // pegada al borde más cercano (el botón siempre vive en un borde).
  const clampToScreen = (x: number, y: number) => {
    const { width, height } = dimsRef.current;
    const maxY = height - BUTTON_SIZE - EDGE_PADDING - 80;
    const minY = EDGE_PADDING + 40;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    const snapX = x < width / 2 ? EDGE_PADDING : width - BUTTON_SIZE - EDGE_PADDING;
    return { x: snapX, y: clampedY };
  };

  // Compute initial position
  const getInitialPos = () => {
    if (position.x >= 0 && position.y >= 0) {
      return clampToScreen(position.x, position.y);
    }
    // Default: bottom-right
    const { width, height } = dimsRef.current;
    return {
      x: width - BUTTON_SIZE - EDGE_PADDING,
      y: height - BUTTON_SIZE - EDGE_PADDING - 80,
    };
  };

  const pan = useRef(new Animated.ValueXY(getInitialPos())).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Espejo del valor actual de `pan` (vía API pública, no `_value` que no
  // existe en los tipos de RN 0.86). Lo usa el gesto para saber desde dónde
  // arranca el drag.
  const currentPosRef = useRef<{ x: number; y: number }>(getInitialPos());
  useEffect(() => {
    const id = pan.addListener(v => {
      currentPosRef.current = { x: v.x, y: v.y };
    });
    return () => { pan.removeListener(id); };
  }, []);

  const setCurrentPos = (x: number, y: number) => {
    currentPosRef.current = { x, y };
  };

  // Sincroniza el flag de arrastre en estado (para handlePress) y en ref
  // (para el efecto de restauración, que no debe correr durante un gesto).
  const setDragging = (v: boolean) => {
    isDraggingRef.current = v;
    setIsDragging(v);
  };

  // Restaura la posición persistida.
  // `pan` se congela en el PRIMER render del botón, y en ese instante el
  // FloatingGateProvider todavía no ha terminado de leer AsyncStorage, así que
  // sin este efecto el Animated.ValueXY quedaba para siempre en la posición
  // default y la posición guardada nunca se aplicaba (botón "que no recuerda
  // dónde lo dejé"). Al llegar aquí el storage sí tiene el valor y se volcamos
  // a `pan`, que es lo que realmente usa el transform del render.
  useEffect(() => {
    if (!(position.x >= 0 && position.y >= 0)) return; // sentinel: sin posición guardada
    if (isDraggingRef.current) return;                 // no pisar un gesto en curso
    if (
      selfPosRef.current &&
      selfPosRef.current.x === position.x &&
      selfPosRef.current.y === position.y
    ) {
      return; // la fijamos nosotros en el snap: dejar correr el spring
    }
    const next = clampToScreen(position.x, position.y);
    pan.setValue(next);
    selfPosRef.current = next;
    setCurrentPos(next.x, next.y);
  }, [position.x, position.y]);

  // Reajusta la posición visible si cambia el tamaño de la ventana, para que
  // el botón no quede fuera de pantalla tras una rotación.
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      dimsRef.current = window;
      if (isDraggingRef.current) return;
      const cur = { ...currentPosRef.current };
      const next = clampToScreen(cur.x, cur.y);
      if (next.x !== cur.x || next.y !== cur.y) {
        pan.setValue(next);
        selfPosRef.current = next;
        setCurrentPos(next.x, next.y);
        setPosition(next.x, next.y);
      }
    });
    return () => sub.remove();
  }, []);

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
    const next = clampToScreen(x, y);

    Animated.spring(pan, {
      toValue: { x: next.x, y: next.y },
      useNativeDriver: false,
      tension: 200,
      friction: 20,
    }).start();

    // Marcar la posición como propia: cuando el contexto la propague, el efecto
    // de restauración la reconocerá y no volverá a aplicarla (cortando el spring).
    selfPosRef.current = next;
    setCurrentPos(next.x, next.y);
    setPosition(next.x, next.y);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        hasMovedRef.current = false;
        // Corta un snap en curso para arrancar el drag desde el valor real.
        pan.stopAnimation();
        dragStartRef.current = { ...currentPosRef.current };
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
        setDragging(true);
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
        setDragging(false);

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
    // Refresh perezoso: solo al abrir el menú (con throttle en el contexto).
    void refreshAccessServices();
  };

  const handleDismiss = () => {
    setMenuVisible(false);
    dismiss();
  };

  if (!enabled || !serviceId) return null;

  const isGateLoading = gateLoading === serviceId;

  const selectService = (s: FloatingAccessService) => {
    // El actual viene deshabilitado, pero por si acaso no se re-selecciona.
    if (s.serviceId === serviceId) return;
    // Cambia label/estilo/acción del flotante al instante; el contexto persiste
    // el cambio en la clave del usuario. La posición XY no se toca.
    setService(s.serviceId, s.serviceName, s.button_config || {});
    setMenuVisible(false);
  };

  const retryAccessServices = () => {
    void refreshAccessServices({ force: true });
  };

  // Build button style: take visual styles from backend but keep circular floating shape
  // Ignore backend width/height — the floating button is always a 62px circle
  const buttonStyle: any[] = [
    styles.button,
    circleStyle,
    shadowStyle || {},
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

            <View style={styles.menuDivider} />

            <Text style={styles.menuSectionTitle}>Cambiar servicio</Text>

            {accessServices.length === 0 ? (
              accessServicesLoading ? (
                <View style={styles.menuState}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (
                <View style={styles.menuState}>
                  <Text style={styles.menuStateText}>
                    {accessServicesError
                      ? 'No se pudieron cargar los servicios de acceso.'
                      : 'No hay servicios de acceso disponibles.'}
                  </Text>
                  {accessServicesError && (
                    <TouchableOpacity style={styles.menuRetry} onPress={retryAccessServices}>
                      <RefreshCw size={13} color={Colors.primary} />
                      <Text style={styles.menuRetryText}>Reintentar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            ) : (
              <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.optionRow}>
                  {accessServices.map(s => (
                    <GateCircleOption
                      key={s.serviceId}
                      config={s.button_config}
                      serviceName={s.serviceName}
                      current={s.serviceId === serviceId}
                      disabled={s.status !== 'ACTIVE'}
                      onPress={() => selectService(s)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            {accessServicesLoading && accessServices.length > 0 && (
              <View style={styles.menuLoadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}

            {!accessServicesLoading && accessServicesError && accessServices.length > 0 && (
              <TouchableOpacity style={styles.menuRetry} onPress={retryAccessServices}>
                <RefreshCw size={13} color={Colors.muted} />
                <Text style={styles.menuRetryText}>No se pudo actualizar · Reintentar</Text>
              </TouchableOpacity>
            )}

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleDismiss}>
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
    // 300px para que quepan 3 círculos de 62px por fila
    minWidth: 300,
    maxWidth: '88%',
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
  menuDivider: {
    height: 1,
    backgroundColor: '#ececf1',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  menuScroll: {
    maxHeight: 280,
    paddingHorizontal: 6,
  },
  // Fila de círculos (wrap: si hay varios servicios pasan a la siguiente fila)
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  optionWrap: {
    width: BUTTON_SIZE,
    alignItems: 'center',
  },
  optionCircle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optionCircleUnavailable: {
    opacity: 0.5,
  },
  // Tono sombrío sobre la opción que ya es el botón flotante en uso
  optionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,24,0.55)',
    borderRadius: BUTTON_SIZE / 2,
  },
  optionCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  menuState: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  menuStateText: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
  },
  menuLoadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  menuRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  menuRetryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
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
});

export default FloatingGateButton;
