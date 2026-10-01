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
     * fotograma por polling.
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
    /**
     * Pausa tras cada fotograma en ms. La cadencia real es la latencia de la
     * respuesta + esta pausa: con la caché de frames del backend (<100 ms)
     * 400 ms equivale a ~2 fps.
     */
    intervalMs?: number;
}

/** Fotogramas fallidos seguidos antes de pasar al estado de error. */
const MAX_CONSECUTIVE_ERRORS = 3;
/**
 * Si una petición no dispara onLoad/onError en este tiempo se cuenta como
 * fallo: evita el spinner infinito cuando una petición se queda colgada.
 */
const REQUEST_TIMEOUT_MS = 15000;

export const CameraFrameViewer: React.FC<CameraFrameViewerProps> = ({
    frameUrl,
    token,
    serviceName,
    errorDetail,
    onRefresh,
    intervalMs = 400,
}) => {
    // Doble buffer: capa 0 y capa 1 se alternan. La capa "front" muestra el
    // último fotograma bueno y NO se toca; la nueva carga en la capa de
    // fondo y sólo se pone al frente al terminar, así nunca se ve pantalla
    // negra entre fotogramas (Fresco borra la imagen al cambiar la URI).
    const [uris, setUris] = useState<(string | null)[]>([null, null]);
    const [frontIdx, setFrontIdx] = useState<0 | 1>(0);
    /** Capa que recibe el próximo fotograma (la que no está al frente). */
    const backRef = useRef<0 | 1>(0);
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const errorCountRef = useRef(0);
    const appActiveRef = useRef(true);
    // Callbacks del <Image> expuestos al bucle de polling vía ref, para que
    // el efecto no capture closures obsoletas entre renderizaciones.
    const onLoadRef = useRef<(layer: number) => void>(() => {});
    const onErrorRef = useRef<(layer: number) => void>(() => {});

    // URL absoluta con el JWT y un cache-buster: cada fotograma es una
    // petición nueva (el backend responde con Cache-Control: no-store).
    const buildUri = useCallback(
        (url: string) => {
            const base = Config.API_URL.replace(/\/+$/, '');
            const absolute = url.startsWith('http') ? url : `${base}${url}`;
            const sep = absolute.includes('?') ? '&' : '?';
            return `${absolute}${sep}token=${encodeURIComponent(token)}&_=${Date.now()}`;
        },
        [token],
    );

    // Al cambiar la fuente (reintento) se limpia todo el estado del intento
    // anterior. DEBE DECLARARSE ANTES del bucle de polling: los efectos se
    // ejecutan en orden y así backRef/uris quedan reiniciados antes de que
    // el bucle dispare su primer fotograma.
    useEffect(() => {
        errorCountRef.current = 0;
        backRef.current = 0;
        setUris([null, null]);
        setFrontIdx(0);
        setLoaded(false);
        setHasError(false);
    }, [frameUrl]);

    // Bucle de polling EN CADENA: sólo se pide el siguiente fotograma cuando
    // el anterior terminó (onLoad, onError o watchdog). Un intervalo fijo
    // cancelaba las peticiones en vuelo (cada frame tarda ~1.7 s), el <Image>
    // nunca disparaba onLoad y el visor se quedaba en "Cargando..." eterno.
    useEffect(() => {
        if (hasError) return;

        let stopped = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;
        let next: ReturnType<typeof setTimeout> | null = null;

        const clearWatchdog = () => {
            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }
        };

        const requestFrame = () => {
            if (stopped) return;
            // Sin peticiones en segundo plano: la cadena queda detenida y el
            // listener de AppState la reanuda al volver a 'active'.
            if (!appActiveRef.current) return;
            clearWatchdog();
            const uri = buildUri(frameUrl);
            const target = backRef.current;
            // La capa de fondo se carga (y se borra) sin afectar a la capa
            // que el usuario está viendo.
            setUris(prev => {
                const updated = [...prev];
                updated[target] = uri;
                return updated;
            });
            watchdog = setTimeout(() => {
                // Petición colgada sin onLoad/onError: cuenta como fallo.
                watchdog = null;
                handleFail();
            }, REQUEST_TIMEOUT_MS);
        };

        const scheduleNext = (delay: number) => {
            if (stopped) return;
            if (next) clearTimeout(next);
            next = setTimeout(requestFrame, delay);
        };

        const handleOk = (layer: number) => {
            if (stopped) return;
            // Cargas llegadas tarde de otra ronda: se ignoran.
            if (layer !== backRef.current) return;
            clearWatchdog();
            errorCountRef.current = 0;
            // Intercambio de capas: la recién cargada pasa al frente (ya
            // tiene el bitmap decodificado, el cambio es instantáneo) y la
            // anterior queda de fondo para recibir el próximo fotograma.
            setFrontIdx(layer as 0 | 1);
            backRef.current = (layer === 0 ? 1 : 0) as 0 | 1;
            setLoaded(true);
            scheduleNext(intervalMs);
        };

        const handleFail = () => {
            if (stopped) return;
            clearWatchdog();
            errorCountRef.current += 1;
            if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
                setHasError(true);
            } else {
                // Se reintenta en la MISMA capa de fondo; la capa al frente
                // sigue mostrando el último fotograma bueno.
                scheduleNext(intervalMs);
            }
        };

        onLoadRef.current = handleOk;
        onErrorRef.current = layer => {
            if (layer !== backRef.current) return;
            handleFail();
        };

        const subscription = AppState.addEventListener('change', state => {
            appActiveRef.current = state === 'active';
            // Reanuda la cadena si quedó detenida en segundo plano (sin
            // petición en vuelo ni siguiente fotograma programado).
            if (state === 'active' && !watchdog && !next) scheduleNext(0);
        });

        requestFrame(); // primer fotograma sin esperar

        return () => {
            stopped = true;
            clearWatchdog();
            if (next) clearTimeout(next);
            subscription.remove();
        };
    }, [hasError, frameUrl, buildUri, intervalMs]);

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
            {uris.map((uri, idx) =>
                uri ? (
                    <Image
                        key={idx}
                        source={{ uri }}
                        style={[styles.image, { zIndex: frontIdx === idx ? 2 : 1 }]}
                        resizeMode="contain"
                        accessibilityLabel={serviceName}
                        onLoad={() => onLoadRef.current(idx)}
                        onError={() => onErrorRef.current(idx)}
                    />
                ) : null
            )}
            {!loaded && (
                <View style={[styles.loadingOverlay, { zIndex: 3 }]}>
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
    // Capas absolutas apiladas (doble buffer): la capa frontal lleva zIndex
    // mayor y la de fondo recibe la siguiente carga sin parpadear.
    image: {
        position: 'absolute',
        top: 0,
        left: 0,
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
