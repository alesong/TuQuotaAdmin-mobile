import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    AppState,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';

interface CameraFrameViewerProps {
    /**
     * URL relativa del fotograma (…/resident-services/cameras-center/frame/<serviceId>).
     * Cameras Center sólo publica MJPEG y JPEG: MJPEG no es reproducible con
     * expo-video ni con <Image> de React Native, así que se refresca el último
     * fotograma por polling (~1 fps).
     */
    frameUrl: string;
    /** JWT del residente: el backend también lo acepta en la query `?token=`. */
    token: string;
    serviceName: string;
    /** Detalle del último error del backend (si lo hubo al obtener el stream). */
    errorDetail?: string | null;
    /**
     * Vuelve a pedir el stream al backend antes de reintentar (misma
     * convención que CameraStreamViewer): devuelve la nueva URL o null si ya
     * no hay transmisión disponible.
     */
    onRefresh?: () => Promise<string | null> | string | null;
    /** Intervalo entre fotogramas en ms (800 ≈ 1.25 fps). */
    intervalMs?: number;
}

/** Fotogramas fallidos seguidos antes de pasar al estado de error. */
const MAX_CONSECUTIVE_ERRORS = 3;

export const CameraFrameViewer: React.FC<CameraFrameViewerProps> = ({
    frameUrl,
    token,
    serviceName,
    errorDetail,
    onRefresh,
    intervalMs = 800,
}) => {
    const [frameUri, setFrameUri] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const errorCountRef = useRef(0);
    const appActiveRef = useRef(true);

    // URL absoluta con el JWT y un cache-buster: cada tick es una petición
    // nueva (el backend responde con Cache-Control: no-store).
    const buildUri = useCallback(
        (url: string) => {
            const base = Config.API_URL.replace(/\/+$/, '');
            const absolute = url.startsWith('http') ? url : `${base}${url}`;
            const sep = absolute.includes('?') ? '&' : '?';
            return `${absolute}${sep}token=${encodeURIComponent(token)}&_=${Date.now()}`;
        },
        [token],
    );

    // Polling: pide un fotograma mientras el visor esté montado y sin error
    // (el componente sólo se monta tras pulsar "Ver transmisión en vivo").
    useEffect(() => {
        if (hasError) return;

        const requestFrame = () => {
            // En segundo plano no se pide nada (batería y espectadores de
            // Cameras Center): se reanuda solamente al volver a 'active'.
            if (!appActiveRef.current) return;
            setFrameUri(buildUri(frameUrl));
        };

        requestFrame(); // primer fotograma sin esperar al primer intervalo
        const id = setInterval(requestFrame, intervalMs);
        return () => clearInterval(id);
    }, [hasError, frameUrl, buildUri, intervalMs]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            appActiveRef.current = state === 'active';
        });
        return () => subscription.remove();
    }, []);

    // Al cambiar la fuente (reintento) se limpia el estado del intento anterior.
    useEffect(() => {
        errorCountRef.current = 0;
        setLoaded(false);
        setHasError(false);
    }, [frameUrl]);

    const handleFrameLoad = () => {
        errorCountRef.current = 0;
        setLoaded(true);
    };

    const handleFrameError = () => {
        errorCountRef.current += 1;
        if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
            setHasError(true);
        }
    };

    const handleRetry = async () => {
        if (!onRefresh) {
            errorCountRef.current = 0;
            setHasError(false);
            return;
        }
        setRetrying(true);
        try {
            const newUrl = await onRefresh();
            if (!newUrl) {
                // El backend devolvió un error nuevo: se muestra vía errorDetail.
                setHasError(true);
                return;
            }
            errorCountRef.current = 0;
            setLoaded(false);
            // No se construye la URI con newUrl (es el stream): el polling se
            // reinicia solo con el prop frameUrl, ya actualizado por el refresh.
            setHasError(false);
        } catch {
            setHasError(true);
        } finally {
            setRetrying(false);
        }
    };

    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>No se pudo cargar la transmisión</Text>
                {!!errorDetail && <Text style={styles.errorDetail}>{errorDetail}</Text>}
                <TouchableOpacity
                    style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
                    onPress={handleRetry}
                    disabled={retrying}
                >
                    {retrying ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text style={styles.retryBtnText}>Reintentar</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!!frameUri && (
                <Image
                    source={{ uri: frameUri }}
                    style={styles.image}
                    resizeMode="contain"
                    accessibilityLabel={serviceName}
                    onLoad={handleFrameLoad}
                    onError={handleFrameError}
                />
            )}
            {!loaded && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.loadingText}>Cargando transmisión...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        position: 'relative',
        minHeight: 200,
    },
    image: {
        width: '100%',
        height: 200,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 12,
        marginTop: 8,
    },
    errorContainer: {
        minHeight: 150,
        backgroundColor: '#fff1f2',
        borderWidth: 1,
        borderColor: '#ffe4e6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        fontSize: 13,
        color: '#b91c1c',
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 6,
    },
    errorDetail: {
        fontSize: 12,
        color: '#b91c1c',
        textAlign: 'center',
        marginBottom: 10,
    },
    retryBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryBtnDisabled: {
        opacity: 0.7,
    },
    retryBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
