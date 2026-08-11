import React, { useRef } from 'react';
import {
    Animated,
    PanResponder,
    Platform,
    View,
} from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

interface ZoomableImageProps {
    uri: string;
    style?: StyleProp<ImageStyle>;
    resizeMode?: 'contain' | 'cover';
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export const ZoomableImage = ({ uri, style, resizeMode = 'contain' }: ZoomableImageProps) => {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const lastScale = useRef(1);
    const lastTranslate = useRef({ x: 0, y: 0 });
    const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
    const lastTouch = useRef<{ x: number; y: number } | null>(null);
    const lastTap = useRef(0);

    const reset = () => {
        lastScale.current = 1;
        lastTranslate.current = { x: 0, y: 0 };
        pinchStart.current = null;
        lastTouch.current = null;
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
    };

    const handleWheel = (e: any) => {
        if (Platform.OS !== 'web') return;
        e?.preventDefault?.();
        const dir = e?.deltaY && e.deltaY < 0 ? 1.12 : 0.89;
        const next = Math.min(Math.max(lastScale.current * dir, MIN_SCALE), MAX_SCALE);
        lastScale.current = next;
        scale.setValue(next);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
            onPanResponderGrant: (evt) => {
                const touches = (evt.nativeEvent.touches || []) as any[];
                if (touches.length >= 2) {
                    const [a, b] = touches;
                    pinchStart.current = {
                        dist: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
                        scale: lastScale.current,
                    };
                    lastTouch.current = null;
                } else if (touches.length === 1) {
                    const t = touches[0];
                    lastTouch.current = { x: t.pageX, y: t.pageY };
                }
            },
            onPanResponderMove: (evt) => {
                const touches = (evt.nativeEvent.touches || []) as any[];
                if (touches.length >= 2) {
                    const [a, b] = touches;
                    const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
                    if (pinchStart.current && pinchStart.current.dist > 0) {
                        const next = Math.min(
                            Math.max(pinchStart.current.scale * (dist / pinchStart.current.dist), MIN_SCALE),
                            MAX_SCALE
                        );
                        lastScale.current = next;
                        scale.setValue(next);
                    }
                    lastTouch.current = null;
                } else if (touches.length === 1) {
                    const t = touches[0];
                    const pos = { x: t.pageX, y: t.pageY };
                    if (lastTouch.current && lastScale.current > 1) {
                        lastTranslate.current = {
                            x: lastTranslate.current.x + (pos.x - lastTouch.current.x),
                            y: lastTranslate.current.y + (pos.y - lastTouch.current.y),
                        };
                        translateX.setValue(lastTranslate.current.x);
                        translateY.setValue(lastTranslate.current.y);
                    }
                    lastTouch.current = pos;
                }
            },
            onPanResponderRelease: () => {
                const now = Date.now();
                if (now - lastTap.current < 300) {
                    reset();
                } else {
                    lastTap.current = now;
                }
                if (lastScale.current <= 1.01) {
                    lastTranslate.current = { x: 0, y: 0 };
                    translateX.setValue(0);
                    translateY.setValue(0);
                }
                pinchStart.current = null;
                lastTouch.current = null;
            },
            onPanResponderTerminate: () => {
                pinchStart.current = null;
                lastTouch.current = null;
            },
        })
    ).current;

    return (
        <View
            style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            {...panResponder.panHandlers}
            {...((Platform.OS === 'web' ? { onWheel: handleWheel } : {}) as any)}
        >
            <Animated.Image
                source={{ uri }}
                resizeMode={resizeMode}
                style={[
                    style,
                    {
                        transform: [{ translateX }, { translateY }, { scale }],
                    },
                ]}
            />
        </View>
    );
};
